#!/usr/bin/env python3
"""
One-time migration: apply HexAI 2% collection fee to historical donation records.

Before this fix, campaign.amount_raised was credited with the full gross donation
amount. HexAI actually deducts 2% before settling, so amount_raised was overstated.

What this script does:
  1. For every campaign, recalculates amount_raised as:
       sum(donation.amount * (1 - fee_rate) for SUCCEEDED donations)
  2. Applies the same correction to every CampaignGoal.
  3. Fixes TransactionLedger entries (sets hexai_fee / net_amount on DONATION rows).

Usage:
  # Preview changes (safe, no writes):
  python scripts/fix_collection_fee_migration.py

  # Apply changes:
  python scripts/fix_collection_fee_migration.py --apply

  # Override fee rate (e.g. if rate changes later):
  python scripts/fix_collection_fee_migration.py --fee-rate 0.02 --apply
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


async def run(fee_rate: float, apply: bool) -> None:
    async with AsyncSessionLocal() as db:
        await migrate(db, fee_rate=fee_rate, apply=apply)
        if apply:
            await db.commit()
            print("\n✅ Changes committed to the database.")
        else:
            print("\n⚠️  DRY-RUN — no changes written. Pass --apply to commit.")


async def migrate(db: AsyncSession, fee_rate: float, apply: bool) -> None:
    print(f"Collection fee rate: {fee_rate * 100:.1f}%")
    print(f"Mode: {'APPLY' if apply else 'DRY-RUN'}\n")

    # ── 1. Build a map: campaign_id → net donations total ──────────────────────
    donations_result = await db.execute(
        select(Donation).where(Donation.status == "SUCCEEDED")
    )
    succeeded_donations = donations_result.scalars().all()

    # campaign totals: net sum of succeeded donations
    campaign_net: dict[int, float] = {}
    # goal totals: net sum of succeeded donations per goal
    goal_net: dict[int, float] = {}

    for d in succeeded_donations:
        net = round(d.amount * (1 - fee_rate), 2)
        campaign_net[d.campaign_id] = round(campaign_net.get(d.campaign_id, 0.0) + net, 2)
        if d.goal_id is not None:
            goal_net[d.goal_id] = round(goal_net.get(d.goal_id, 0.0) + net, 2)

    # ── 2. Update campaigns ────────────────────────────────────────────────────
    campaigns_result = await db.execute(select(Campaign))
    campaigns = campaigns_result.scalars().all()

    campaign_changes = 0
    for campaign in campaigns:
        correct = round(campaign_net.get(campaign.id, 0.0), 2)
        current = round(campaign.amount_raised or 0.0, 2)
        diff = round(correct - current, 2)
        if abs(diff) < 0.005:
            continue
        print(
            f"Campaign #{campaign.id} '{campaign.slug}': "
            f"{current:.2f} → {correct:.2f}  (Δ {diff:+.2f})"
        )
        if apply:
            campaign.amount_raised = correct
        campaign_changes += 1

    print(f"\nCampaigns to update: {campaign_changes}")

    # ── 3. Update goals ────────────────────────────────────────────────────────
    goals_result = await db.execute(select(CampaignGoal))
    goals = goals_result.scalars().all()

    goal_changes = 0
    for goal in goals:
        correct = round(goal_net.get(goal.id, 0.0), 2)
        current = round(goal.amount_raised or 0.0, 2)
        diff = round(correct - current, 2)
        if abs(diff) < 0.005:
            continue
        print(
            f"  Goal #{goal.id} '{goal.title}' (campaign #{goal.campaign_id}): "
            f"{current:.2f} → {correct:.2f}  (Δ {diff:+.2f})"
        )
        if apply:
            goal.amount_raised = correct
        goal_changes += 1

    print(f"Goals to update: {goal_changes}")

    # ── 4. Fix ledger donation entries ─────────────────────────────────────────
    ledger_result = await db.execute(
        select(TransactionLedger).where(
            TransactionLedger.transaction_type == TransactionType.DONATION,
            TransactionLedger.hexai_fee == 0.0,
        )
    )
    ledger_entries = ledger_result.scalars().all()

    ledger_changes = 0
    for entry in ledger_entries:
        gross = entry.gross_amount or 0.0
        correct_fee = round(gross * fee_rate, 2)
        correct_net = round(gross - correct_fee, 2)
        if abs(correct_fee) < 0.005:
            continue
        if apply:
            entry.hexai_fee = correct_fee
            entry.net_amount = correct_net
        ledger_changes += 1

    print(f"Ledger donation entries to fix: {ledger_changes}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Apply HexAI collection fee to historical records.")
    parser.add_argument("--fee-rate", type=float, default=0.02, help="Collection fee rate (default: 0.02 = 2%%)")
    parser.add_argument("--apply", action="store_true", help="Write changes to the database (default is dry-run)")
    args = parser.parse_args()

    asyncio.run(run(fee_rate=args.fee_rate, apply=args.apply))


if __name__ == "__main__":
    main()
