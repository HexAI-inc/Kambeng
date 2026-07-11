"""Shared payout status transitions.

Used by the HexAI webhook, the admin verify endpoint (which polls the HPG
payout-status API), and the admin manual override — so all three paths apply
identical, idempotent state changes and notifications.
"""

import logging

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.config import settings
from app.models.campaign import Campaign
from app.models.payout import Payout
from app.models.user import User
from app.services.email_service import (
    render_withdrawal_confirmed_email,
    render_withdrawal_failed_email,
    send_email,
)

logger = logging.getLogger(__name__)

# Gateway wording varies (and has changed before); accept every spelling that
# unambiguously means "money moved" or "money did not move".
_SUCCESS_STATUSES = {"SUCCEEDED", "SUCCESS", "SUCCESSFUL", "COMPLETED", "COMPLETE", "PAID"}
_FAILURE_STATUSES = {"FAILED", "FAILURE", "CANCELLED", "CANCELED", "REJECTED", "DECLINED", "EXPIRED"}


def normalize_gateway_status(raw_status: object) -> str | None:
    """Map a gateway status string to our terminal states.
    Returns "SUCCEEDED", "FAILED", or None when the status is non-terminal
    (pending/processing) or unrecognised."""
    if not isinstance(raw_status, str):
        return None
    status = raw_status.strip().upper()
    if status in _SUCCESS_STATUSES:
        return "SUCCEEDED"
    if status in _FAILURE_STATUSES:
        return "FAILED"
    return None


async def apply_payout_status(
    db: AsyncSession,
    payout: Payout,
    new_status: str,
    source: str,
) -> bool:
    """Transition a payout to SUCCEEDED/FAILED and notify the campaign owner.
    Idempotent: returns False (no commit) when the payout is already in the
    target state. `source` is recorded in logs (WEBHOOK / VERIFY / MANUAL)."""
    if new_status not in {"SUCCEEDED", "FAILED"}:
        raise ValueError(f"Unsupported payout status: {new_status}")

    if payout.status == new_status:
        logger.info(
            "Payout already in target state",
            extra={
                "action": "payout_status_idempotent",
                "client_reference": payout.client_reference,
                "payout_status": new_status,
                "source": source,
            },
        )
        return False

    previous = payout.status
    payout.status = new_status
    await db.commit()

    logger.info(
        "Payout status applied",
        extra={
            "action": "payout_status_applied",
            "client_reference": payout.client_reference,
            "previous_status": previous,
            "payout_status": new_status,
            "source": source,
        },
    )

    await _notify_campaign_owner(db, payout, new_status)
    return True


async def _notify_campaign_owner(db: AsyncSession, payout: Payout, new_status: str) -> None:
    if not payout.campaign_id:
        return
    try:
        camp_result = await db.execute(select(Campaign).where(Campaign.id == payout.campaign_id))
        campaign = camp_result.scalars().first()
        if not campaign:
            return
        user_result = await db.execute(select(User).where(User.id == campaign.user_id))
        user = user_result.scalars().first()
        if not user or not user.email:
            return

        dashboard_link = f"{settings.FRONTEND_URL.rstrip('/')}/dashboard"
        if new_status == "SUCCEEDED":
            send_email(
                user.email,
                f"Withdrawal confirmed — {payout.net_amount:,.2f} GMD sent",
                render_withdrawal_confirmed_email(
                    full_name=user.full_name or user.email,
                    campaign_title=campaign.title,
                    net_amount=payout.net_amount or 0.0,
                    wave_number=user.wave_number,
                    reference=payout.client_reference,
                    dashboard_link=dashboard_link,
                ),
            )
        else:
            send_email(
                user.email,
                f"Withdrawal failed — {campaign.title}",
                render_withdrawal_failed_email(
                    full_name=user.full_name or user.email,
                    campaign_title=campaign.title,
                    gross_amount=payout.gross_amount or 0.0,
                    wave_number=user.wave_number,
                    reference=payout.client_reference,
                    dashboard_link=dashboard_link,
                ),
            )
    except Exception:
        logger.exception(
            "Failed to send payout notification email",
            extra={"action": "payout_email_failed", "client_reference": payout.client_reference},
        )
