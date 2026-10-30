"""Campaign money audit: does every stored total match the records behind it?

`campaign.amount_raised` is a running total that reconciliation and the
promotions engine add to. Nothing recomputes it, so a credit applied twice
(the webhook/poll race) or a credit with no record behind it stays forever
and can be withdrawn. This module recomputes each total from its sources:

  donations   — whole-dalasi net of every SUCCEEDED donation, on its own rail
  promotions  — fee waivers and matches applied to those donations, plus
                completion/transparency rebates (withdrawal fee waivers lower
                the commission instead and never credit the campaign)

and compares it with what is stored, alongside what has been withdrawn.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.audit_log import AdminAuditLog, AuditActionType
from app.models.campaign import Campaign
from app.models.campaign_adjustment import CampaignBalanceAdjustment
from app.models.campaign_goal import CampaignGoal
from app.models.donation import Donation
from app.models.payout import Payout
from app.models.promotion import PromoApplication, Promotion, PromoType
from app.models.user import User
from app.services.fees import collection_fee as fee_for_collection
from app.services.money import floor_dalasi

logger = logging.getLogger(__name__)

TOLERANCE = 0.01
# Totals recorded before whole-dalasi accounting carry butut-level rounding
# drift (e.g. 39.20 where today's rules give 40). Only a whole dalasi or more
# is a real discrepancy worth flagging, alerting on or holding withdrawals for.
FLAG_THRESHOLD = 0.99
REBATE_PROMO_TYPES = {PromoType.MILESTONE_COMPLETION_REBATE.value, PromoType.TRANSPARENCY_REBATE.value}
# Payouts that have left, or are leaving, the campaign's balance.
DEBITING_PAYOUT_STATUSES = {"SUCCEEDED", "PENDING"}


class TotalChangedError(ValueError):
    """The stored total moved since the admin loaded the report."""


class WriteOffNotAllowedError(ValueError):
    """The campaign isn't in a state that can be written off."""


def donation_net(donation: Donation) -> float:
    """What a SUCCEEDED donation credits its campaign before promotions."""
    return floor_dalasi(donation.amount - fee_for_collection(donation.amount, donation.provider))


def payout_debit(payout: Payout) -> float:
    """What a withdrawal takes off the campaign's balance: the full amount
    requested, fees included. Fees are paid out of the campaign's money, so
    deducting only the net would leave them in the balance to withdraw again.
    Legacy rows without a gross fall back to the net."""
    return payout.gross_amount or payout.net_amount or payout.amount or 0.0


async def adjustments_by_campaign(db: AsyncSession, campaign_ids: list[int] | None = None) -> dict[int, float]:
    """Balance adjustments (e.g. overdrafts written off against commissions)
    per campaign. They add to what can be withdrawn, never to amount_raised."""
    query = select(CampaignBalanceAdjustment)
    if campaign_ids is not None:
        query = query.where(CampaignBalanceAdjustment.campaign_id.in_(campaign_ids))
    totals: dict[int, float] = {}
    for adjustment in (await db.execute(query)).scalars().all():
        totals[adjustment.campaign_id] = round(totals.get(adjustment.campaign_id, 0.0) + adjustment.amount, 2)
    return totals


async def commissions_written_off(db: AsyncSession) -> float:
    """Commissions Kambeng has spent covering campaign overdrafts."""
    result = await db.execute(
        select(CampaignBalanceAdjustment.amount).where(CampaignBalanceAdjustment.funded_by == "COMMISSIONS")
    )
    return round(sum(result.scalars().all()), 2)


@dataclass
class ExpectedTotals:
    donations_net: float = 0.0
    promo_credit: float = 0.0
    goals: dict[int, float] = field(default_factory=dict)

    @property
    def expected(self) -> float:
        return round(self.donations_net + self.promo_credit, 2)


