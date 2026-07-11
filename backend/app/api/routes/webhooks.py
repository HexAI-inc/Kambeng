import hmac
import hashlib
import json
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
from app.services.payout_service import apply_payout_status, normalize_gateway_status

router = APIRouter(prefix="/webhooks", tags=["Webhooks"])
logger = get_logger("webhooks")

PAYOUT_REFERENCE_PREFIXES = ("PAYOUT-", "OUT-", "ADMIN-COMM-")
DONATION_REFERENCE_PREFIXES = ("DON-", "REC-")


class WebhookPayload(BaseModel):
    event: str
    transaction: Dict[str, Any]


def _parse_webhook_body(raw_body: bytes) -> tuple[str, dict]:
    """Leniently extract (event, transaction-like dict) from a webhook body.

    HexAI's payout notifications have not always matched the documented
    {event, transaction} shape — a strict model meant those requests were
    rejected with 422 before we even logged them. Accept the transaction
    object under any of the known keys, or fields at the top level.
    """
    try:
        data = json.loads(raw_body.decode("utf-8"))
    except (ValueError, UnicodeDecodeError):
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    if not isinstance(data, dict):
        raise HTTPException(status_code=400, detail="Invalid webhook payload")

    event = str(data.get("event") or data.get("event_type") or data.get("type") or "")

    transaction = None
    for key in ("transaction", "payout", "collection", "data"):
        candidate = data.get(key)
        if isinstance(candidate, dict):
            transaction = candidate
            break
    if transaction is None:
        # Fields may sit at the top level next to `event`
        transaction = data

    return event, transaction


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

    event, transaction = _parse_webhook_body(raw_body)
    client_ref = str(
        transaction.get("client_reference")
        or transaction.get("payout_reference")
        or transaction.get("reference")
        or ""
    )
    raw_status = transaction.get("status")
    status = normalize_gateway_status(raw_status)

    logger.info(
        "Webhook received",
        extra={
            "action": "hexai_webhook_received",
            "eventType": event,
            "client_reference": client_ref,
            "webhook_status": raw_status,
            "normalized_status": status,
        },
    )

    # -----------------------------------------
    # SCENARIO B: CAMPAIGN PAYOUT OR ADMIN COMMISSION PAYOUT
    # Payout events have arrived under varying event names, so match on the
    # reference prefix rather than the event string.
    # -----------------------------------------
    if client_ref.startswith(PAYOUT_REFERENCE_PREFIXES):
        if status is None:
            logger.info(
                "Payout webhook with non-terminal status ignored",
                extra={
                    "action": "payout_webhook_nonterminal",
                    "client_reference": client_ref,
                    "webhook_status": raw_status,
                    "event": event,
                },
            )
            return {"status": "success", "message": "Webhook processed successfully"}

        from app.models.payout import Payout
        result = await db.execute(select(Payout).where(Payout.client_reference == client_ref))
        payout = result.scalars().first()

        if payout:
            await apply_payout_status(db, payout, status, source="WEBHOOK")
        else:
            logger.warning(
                "Payout webhook reference not found",
                extra={"action": "payout_webhook_reference_not_found", "client_reference": client_ref},
            )
        return {"status": "success", "message": "Webhook processed successfully"}

    if event == "transaction.completed":
        # -----------------------------------------
        # SCENARIO A: DONATION
        # -----------------------------------------
        if client_ref.startswith(DONATION_REFERENCE_PREFIXES):
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

        else:
            logger.info(
                "Webhook event ignored — unrecognised reference prefix",
                extra={"action": "hexai_webhook_ignored", "client_reference": client_ref, "event": event},
            )

    return {"status": "success", "message": "Webhook processed successfully"}
