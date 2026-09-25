"""Spending accountability: how much was withdrawn vs. how much the
organizers have shown with receipts (campaign updates carrying amount_spent)."""
from datetime import UTC, datetime, timedelta

from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.config import settings
from app.core.logging_config import get_logger
from app.models.campaign import Campaign
from app.models.campaign_update import CampaignUpdate
from app.models.payout import Payout
from app.models.user import User

logger = get_logger("spending")

RECEIPT_REMINDER_AFTER = timedelta(days=7)
# Don't dig up old payouts the first time the job runs after deploy.
RECEIPT_REMINDER_LOOKBACK = timedelta(days=60)


async def spending_summary(db: AsyncSession, campaign_id: int) -> dict:
    withdrawn, last_withdrawal_at = (await db.execute(
        select(func.coalesce(func.sum(Payout.net_amount), 0.0), func.max(Payout.created_at))
        .where(Payout.campaign_id == campaign_id, Payout.status == "SUCCEEDED")
    )).one()
    accounted, last_update_at = (await db.execute(
        select(func.coalesce(func.sum(CampaignUpdate.amount_spent), 0.0), func.max(CampaignUpdate.created_at))
        .where(CampaignUpdate.campaign_id == campaign_id, CampaignUpdate.amount_spent.isnot(None))
    )).one()
    withdrawn = float(withdrawn or 0)
    accounted = float(accounted or 0)
    return {
        "withdrawn": withdrawn,
        "accounted_for": accounted,
        "unaccounted": max(0.0, withdrawn - accounted),
        "last_withdrawal_at": last_withdrawal_at,
        "last_spending_update_at": last_update_at,
    }


async def send_receipt_reminders(db: AsyncSession | None = None) -> int:
    """Daily job: once per successful payout, a week later, nudge whoever
    withdrew to post receipts — unless they already posted a spending update
    since, or everything withdrawn is already accounted for."""
    from app.db.database import AsyncSessionLocal
    from app.services.email_service import render_receipt_reminder_email, send_email

    if db is None:
        async with AsyncSessionLocal() as session:
            return await send_receipt_reminders(session)

    now = datetime.now(UTC)
    payouts = (await db.execute(
        select(Payout).where(
            Payout.status == "SUCCEEDED",
            Payout.receipt_reminder_sent_at.is_(None),
            Payout.created_at <= now - RECEIPT_REMINDER_AFTER,
            Payout.created_at >= now - RECEIPT_REMINDER_LOOKBACK,
        )
    )).scalars().all()

    sent = 0
    for payout in payouts:
        payout.receipt_reminder_sent_at = now  # at most once, even if we skip
        campaign = (await db.execute(select(Campaign).where(Campaign.id == payout.campaign_id))).scalars().first()
        if campaign is None:
            continue
        summary = await spending_summary(db, campaign.id)
        posted_since = (await db.execute(
            select(func.count(CampaignUpdate.id)).where(
                CampaignUpdate.campaign_id == campaign.id,
                CampaignUpdate.amount_spent.isnot(None),
                CampaignUpdate.created_at >= payout.created_at,
            )
        )).scalar() or 0
        if summary["unaccounted"] <= 0 or posted_since:
            continue

        user = (await db.execute(
            select(User).where(User.id == (payout.requested_by_user_id or campaign.user_id))
        )).scalars().first()
        if not user or not user.email:
            continue
        try:
            send_email(
                user.email,
                f"Show donors how you spent the money — {campaign.title}",
                render_receipt_reminder_email(
                    full_name=user.full_name or user.email,
                    campaign_title=campaign.title,
                    amount=payout.net_amount or 0.0,
                    unaccounted=summary["unaccounted"],
                    update_link=f"{settings.FRONTEND_URL.rstrip('/')}/dashboard/my-campaigns/{campaign.id}/updates",
                ),
            )
            sent += 1
        except Exception:
            logger.exception("Failed to send receipt reminder", extra={"payout_id": payout.id})
    await db.commit()
    logger.info("Receipt reminders processed", extra={"action": "receipt_reminders", "checked": len(payouts), "sent": sent})
    return sent
