import hmac
import hashlib
from fastapi import APIRouter, Request, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from pydantic import BaseModel
from typing import Dict, Any

from app.db.database import get_db
from app.core.config import settings
from app.core.logging_config import get_logger
from app.services.payment_reconciliation import (
    DonationNotFoundError,
    DonationTransitionConflictError,
    reconcile_donation_status,
)
from app.services.email_service import (
    send_email,
    render_withdrawal_confirmed_email,
    render_withdrawal_failed_email,
)

router = APIRouter(prefix="/webhooks", tags=["Webhooks"])
logger = get_logger("webhooks")


class WebhookPayload(BaseModel):
    event: str
    transaction: Dict[str, Any]


# HexAI may use any of these header names for the HMAC signature.
# We try all of them so we work regardless of which one they use.
_SIGNATURE_HEADERS = [
    "x-hexai-signature",
    "x-wave-signature",
    "wave-signature",
    "x-signature",
    "x-hub-signature-256",
]


def _extract_signature(request: Request) -> str | None:
    """Try all known header names; return the first non-empty value found."""
    for name in _SIGNATURE_HEADERS:
        val = request.headers.get(name, "")
        if val:
            return val
    return None


def _verify_signature(payload_body: bytes, signature: str) -> bool:
    """
    Verify HMAC-SHA256 signature.
    Handles both raw hex ('abcd...') and prefixed ('sha256=abcd...') formats.
    """
    secret = settings.HEXAI_WEBHOOK_SECRET
    if not secret or not signature:
        return False

    # Strip common prefixes
    sig = signature
    for prefix in ("sha256=", "hmac-sha256=", "HMAC-SHA256="):
        if sig.startswith(prefix):
            sig = sig[len(prefix):]
            break

    expected = hmac.new(
        secret.encode("utf-8"),
        payload_body,
        hashlib.sha256,
    ).hexdigest()

    try:
        return hmac.compare_digest(expected, sig)
    except (TypeError, ValueError):
        return False


