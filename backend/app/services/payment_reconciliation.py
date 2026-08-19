import logging
from datetime import UTC, datetime
from typing import Literal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.campaign import Campaign, CampaignMode, CampaignStatus
from app.models.campaign_goal import CampaignGoal, GoalStatus
from app.models.donation import Donation
from app.models.ledger import TransactionLedger, TransactionStatus
from app.core.config import settings

logger = logging.getLogger(__name__)

ResolutionSource = Literal["WEBHOOK", "MANUAL_ADMIN", "APS_CONFIRM"]
TerminalDonationStatus = Literal["SUCCEEDED", "FAILED"]


class DonationNotFoundError(LookupError):
    pass


class DonationTransitionConflictError(ValueError):
    pass


def _now_utc() -> datetime:
    return datetime.now(UTC)


async def reconcile_donation_status(
    db: AsyncSession,
    *,
    client_reference: str,
    target_status: TerminalDonationStatus,
    source: ResolutionSource,
    reason: str | None = None,
    reviewed_by_admin_id: int | None = None,
) -> dict[str, object]:
    donation_result = await db.execute(
        select(Donation).where(Donation.client_reference == client_reference).with_for_update()
    )
    donation = donation_result.scalars().first()
    if donation is None:
        raise DonationNotFoundError(f"Donation {client_reference!r} was not found")

    ledger_result = await db.execute(
        select(TransactionLedger).where(TransactionLedger.external_reference == client_reference).with_for_update()
    )
    ledger = ledger_result.scalars().first()

    previous_status = donation.status
    idempotent = previous_status == target_status

    # Campaign events detected during this reconciliation, notified after commit
    campaign_just_completed: Campaign | None = None
    goal_just_completed: tuple[Campaign, str] | None = None

    if previous_status in {"SUCCEEDED", "FAILED"} and previous_status != target_status:
        raise DonationTransitionConflictError(
            f"Donation {client_reference!r} is already finalized as {previous_status}"
        )

    if not idempotent:
        reconciled_at = _now_utc()
        donation.status = target_status
        donation.reconciliation_source = source
        donation.reconciliation_reason = reason.strip() if reason and reason.strip() else None
        donation.reconciled_by_admin_id = reviewed_by_admin_id if source == "MANUAL_ADMIN" else None
        donation.reconciled_at = reconciled_at

        if ledger is not None:
            ledger.status = TransactionStatus.SUCCEEDED if target_status == "SUCCEEDED" else TransactionStatus.FAILED
            ledger.confirmed_at = reconciled_at
            ledger.reconciliation_source = source
            ledger.reconciliation_reason = reason.strip() if reason and reason.strip() else None
            ledger.reconciled_by_admin_id = reviewed_by_admin_id if source == "MANUAL_ADMIN" else None
            ledger.reconciled_at = reconciled_at
            reason_suffix = f" - {reason.strip()}" if reason and reason.strip() else ""
            ledger.description = (
                (ledger.description or "Donation")
                + f" ({'confirmed' if target_status == 'SUCCEEDED' else 'rejected'} by {source.lower()}{reason_suffix})"
            )

        if target_status == "SUCCEEDED":
            # HexAI deducts their collection fee before crediting our account.
            # Record net_received (what actually lands in our HexAI wallet) so that
            # available_balance = amount_raised - net_payouts is accurate.
            collection_fee = round(donation.amount * settings.HEXAI_COLLECTION_FEE_PERCENT, 2)
            net_received = round(donation.amount - collection_fee, 2)

            # Update ledger to reflect the actual net amount and fee breakdown
            # — this always reflects the real settlement with HexAI, regardless
            # of any promo top-up credited to the campaign below.
            if ledger is not None:
                ledger.hexai_fee = collection_fee
                ledger.net_amount = net_received

            campaign_result = await db.execute(select(Campaign).where(Campaign.id == donation.campaign_id).with_for_update())
            campaign = campaign_result.scalars().first()

            # Promotions engine: fee-free-day/first-donation absorption (Kambeng
            # eats the collection fee) and matched-donation top-ups (Kambeng or
            # sponsor pool) both credit the campaign beyond net_received.
            promo_credit = 0.0
            if campaign is not None:
                from app.services.promotions import apply_donation_promos

                promo_outcome = await apply_donation_promos(db, campaign, donation, collection_fee=collection_fee)
                promo_credit = promo_outcome.fee_waived_amount + promo_outcome.match_amount

            if campaign is not None:
                campaign.amount_raised += net_received + promo_credit
                if campaign.mode == CampaignMode.TARGET and campaign.target_amount:
                    if campaign.amount_raised >= campaign.target_amount and campaign.status != CampaignStatus.CLOSED:
                        campaign.status = CampaignStatus.CLOSED
                        campaign_just_completed = campaign

                        from app.services.promotions import process_completion_rebate

                        await process_completion_rebate(db, campaign)

            if donation.goal_id is not None:
                goal_result = await db.execute(select(CampaignGoal).where(CampaignGoal.id == donation.goal_id).with_for_update())
                goal = goal_result.scalars().first()
                if goal is not None:
                    goal.amount_raised += net_received + promo_credit
                    if goal.amount_raised >= goal.target_amount and goal.status != GoalStatus.COMPLETED:
                        goal.status = GoalStatus.COMPLETED
                        if campaign is not None:
                            goal_just_completed = (campaign, goal.title)

    await db.commit()

    # Notify campaign followers — email failures must never break reconciliation
    if campaign_just_completed is not None or goal_just_completed is not None:
        from app.services.marketing_service import notify_campaign_completed, notify_campaign_milestone

        try:
            if campaign_just_completed is not None:
                await notify_campaign_completed(db, campaign_just_completed)
            elif goal_just_completed is not None:
                milestone_campaign, milestone_name = goal_just_completed
                await notify_campaign_milestone(db, milestone_campaign, milestone_name)
        except Exception:
            logger.exception(
                "Failed to send campaign event emails", extra={"client_reference": client_reference}
            )

    return {
        "donation": donation,
        "ledger": ledger,
        "idempotent": idempotent,
        "previous_status": previous_status,
        "new_status": donation.status,
        "reconciliation_source": donation.reconciliation_source,
        "reconciliation_reason": donation.reconciliation_reason,
        "reconciled_by_admin_id": donation.reconciled_by_admin_id,
        "reconciled_at": donation.reconciled_at,
    }


