"""Admin-only proxy to HPG's audit/reporting endpoints — wallet balance,
dashboard stats, the gateway's own transaction ledger, and a webhook-health
check — plus a reconciliation report that cross-checks our local `donations`
table against what the gateway actually shows, to catch exactly the kind of
stuck-in-PENDING donations the earlier webhook event-name mismatch caused.

Discovered via the machine-readable spec at https://api.hpg.hexai.gm/openapi.json
(the rendered /docs/api-reference page only lists three of these).
"""

from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.routes.auth import get_admin_user
from app.core.logging_config import get_logger
from app.db.database import get_db
from app.models.campaign import Campaign
from app.models.donation import Donation
from app.models.user import User
from app.services.hexai_service import HexAIGatewayError, HexAIPaymentService

router = APIRouter(prefix="/admin/gateway", tags=["Gateway Audit"])
logger = get_logger("gateway_audit")
hexai_service = HexAIPaymentService()


def _passthrough_error(exc: HexAIGatewayError) -> HTTPException:
    return HTTPException(status_code=exc.status_code if exc.status_code < 500 else 502, detail=exc.message)


@router.get("/balance")
async def gateway_balance(_admin: User = Depends(get_admin_user)):
    """Live HexAI wallet balance — cross-check against our own ledger."""
    try:
        return await hexai_service.get_balance()
    except HexAIGatewayError as exc:
        raise _passthrough_error(exc)


@router.get("/stats")
async def gateway_stats(_admin: User = Depends(get_admin_user)):
    """Volume/commission/pending totals as HPG sees them, by provider."""
    try:
        return await hexai_service.get_stats()
    except HexAIGatewayError as exc:
        raise _passthrough_error(exc)


@router.get("/profile")
async def gateway_profile(_admin: User = Depends(get_admin_user)):
    try:
        return await hexai_service.get_client_profile()
    except HexAIGatewayError as exc:
        raise _passthrough_error(exc)


@router.get("/transactions")
async def gateway_transactions(
    status: str | None = Query(default=None, pattern="^(PENDING|SUCCEEDED|FAILED)$"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    _admin: User = Depends(get_admin_user),
):
    """HPG's own transaction list (collections) — the source of truth to
    reconcile our local records against."""
    try:
        return await hexai_service.list_collections(status=status, limit=limit, offset=offset)
    except HexAIGatewayError as exc:
        raise _passthrough_error(exc)


@router.get("/transactions/{transaction_id}")
async def gateway_transaction_detail(transaction_id: str, _admin: User = Depends(get_admin_user)):
    try:
        return await hexai_service.get_collection_by_transaction_id(transaction_id)
    except HexAIGatewayError as exc:
        raise _passthrough_error(exc)


@router.post("/webhooks/test")
async def gateway_webhook_test(_admin: User = Depends(get_admin_user)):
    """Sends a signed ping to our configured webhook URL and reports the
    live delivery result — use after any deploy that touches the webhook
    handler to confirm HPG can actually reach and authenticate to us."""
    try:
        return await hexai_service.test_webhook()
    except HexAIGatewayError as exc:
        raise _passthrough_error(exc)


class VerifyRecipientRequest(BaseModel):
    mobile: str = Field(..., min_length=4, max_length=20)
    name: str | None = None


@router.post("/verify-recipient")
async def gateway_verify_recipient(payload: VerifyRecipientRequest, _admin: User = Depends(get_admin_user)):
    """Ad-hoc lookup — check whether a Wave number is registered before
    advising an organiser to use it, independent of any specific payout."""
    try:
        return await hexai_service.verify_payout_recipient(mobile=payload.mobile, name=payload.name)
    except HexAIGatewayError as exc:
        raise _passthrough_error(exc)


@router.get("/reconciliation")
async def gateway_reconciliation(
    limit: int = Query(default=30, ge=1, le=100),
    stale_after_minutes: int = Query(default=10, ge=0),
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    """Find donations we still show as PENDING but the gateway has already
    resolved to a terminal state — the exact failure mode the webhook
    event-name mismatch produced. Checks the most recent stale-PENDING
    donations against HPG directly (not a bulk diff — cheap enough at this
    platform's volume, and always current rather than depending on a
    cached list)."""
    cutoff = datetime.now(UTC) - timedelta(minutes=stale_after_minutes)
    result = await db.execute(
        select(Donation, Campaign.title)
        .outerjoin(Campaign, Donation.campaign_id == Campaign.id)
        .where(Donation.status == "PENDING", Donation.created_at <= cutoff)
        .order_by(Donation.created_at.asc())
        .limit(limit)
    )
    rows = result.all()

    checked = 0
    discrepancies = []
    errors = []
    for donation, campaign_title in rows:
        checked += 1
        try:
            gateway_response = await hexai_service.get_collection_status(donation.client_reference)
        except Exception as exc:
            errors.append({"client_reference": donation.client_reference, "error": str(exc)})
            continue

        gateway_status = (gateway_response.get("data") or gateway_response).get("status")
        if gateway_status and gateway_status != "PENDING" and gateway_status != donation.status:
            discrepancies.append({
                "donation_id": donation.id,
                "client_reference": donation.client_reference,
                "campaign_title": campaign_title,
                "local_status": donation.status,
                "gateway_status": gateway_status,
                "amount": donation.amount,
                "created_at": donation.created_at.isoformat() if donation.created_at else None,
            })

    logger.info(
        "Gateway reconciliation run",
        extra={"action": "gateway_reconciliation", "checked": checked, "discrepancies": len(discrepancies)},
    )
    return {"checked": checked, "discrepancies": discrepancies, "errors": errors}