@router.post("/hexai")
async def hexai_webhook(
    payload: WebhookPayload,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    if not settings.HEXAI_WEBHOOK_SECRET:
        raise HTTPException(status_code=500, detail="HEXAI_WEBHOOK_SECRET is not configured")

    raw_body = await request.body()
    received_sig = _extract_signature(request)

    # Log which signature header was found (or none) to help diagnose issues
    found_header = next(
        (h for h in _SIGNATURE_HEADERS if request.headers.get(h)),
        None,
    )
    logger.info(
        "Webhook signature check",
        extra={
            "action": "hexai_webhook_signature_check",
            "signature_header_found": found_header,
            "has_signature": bool(received_sig),
            "body_length": len(raw_body),
        },
    )

    if not _verify_signature(raw_body, received_sig or ""):
        logger.warning(
            "Webhook signature validation failed",
            extra={
                "action": "hexai_webhook_invalid_signature",
                "signature_header_found": found_header,
                "has_signature": bool(received_sig),
                # Log first 8 chars of received sig to aid debugging without exposing full secret
                "sig_preview": (received_sig or "")[:8] or "(empty)",
            },
        )
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    data = payload.model_dump()
    event = data.get("event")
    transaction = data.get("transaction", {})
    client_ref = transaction.get("client_reference", "")
    status = transaction.get("status")

    logger.info(
        "Webhook received",
        extra={
            "action": "hexai_webhook_received",
            "eventType": event,
            "client_reference": client_ref,
            "webhook_status": status,
        },
    )

    if event == "transaction.completed":
        # -----------------------------------------
        # SCENARIO A: DONATION
        # -----------------------------------------
        if client_ref.startswith("DON-") or client_ref.startswith("REC-"):
            if status in {"SUCCEEDED", "FAILED"}:
                try:
                    result = await reconcile_donation_status(
                        db,
                        client_reference=client_ref,
                        target_status=status,
                        source="WEBHOOK",
                        reason=f"hexai_status={status}",
                    )
                    donation = result["donation"]
                    logger.info(
                        "Donation reconciled from webhook",
                        extra={
                            "action": "donation_webhook_reconciled",
                            "client_reference": client_ref,
                            "previous_status": result["previous_status"],
                            "new_status": result["new_status"],
                            "idempotent": result["idempotent"],
                            "donation_id": getattr(donation, "id", None),
                            "campaign_id": getattr(donation, "campaign_id", None),
                        },
                    )
                except DonationNotFoundError:
                    logger.warning(
                        "Donation webhook reference not found",
                        extra={"action": "donation_webhook_reference_not_found", "client_reference": client_ref},
                    )
                except DonationTransitionConflictError as exc:
                    logger.warning(
                        "Donation webhook transition conflict",
                        extra={
                            "action": "donation_webhook_transition_conflict",
                            "client_reference": client_ref,
                            "error": str(exc),
                        },
                    )

        # -----------------------------------------
        # SCENARIO B: CAMPAIGN PAYOUT OR ADMIN COMMISSION PAYOUT
        # -----------------------------------------
        elif (
            client_ref.startswith("PAYOUT-")
            or client_ref.startswith("OUT-")
            or client_ref.startswith("ADMIN-COMM-")
        ):
            from app.models.payout import Payout
            result = await db.execute(select(Payout).where(Payout.client_reference == client_ref))
            payout = result.scalars().first()

            if payout:
                if status == "FAILED" and payout.status != "FAILED":
                    payout.status = "FAILED"
                    await db.commit()
                    logger.warning(
                        "Payout failed",
                        extra={"action": "payout_webhook_failed", "client_reference": client_ref},
                    )
                    # Send failure email if this is a campaign payout
                    if payout.campaign_id:
                        try:
                            from app.models.campaign import Campaign
                            from app.models.user import User
                            camp_r = await db.execute(select(Campaign).where(Campaign.id == payout.campaign_id))
                            camp = camp_r.scalars().first()
                            if camp:
                                user_r = await db.execute(select(User).where(User.id == camp.user_id))
                                user = user_r.scalars().first()
                                if user and user.email:
                                    dashboard_link = f"{settings.FRONTEND_URL.rstrip('/')}/dashboard"
                                    send_email(
                                        user.email,
                                        f"Withdrawal failed — {camp.title}",
                                        render_withdrawal_failed_email(
                                            full_name=user.full_name or user.email,
                                            campaign_title=camp.title,
                                            gross_amount=payout.gross_amount or 0.0,
                                            wave_number=user.wave_number,
                                            reference=client_ref,
                                            dashboard_link=dashboard_link,
                                        ),
                                    )
                        except Exception:
                            pass

                elif status == "SUCCEEDED" and payout.status != "SUCCEEDED":
                    payout.status = "SUCCEEDED"
                    await db.commit()
                    logger.info(
                        "Payout confirmed",
                        extra={"action": "payout_webhook_succeeded", "client_reference": client_ref},
                    )
                    # Send confirmation email if this is a campaign payout
                    if payout.campaign_id:
                        try:
                            from app.models.campaign import Campaign
                            from app.models.user import User
                            camp_r = await db.execute(select(Campaign).where(Campaign.id == payout.campaign_id))
                            camp = camp_r.scalars().first()
                            if camp:
                                user_r = await db.execute(select(User).where(User.id == camp.user_id))
                                user = user_r.scalars().first()
                                if user and user.email:
                                    dashboard_link = f"{settings.FRONTEND_URL.rstrip('/')}/dashboard"
                                    send_email(
                                        user.email,
                                        f"Withdrawal confirmed — {payout.net_amount:,.2f} GMD sent",
                                        render_withdrawal_confirmed_email(
                                            full_name=user.full_name or user.email,
                                            campaign_title=camp.title,
                                            net_amount=payout.net_amount or 0.0,
                                            wave_number=user.wave_number,
                                            reference=client_ref,
                                            dashboard_link=dashboard_link,
                                        ),
                                    )
                        except Exception:
                            pass
            else:
                logger.warning(
                    "Payout webhook reference not found",
                    extra={"action": "payout_webhook_reference_not_found", "client_reference": client_ref},
                )

        else:
            logger.info(
                "Webhook event ignored — unrecognised reference prefix",
                extra={"action": "hexai_webhook_ignored", "client_reference": client_ref, "event": event},
            )

    return {"status": "success", "message": "Webhook processed successfully"}
