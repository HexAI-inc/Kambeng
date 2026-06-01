from datetime import UTC, datetime
from typing import Literal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.campaign import Campaign, CampaignMode, CampaignStatus
from app.models.campaign_goal import CampaignGoal, GoalStatus
from app.models.donation import Donation
from app.models.ledger import TransactionLedger, TransactionStatus
from app.core.config import settings

ResolutionSource = Literal["WEBHOOK", "MANUAL_ADMIN"]
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
            if ledger is not None:
                ledger.hexai_fee = collection_fee
                ledger.net_amount = net_received

            campaign_result = await db.execute(select(Campaign).where(Campaign.id == donation.campaign_id).with_for_update())
            campaign = campaign_result.scalars().first()
            if campaign is not None:
                campaign.amount_raised += net_received
                if campaign.mode == CampaignMode.TARGET and campaign.target_amount:
                    if campaign.amount_raised >= campaign.target_amount:
                        campaign.status = CampaignStatus.CLOSED

            if donation.goal_id is not None:
                goal_result = await db.execute(select(CampaignGoal).where(CampaignGoal.id == donation.goal_id).with_for_update())
                goal = goal_result.scalars().first()
                if goal is not None:
                    goal.amount_raised += net_received
                    if goal.amount_raised >= goal.target_amount:
                        goal.status = GoalStatus.COMPLETED

    await db.commit()

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