async def compute_expected_totals(db: AsyncSession, campaign_ids: list[int] | None = None) -> dict[int, ExpectedTotals]:
    totals: dict[int, ExpectedTotals] = {}

    def bucket(campaign_id: int) -> ExpectedTotals:
        return totals.setdefault(campaign_id, ExpectedTotals())

    donation_query = select(Donation).where(Donation.status == "SUCCEEDED")
    if campaign_ids is not None:
        donation_query = donation_query.where(Donation.campaign_id.in_(campaign_ids))
    donations = (await db.execute(donation_query)).scalars().all()
    goal_by_donation: dict[int, tuple[int, int | None]] = {}
    for donation in donations:
        net = donation_net(donation)
        entry = bucket(donation.campaign_id)
        entry.donations_net = round(entry.donations_net + net, 2)
        if donation.goal_id is not None:
            entry.goals[donation.goal_id] = round(entry.goals.get(donation.goal_id, 0.0) + net, 2)
        goal_by_donation[donation.id] = (donation.campaign_id, donation.goal_id)

    promo_query = (
        select(PromoApplication, Promotion.promo_type)
        .join(Promotion, Promotion.id == PromoApplication.promotion_id)
        .where(PromoApplication.reversed.is_(False), PromoApplication.campaign_id.isnot(None))
    )
    if campaign_ids is not None:
        promo_query = promo_query.where(PromoApplication.campaign_id.in_(campaign_ids))
    for application, promo_type in (await db.execute(promo_query)).all():
        promo_type = getattr(promo_type, "value", promo_type)
        if application.donation_id is not None:
            # Only promos on donations that actually succeeded were credited.
            if application.donation_id not in goal_by_donation:
                continue
            credit = (application.fee_waived_amount or 0.0) + (application.match_contributed_amount or 0.0)
            _, goal_id = goal_by_donation[application.donation_id]
            if goal_id is not None:
                entry = bucket(application.campaign_id)
                entry.goals[goal_id] = round(entry.goals.get(goal_id, 0.0) + credit, 2)
        elif promo_type in REBATE_PROMO_TYPES:
            credit = application.fee_waived_amount or 0.0
        else:
            continue
        entry = bucket(application.campaign_id)
        entry.promo_credit = round(entry.promo_credit + credit, 2)

    return totals


def _issues(difference: float, true_balance: float, goal_mismatch: bool, threshold: float) -> list[str]:
    issues = []
    if difference > threshold:
        issues.append("over_credited")
    elif difference < -threshold:
        issues.append("under_credited")
    if true_balance < -threshold:
        issues.append("overdrawn")
    if goal_mismatch:
        issues.append("goal_mismatch")
    return issues


async def campaign_money(db: AsyncSession, campaign: Campaign) -> dict:
    """The audit's figures for one campaign (the admin campaign page)."""
    breakdown = (await compute_expected_totals(db, [campaign.id])).get(campaign.id, ExpectedTotals())
    payouts = (
        await db.execute(select(Payout).where(Payout.campaign_id == campaign.id, Payout.status.in_(DEBITING_PAYOUT_STATUSES)))
    ).scalars().all()
    withdrawn = round(sum(payout_debit(payout) for payout in payouts), 2)
    adjusted = (await adjustments_by_campaign(db, [campaign.id])).get(campaign.id, 0.0)
    stored = round(campaign.amount_raised or 0.0, 2)
    expected = breakdown.expected
    difference = round(stored - expected, 2)
    true_balance = round(expected - withdrawn + adjusted, 2)
    goals = (await db.execute(select(CampaignGoal).where(CampaignGoal.campaign_id == campaign.id))).scalars().all()
    goal_mismatch = any(abs((g.amount_raised or 0.0) - breakdown.goals.get(g.id, 0.0)) > FLAG_THRESHOLD for g in goals)
    return {
        "amount_raised": stored,
        "donations_net": breakdown.donations_net,
        "promo_credit": breakdown.promo_credit,
        "expected": expected,
        "difference": difference,
        "withdrawn": withdrawn,
        "adjustments": adjusted,
        "balance": round(stored - withdrawn + adjusted, 2),
        "true_balance": true_balance,
        "issues": _issues(difference, true_balance, goal_mismatch, FLAG_THRESHOLD),
    }


