#!/usr/bin/env python3
"""
One-time correction: re-record every settled donation under the real rail fee,
in whole dalasi.

Two things were wrong in the historical data:

  1. **Card donations were charged at 2%.** Waychit takes 6% on card payments.
     Every card donation therefore credited its campaign ~4% more than actually
     settled in the HexAI wallet — money the campaign could try to withdraw and
     that isn't there.
  2. **Amounts carried bututs.** Kambeng now deals in whole dalasi only, and
     every amount — fee, credit, payout — rounds down.

What this script does (all of it read-only until --apply):
  1. Recomputes campaign.amount_raised as the sum of the whole-dalasi net of
     every SUCCEEDED donation, using each donation's own rail for the rate.
  2. Applies the same recomputation to every CampaignGoal.
  3. Rewrites hexai_fee / net_amount on the matching DONATION ledger rows.

Promotional credits (matched donations, rebates, absorbed fees) are NOT part of
the donation sum, so a campaign that received them will legitimately show a
higher amount_raised than this computes. Review the printed deltas before
applying — the summary calls out how much of each delta is the card-rate fix.

Usage:
  python scripts/recompute_whole_dalasi_totals.py            # dry-run
  python scripts/recompute_whole_dalasi_totals.py --apply
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import AsyncSessionLocal
# Import ALL models first so SQLAlchemy can resolve every relationship string
import app.models.user  # noqa: F401
import app.models.kyc  # noqa: F401
import app.models.kyc_notification_email  # noqa: F401
import app.models.payout  # noqa: F401
import app.models.recurring_donation  # noqa: F401
import app.models.review  # noqa: F401
import app.models.proof  # noqa: F401
import app.models.campaign_update  # noqa: F401
import app.models.update_attachment  # noqa: F401
import app.models.campaign_goal  # noqa: F401
import app.models.fraud_report  # noqa: F401
import app.models.fraud_report_notification_email  # noqa: F401
import app.models.moderation  # noqa: F401
import app.models.audit_log  # noqa: F401
import app.models.aliases  # noqa: F401
import app.models.alias  # noqa: F401
from app.models.campaign import Campaign
from app.models.campaign_goal import CampaignGoal
from app.models.donation import Donation
from app.models.ledger import TransactionLedger, TransactionType
from app.services.fees import collection_fee, collection_fee_percent, is_card_provider
from app.services.money import floor_dalasi


def net_of(donation: Donation) -> float:
    fee = collection_fee(donation.amount, donation.provider)
    return floor_dalasi(donation.amount - fee)


async def run(apply: bool) -> None:
    async with AsyncSessionLocal() as db:
        await migrate(db, apply=apply)
        if apply:
            await db.commit()
            print("\n✅ Changes committed to the database.")
        else:
            print("\n⚠️  DRY-RUN — no changes written. Pass --apply to commit.")


async def migrate(db: AsyncSession, apply: bool) -> None:
    print(f"Mobile money: {collection_fee_percent('wave') * 100:.0f}%   "
          f"Card (Waychit): {collection_fee_percent('waychit_card') * 100:.0f}%")
    print(f"Mode: {'APPLY' if apply else 'DRY-RUN'}\n")

    donations_result = await db.execute(select(Donation).where(Donation.status == "SUCCEEDED"))
    succeeded = donations_result.scalars().all()

    campaign_net: dict[int, float] = {}
    goal_net: dict[int, float] = {}
    card_count = 0
    card_overcredit = 0.0

    for d in succeeded:
        net = net_of(d)
        campaign_net[d.campaign_id] = round(campaign_net.get(d.campaign_id, 0.0) + net, 2)
        if d.goal_id is not None:
            goal_net[d.goal_id] = round(goal_net.get(d.goal_id, 0.0) + net, 2)
        if is_card_provider(d.provider):
            card_count += 1
            # What the old flat 2% would have credited, minus the truth.
            card_overcredit += round(d.amount * 0.98, 2) - net

    print(f"Settled donations: {len(succeeded)}  (card: {card_count})")
    if card_count:
        print(f"Over-credit from the old 2% card rate: {card_overcredit:,.2f} GMD\n")

    # ── Campaigns ─────────────────────────────────────────────────────────────
    campaigns_result = await db.execute(select(Campaign))
    campaigns = campaigns_result.scalars().all()

    campaign_changes = 0
    for campaign in campaigns:
        correct = round(campaign_net.get(campaign.id, 0.0), 2)
        current = round(campaign.amount_raised or 0.0, 2)
        diff = round(correct - current, 2)
        if abs(diff) < 0.005:
            continue
        print(f"Campaign #{campaign.id} '{campaign.slug}': {current:.2f} → {correct:.2f}  (Δ {diff:+.2f})")
        if apply:
            campaign.amount_raised = correct
        campaign_changes += 1

    print(f"\nCampaigns to update: {campaign_changes}")

    # ── Goals ─────────────────────────────────────────────────────────────────
    goals_result = await db.execute(select(CampaignGoal))
    goals = goals_result.scalars().all()

    goal_changes = 0
    for goal in goals:
        correct = round(goal_net.get(goal.id, 0.0), 2)
        current = round(goal.amount_raised or 0.0, 2)
        diff = round(correct - current, 2)
        if abs(diff) < 0.005:
            continue
        print(f"  Goal #{goal.id} '{goal.title}' (campaign #{goal.campaign_id}): "
              f"{current:.2f} → {correct:.2f}  (Δ {diff:+.2f})")
        if apply:
            goal.amount_raised = correct
        goal_changes += 1

    print(f"Goals to update: {goal_changes}")

    # ── Ledger DONATION rows ──────────────────────────────────────────────────
    donation_by_reference = {d.client_reference: d for d in succeeded}
    ledger_result = await db.execute(
        select(TransactionLedger).where(TransactionLedger.transaction_type == TransactionType.DONATION)
    )
    ledger_changes = 0
    for entry in ledger_result.scalars().all():
        donation = donation_by_reference.get(entry.external_reference)
        if donation is None:
            continue  # pending/failed donation — no fee was ever settled
        correct_fee = collection_fee(donation.amount, donation.provider)
        correct_net = floor_dalasi(donation.amount - correct_fee)
        if abs((entry.hexai_fee or 0.0) - correct_fee) < 0.005 and abs((entry.net_amount or 0.0) - correct_net) < 0.005:
            continue
        if apply:
            entry.hexai_fee = correct_fee
            entry.net_amount = correct_net
        ledger_changes += 1

    print(f"Ledger donation entries to fix: {ledger_changes}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Re-record settled donations at the real rail fee, in whole dalasi.")
    parser.add_argument("--apply", action="store_true", help="Write changes to the database (default is dry-run)")
    args = parser.parse_args()

    asyncio.run(run(apply=args.apply))


if __name__ == "__main__":
    main()
