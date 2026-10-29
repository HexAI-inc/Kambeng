#!/usr/bin/env python3
"""Explain where a campaign's amount_raised comes from.

Lists every donation (with status and the net it credited), every promo
credit (fee waivers and matches) and every rebate ledger entry, then compares
their sum with the stored campaign.amount_raised.

Usage:
  python scripts/explain_campaign_total.py <slug-or-id>
"""

from __future__ import annotations

import argparse
import asyncio
import importlib
import pkgutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import or_, select

import app.models

# Relationships refer to models by name, so every model module must be loaded.
for _module in pkgutil.iter_modules(app.models.__path__):
    importlib.import_module(f"app.models.{_module.name}")

from app.db.database import AsyncSessionLocal
from app.models.campaign import Campaign
from app.models.donation import Donation
from app.models.ledger import TransactionLedger, TransactionType
from app.models.promotion import PromoApplication, Promotion
from app.services.fees import collection_fee as fee_for_collection
from app.services.money import floor_dalasi


async def explain(slug_or_id: str) -> None:
    async with AsyncSessionLocal() as session:
        query = select(Campaign).where(Campaign.slug == slug_or_id)
        if slug_or_id.isdigit():
            query = select(Campaign).where(or_(Campaign.id == int(slug_or_id), Campaign.slug == slug_or_id))
        campaign = (await session.execute(query)).scalars().first()
        if campaign is None:
            print(f"No campaign found for {slug_or_id!r}")
            return

        print(f"Campaign {campaign.id} ({campaign.slug}) stored amount_raised={campaign.amount_raised or 0:.2f}\n")

        donations = (
            await session.execute(
                select(Donation).where(Donation.campaign_id == campaign.id).order_by(Donation.id)
            )
        ).scalars().all()
        donation_net = 0.0
        print("Donations:")
        for d in donations:
            net = floor_dalasi(d.amount - fee_for_collection(d.amount, d.provider)) if d.status == "SUCCEEDED" else 0.0
            donation_net += net
            print(
                f"  id={d.id} ref={d.client_reference} amount={d.amount:.2f} provider={d.provider} "
                f"status={d.status} source={d.reconciliation_source} at={d.reconciled_at} credited_net={net:.2f}"
            )

        applications = (
            await session.execute(
                select(PromoApplication, Promotion)
                .join(Promotion, Promotion.id == PromoApplication.promotion_id)
                .where(PromoApplication.campaign_id == campaign.id)
                .order_by(PromoApplication.id)
            )
        ).all()
        promo_credit = 0.0
        print("\nPromo credits:")
        for application, promo in applications:
            credit = (application.fee_waived_amount or 0.0) + (application.match_contributed_amount or 0.0)
            if not application.reversed:
                promo_credit += credit
            print(
                f"  promo={promo.name!r} type={promo.promo_type} donation_id={application.donation_id} "
                f"fee_waived={application.fee_waived_amount or 0:.2f} match={application.match_contributed_amount or 0:.2f} "
                f"reversed={application.reversed}"
            )
        if not applications:
            print("  (none)")

        rebates = (
            await session.execute(
                select(TransactionLedger).where(
                    TransactionLedger.campaign_id == campaign.id,
                    # Promo rebates are the only REFUND-type credits to a campaign.
                    TransactionLedger.transaction_type == TransactionType.REFUND,
                )
            )
        ).scalars().all()
        rebate_credit = sum(r.net_amount or 0.0 for r in rebates)
        print("\nRebates:")
        for r in rebates:
            print(f"  id={r.id} amount={r.net_amount or 0:.2f} {r.description}")
        if not rebates:
            print("  (none)")

        explained = round(donation_net + promo_credit + rebate_credit, 2)
        stored = round(campaign.amount_raised or 0.0, 2)
        print(
            f"\nDonations net={donation_net:.2f} + promo credit={promo_credit:.2f} + rebates={rebate_credit:.2f} "
            f"= {explained:.2f}; stored={stored:.2f}; unexplained={stored - explained:.2f}"
        )


def main() -> None:
    parser = argparse.ArgumentParser(description="Break down a campaign's amount_raised.")
    parser.add_argument("campaign", help="Campaign slug or numeric id")
    args = parser.parse_args()
    asyncio.run(explain(args.campaign))


if __name__ == "__main__":
    main()