async def build_campaign_audit(db: AsyncSession, *, threshold: float = FLAG_THRESHOLD, include_matched: bool = False) -> dict:
    """Per-campaign stored vs expected totals, withdrawals and balances.

    A campaign is flagged when its stored total differs from its records
    (over_credited / under_credited), when more has been withdrawn than it
    really raised (overdrawn), or when a goal's total differs (goal_mismatch).
    """
    campaigns = (await db.execute(select(Campaign).order_by(Campaign.id))).scalars().all()
    expected_by_campaign = await compute_expected_totals(db)

    withdrawn_by_campaign: dict[int, float] = {}
    payouts = (
        await db.execute(select(Payout).where(Payout.campaign_id.isnot(None), Payout.status.in_(DEBITING_PAYOUT_STATUSES)))
    ).scalars().all()
    for payout in payouts:
        withdrawn_by_campaign[payout.campaign_id] = round(withdrawn_by_campaign.get(payout.campaign_id, 0.0) + payout_debit(payout), 2)

    adjustments = await adjustments_by_campaign(db)

    goals_by_campaign: dict[int, list[CampaignGoal]] = {}
    for goal in (await db.execute(select(CampaignGoal))).scalars().all():
        goals_by_campaign.setdefault(goal.campaign_id, []).append(goal)

    rows = []
    totals = {"stored": 0.0, "expected": 0.0, "withdrawn": 0.0, "owed_to_campaigns": 0.0, "over_credited": 0.0, "overdrawn": 0.0}
    for campaign in campaigns:
        breakdown = expected_by_campaign.get(campaign.id, ExpectedTotals())
        stored = round(campaign.amount_raised or 0.0, 2)
        expected = breakdown.expected
        withdrawn = withdrawn_by_campaign.get(campaign.id, 0.0)
        adjusted = adjustments.get(campaign.id, 0.0)
        difference = round(stored - expected, 2)
        true_balance = round(expected - withdrawn + adjusted, 2)

        goal_rows = []
        for goal in goals_by_campaign.get(campaign.id, []):
            goal_expected = breakdown.goals.get(goal.id, 0.0)
            goal_stored = round(goal.amount_raised or 0.0, 2)
            if abs(goal_stored - goal_expected) > threshold:
                goal_rows.append({
                    "goal_id": goal.id,
                    "title": goal.title,
                    "amount_raised": goal_stored,
                    "expected": goal_expected,
                    "difference": round(goal_stored - goal_expected, 2),
                })

        issues = _issues(difference, true_balance, bool(goal_rows), threshold)

        totals["stored"] += stored
        totals["expected"] += expected
        totals["withdrawn"] += withdrawn
        totals["owed_to_campaigns"] += max(stored - withdrawn + adjusted, 0.0)
        totals["over_credited"] += max(difference, 0.0)
        totals["overdrawn"] += max(-true_balance, 0.0)

        if issues or include_matched:
            rows.append({
                "campaign_id": campaign.id,
                "slug": campaign.slug,
                "title": campaign.title,
                "amount_raised": stored,
                "donations_net": breakdown.donations_net,
                "promo_credit": breakdown.promo_credit,
                "expected": expected,
                "difference": difference,
                "withdrawn": withdrawn,
                "adjustments": adjusted,
                "balance": round(stored - withdrawn + adjusted, 2),
                "true_balance": true_balance,
                "issues": issues,
                "goals": goal_rows,
            })

    flagged = sum(1 for row in rows if row["issues"])
    return {
        "generated_at": datetime.now(UTC).isoformat(),
        "summary": {
            "total_campaigns": len(campaigns),
            "flagged_campaigns": flagged,
            **{key: round(value, 2) for key, value in totals.items()},
            "commissions_written_off": await commissions_written_off(db),
            "fee_rate_mobile_money": settings.HEXAI_COLLECTION_FEE_PERCENT,
            "fee_rate_card": settings.HEXAI_CARD_COLLECTION_FEE_PERCENT,
        },
        "campaigns": rows,
    }


