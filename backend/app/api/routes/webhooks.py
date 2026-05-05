import hmac
import hashlib
from fastapi import APIRouter, Request, HTTPException, Header, Depends
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

router = APIRouter(prefix="/webhooks", tags=["Webhooks"])
logger = get_logger("webhooks")

# 1. We create a schema so Swagger UI shows the body!
class WebhookPayload(BaseModel):
    event: str
    transaction: Dict[str, Any]

def verify_hexai_signature(payload_body: bytes, signature_header: str) -> bool:
    if not signature_header:
        return False
    expected_signature = hmac.new(
        settings.HEXAI_WEBHOOK_SECRET.encode('utf-8'),
        payload_body,
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected_signature, signature_header)

@router.post("/hexai")
async def hexai_webhook(
    payload: WebhookPayload, 
    request: Request, 
    wave_signature: str = Header(None),
    db: AsyncSession = Depends(get_db)
):
    if not settings.HEXAI_WEBHOOK_SECRET:
        raise HTTPException(status_code=500, detail="HEXAI_WEBHOOK_SECRET is not configured")

    raw_body = await request.body()
    if not verify_hexai_signature(raw_body, wave_signature):
        logger.warning("Webhook signature validation failed", extra={"action": "hexai_webhook_invalid_signature"})
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
        # SCENARIO A: A DONATION CAME IN
        # -----------------------------------------
        if client_ref.startswith("DON-"):
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
        # SCENARIO B: A PAYOUT FAILED IN THE BACKGROUND
        # -----------------------------------------
        elif client_ref.startswith("PAYOUT-") or client_ref.startswith("OUT-"):
            from app.models.payout import Payout
            result = await db.execute(select(Payout).where(Payout.client_reference == client_ref))
            payout = result.scalars().first()

            if payout:
                if status == "FAILED":
                    payout.status = "FAILED"
                    await db.commit()
                    print(f"❌ Payout Failed! Marked as FAILED so funds are restored. Ref: {client_ref}")
                    
                elif status == "SUCCEEDED":
                    payout.status = "SUCCEEDED"
                    await db.commit()
                    print(f"✅ Payout Successfully delivered by Wave! Ref: {client_ref}")
                    
    return {"status": "success", "message": "Webhook processed successfully"}