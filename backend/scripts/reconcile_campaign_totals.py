#!/usr/bin/env python3
"""Compare campaign.amount_raised against succeeded donation totals.

Usage:
  python scripts/reconcile_campaign_totals.py --threshold 0.01
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db.database import AsyncSessionLocal
from app.services.payment_reconciliation import build_campaign_amount_reconciliation


async def run_reconciliation(threshold: float) -> dict[str, Any]:
    async with AsyncSessionLocal() as session:
        return await build_campaign_amount_reconciliation(session, threshold=threshold)


def main() -> None:
    parser = argparse.ArgumentParser(description="Reconcile campaign totals with donation sums.")
    parser.add_argument("--threshold", type=float, default=0.01, help="Absolute difference allowed before a campaign is flagged")
    parser.add_argument("--json", action="store_true", help="Print the full report as JSON")
    args = parser.parse_args()

    report = asyncio.run(run_reconciliation(args.threshold))

    if args.json:
        print(json.dumps(report, indent=2))
        return

    summary = report["summary"]
    print(
        "Campaign reconciliation: "
        f"checked={summary['total_campaigns']} "
        f"matched={summary['matched_campaigns']} "
        f"mismatched={summary['mismatched_campaigns']} "
        f"campaign_total={summary['total_campaign_amount_raised']:.2f} "
        f"donation_total={summary['total_donation_sum']:.2f} "
        f"difference={summary['difference']:.2f}"
    )

    if not report["discrepancies"]:
        print("No discrepancies found.")
        return

    print("Discrepancies:")
    for item in report["discrepancies"]:
        print(
            f"- campaign_id={item['campaign_id']} slug={item['slug']} "
            f"raised={item['amount_raised']:.2f} donations={item['donation_sum']:.2f} diff={item['difference']:.2f}"
        )


if __name__ == "__main__":
    main()