async def stored_total_is_backed(db: AsyncSession, campaign: Campaign) -> bool:
    """False when a campaign holds more than its records explain."""
    expected = (await compute_expected_totals(db, [campaign.id])).get(campaign.id, ExpectedTotals()).expected
    return round(campaign.amount_raised or 0.0, 2) <= expected + FLAG_THRESHOLD


async def correct_campaign_total(
    db: AsyncSession,
    *,
    campaign_id: int,
    expected_current: float,
    reason: str,
    admin: User,
) -> dict:
    """Set a campaign's (and its goals') stored totals to what the records
    support, and record who did it and why. `expected_current` is the stored
    total the admin saw; if it has moved since, nothing changes."""
    campaign = (
        await db.execute(
            select(Campaign).where(Campaign.id == campaign_id).with_for_update().execution_options(populate_existing=True)
        )
    ).scalars().first()
    if campaign is None:
        raise LookupError(f"Campaign {campaign_id} not found")

    previous = round(campaign.amount_raised or 0.0, 2)
    if abs(previous - round(expected_current, 2)) > TOLERANCE:
        raise TotalChangedError(f"The total changed from {expected_current:.2f} to {previous:.2f}; reload and review again")

    breakdown = (await compute_expected_totals(db, [campaign.id])).get(campaign.id, ExpectedTotals())
    campaign.amount_raised = breakdown.expected

    goal_changes = []
    goals = (
        await db.execute(
            select(CampaignGoal).where(CampaignGoal.campaign_id == campaign.id).with_for_update().execution_options(populate_existing=True)
        )
    ).scalars().all()
    for goal in goals:
        goal_expected = breakdown.goals.get(goal.id, 0.0)
        if abs((goal.amount_raised or 0.0) - goal_expected) > TOLERANCE:
            goal_changes.append(f"goal {goal.id}: {goal.amount_raised or 0:.2f} -> {goal_expected:.2f}")
            goal.amount_raised = goal_expected

    details = reason.strip()
    if goal_changes:
        details += " | " + "; ".join(goal_changes)
    db.add(AdminAuditLog(
        action_type=AuditActionType.CAMPAIGN_TOTAL_CORRECTED.value,
        performed_by_admin_id=admin.id,
        target_entity_type="Campaign",
        target_entity_id=campaign.id,
        campaign_id=campaign.id,
        description=f"Corrected amount raised for campaign {campaign.slug}",
        details=details,
        old_value=f"{previous:.2f}",
        new_value=f"{breakdown.expected:.2f}",
    ))
    await db.commit()

    logger.warning(
        "Campaign total corrected",
        extra={
            "action": "campaign_total_corrected",
            "campaign_id": campaign.id,
            "admin_user_id": admin.id,
            "previous": previous,
            "corrected": breakdown.expected,
        },
    )
    return {"campaign_id": campaign.id, "previous": previous, "corrected": breakdown.expected, "goal_changes": goal_changes}