async def build_campaign_amount_reconciliation(
    db: AsyncSession,
    *,
    threshold: float = 0.01,
) -> dict:
    """Compare campaign.amount_raised against net-of-fee donation sums.

    Used by scripts/reconcile_campaign_totals.py to audit the financial state.
    Returns a report dict with summary + per-campaign discrepancies.
    """
    fee_rate = settings.HEXAI_COLLECTION_FEE_PERCENT

    campaigns_result = await db.execute(select(Campaign))
    campaigns = campaigns_result.scalars().all()

    donations_result = await db.execute(
        select(Donation).where(Donation.status == "SUCCEEDED")
    )
    succeeded = donations_result.scalars().all()

    donation_net_by_campaign: dict[int, float] = {}
    for d in succeeded:
        net = round(d.amount * (1 - fee_rate), 2)
        donation_net_by_campaign[d.campaign_id] = round(
            donation_net_by_campaign.get(d.campaign_id, 0.0) + net, 2
        )

    discrepancies = []
    total_campaign_raised = 0.0
    total_donation_sum = 0.0

    for campaign in campaigns:
        raised = round(campaign.amount_raised or 0.0, 2)
        expected = round(donation_net_by_campaign.get(campaign.id, 0.0), 2)
        diff = round(raised - expected, 2)
        total_campaign_raised += raised
        total_donation_sum += expected
        if abs(diff) > threshold:
            discrepancies.append({
                "campaign_id": campaign.id,
                "slug": campaign.slug,
                "amount_raised": raised,
                "donation_sum": expected,
                "difference": diff,
            })

    return {
        "summary": {
            "total_campaigns": len(campaigns),
            "matched_campaigns": len(campaigns) - len(discrepancies),
            "mismatched_campaigns": len(discrepancies),
            "total_campaign_amount_raised": round(total_campaign_raised, 2),
            "total_donation_sum": round(total_donation_sum, 2),
            "difference": round(total_campaign_raised - total_donation_sum, 2),
            "fee_rate_applied": fee_rate,
        },
        "discrepancies": discrepancies,
    }
