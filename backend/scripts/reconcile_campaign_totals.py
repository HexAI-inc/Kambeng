#!/usr/bin/env python3
"""Audit every campaign's stored total against its donation and promo records.

Same report as the admin Reconciliation page (app/services/campaign_audit.py).

Usage:
  python scripts/reconcile_campaign_totals.py
  python scripts/reconcile_campaign_totals.py --json
"""

from __future__ import annotations

import argparse
import asyncio
import importlib
import json
import pkgutil
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import app.models

# Relationships refer to models by name, so every model module must be loaded.
for _module in pkgutil.iter_modules(app.models.__path__):
    importlib.import_module(f"app.models.{_module.name}")

from app.db.database import AsyncSessionLocal
from app.services.campaign_audit import build_campaign_audit


async def run_reconciliation(threshold: float) -> dict[str, Any]:
    async with AsyncSessionLocal() as session:
        return await build_campaign_audit(session, threshold=threshold)


def main() -> None:
    parser = argparse.ArgumentParser(description="Audit campaign totals against their records.")
    parser.add_argument("--threshold", type=float, default=0.99, help="Absolute difference allowed before a campaign is flagged (sub-dalasi drift is ignored)")
    parser.add_argument("--json", action="store_true", help="Print the full report as JSON")
    args = parser.parse_args()

    report = asyncio.run(run_reconciliation(args.threshold))

    if args.json:
        print(json.dumps(report, indent=2))
        return

    summary = report["summary"]
    print(
        f"Campaign audit: checked={summary['total_campaigns']} flagged={summary['flagged_campaigns']} "
        f"stored={summary['stored']:.2f} expected={summary['expected']:.2f} "
        f"over_credited={summary['over_credited']:.2f} overdrawn={summary['overdrawn']:.2f}"
    )
    if not report["campaigns"]:
        print("No discrepancies found.")
        return

    for row in report["campaigns"]:
        print(
            f"- campaign_id={row['campaign_id']} slug={row['slug']} stored={row['amount_raised']:.2f} "
            f"expected={row['expected']:.2f} withdrawn={row['withdrawn']:.2f} "
            f"true_balance={row['true_balance']:.2f} issues={','.join(row['issues'])}"
        )


if __name__ == "__main__":
    main()