async def write_off_overdraft(
    db: AsyncSession,
    *,
    campaign_id: int,
    expected_balance: float,
    reason: str,
    admin: User,
) -> dict:
    """Bring an overdrawn campaign back to a zero balance, paid for out of
    Kambeng's commissions. Only for a campaign whose stored total already
    matches its records (correct it first), and only for the overdraft the
    admin reviewed (`expected_balance`)."""
    campaign = (
        await db.execute(
            select(Campaign).where(Campaign.id == campaign_id).with_for_update().execution_options(populate_existing=True)
        )
    ).scalars().first()
    if campaign is None:
        raise LookupError(f"Campaign {campaign_id} not found")

    expected = (await compute_expected_totals(db, [campaign.id])).get(campaign.id, ExpectedTotals()).expected
    if abs(round(campaign.amount_raised or 0.0, 2) - expected) > FLAG_THRESHOLD:
        raise WriteOffNotAllowedError("Correct the campaign's raised amount before writing off its overdraft")

    payouts = (
        await db.execute(select(Payout).where(Payout.campaign_id == campaign.id, Payout.status.in_(DEBITING_PAYOUT_STATUSES)))
    ).scalars().all()
    withdrawn = sum(payout_debit(payout) for payout in payouts)
    adjusted = (await adjustments_by_campaign(db, [campaign.id])).get(campaign.id, 0.0)
    balance = round(expected - withdrawn + adjusted, 2)

    if balance > -FLAG_THRESHOLD:
        raise WriteOffNotAllowedError("This campaign is not overdrawn")
    if abs(balance - round(expected_balance, 2)) > TOLERANCE:
        raise TotalChangedError(f"The balance changed from {expected_balance:.2f} to {balance:.2f}; reload and review again")

    amount = round(-balance, 2)
    db.add(CampaignBalanceAdjustment(
        campaign_id=campaign.id,
        amount=amount,
        funded_by="COMMISSIONS",
        reason=reason.strip(),
        created_by_admin_id=admin.id,
    ))
    db.add(AdminAuditLog(
        action_type=AuditActionType.CAMPAIGN_OVERDRAFT_WRITTEN_OFF.value,
        performed_by_admin_id=admin.id,
        target_entity_type="Campaign",
        target_entity_id=campaign.id,
        campaign_id=campaign.id,
        description=f"Wrote off {amount:.2f} GMD overdraft on campaign {campaign.slug} against commissions",
        details=reason.strip(),
        old_value=f"{balance:.2f}",
        new_value="0.00",
    ))
    await db.commit()

    logger.warning(
        "Campaign overdraft written off",
        extra={"action": "campaign_overdraft_written_off", "campaign_id": campaign.id, "admin_user_id": admin.id, "amount": amount},
    )
    return {"campaign_id": campaign.id, "written_off": amount, "previous_balance": balance}


async def run_daily_campaign_audit() -> None:
    """Scheduled job: email admins when any campaign's money doesn't add up."""
    from app.db.database import AsyncSessionLocal
    from app.services.email_service import send_email

    async with AsyncSessionLocal() as db:
        report = await build_campaign_audit(db)
        flagged = report["campaigns"]
        if not flagged:
            logger.info("Campaign audit clean", extra={"action": "campaign_audit_clean"})
            return

        logger.error(
            "Campaign audit found discrepancies",
            extra={"action": "campaign_audit_flagged", "flagged": len(flagged), "summary": report["summary"]},
        )
        admins = (
            await db.execute(select(User.email).where(User.role == "ADMIN", User.email.isnot(None)))
        ).scalars().all()

    rows = "".join(
        f"<tr><td>{row['campaign_id']}</td><td>{row['slug']}</td><td>{row['amount_raised']:.2f}</td>"
        f"<td>{row['expected']:.2f}</td><td>{row['withdrawn']:.2f}</td><td>{', '.join(row['issues'])}</td></tr>"
        for row in flagged
    )
    html = (
        f"<p>The daily money audit flagged {len(flagged)} campaign(s). Withdrawals are paused on any "
        f"campaign holding more than its records explain until an admin reviews it.</p>"
        f"<table border='1' cellpadding='4' cellspacing='0'><tr><th>ID</th><th>Campaign</th><th>Stored</th>"
        f"<th>Expected</th><th>Withdrawn</th><th>Issues</th></tr>{rows}</table>"
        f"<p>Review and correct them at {settings.FRONTEND_URL}/admin/reconciliations</p>"
    )
    for email in admins:
        send_email(email, f"Kambeng money audit: {len(flagged)} campaign(s) need review", html)
