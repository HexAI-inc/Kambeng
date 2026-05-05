#!/usr/bin/env python3
"""Migrate legacy local media paths from /media to /uploads.

What this script does:
1) Moves files from a legacy source directory (default: media/) to uploads/.
2) Rewrites `proofs.file_url` values from /media/... to /uploads/... (and absolute URLs containing /media/).

Usage:
  # Preview only
  python scripts/migrate_media_to_uploads.py

  # Apply changes
  python scripts/migrate_media_to_uploads.py --apply

  # Custom paths
  python scripts/migrate_media_to_uploads.py --apply --from-root media --to-root uploads
"""

from __future__ import annotations

import argparse
import asyncio
from dataclasses import dataclass
from pathlib import Path
import shutil
import sys

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from sqlalchemy import select

from app.db.database import AsyncSessionLocal
# Ensure SQLAlchemy relationship targets are registered before querying ORM models.
from app.models import campaign as _campaign  # noqa: F401
from app.models import donation as _donation  # noqa: F401
from app.models import kyc as _kyc  # noqa: F401
from app.models import payout as _payout  # noqa: F401
from app.models import proof as _proof  # noqa: F401
from app.models import review as _review  # noqa: F401
from app.models import user as _user  # noqa: F401
from app.models.proof import Proof


@dataclass
class MigrationStats:
    files_discovered: int = 0
    files_moved: int = 0
    db_rows_scanned: int = 0
    db_rows_updated: int = 0


def _rewrite_media_url(value: str) -> str:
    updated = value.replace("/media/", "/uploads/")
    # Handle edge case where URL ends with "/media" without trailing slash
    if updated.endswith("/media"):
        updated = updated[:-6] + "/uploads"
    return updated


def _resolve_unique_target(target_path: Path) -> Path:
    if not target_path.exists():
        return target_path

    stem = target_path.stem
    suffix = target_path.suffix
    parent = target_path.parent
    counter = 1
    while True:
        candidate = parent / f"{stem}_migrated_{counter}{suffix}"
        if not candidate.exists():
            return candidate
        counter += 1


def _collect_source_files(src_root: Path) -> list[Path]:
    if not src_root.exists() or not src_root.is_dir():
        return []
    return [p for p in src_root.rglob("*") if p.is_file()]


def migrate_files(src_root: Path, dst_root: Path, apply: bool) -> MigrationStats:
    stats = MigrationStats()
    source_files = _collect_source_files(src_root)
    stats.files_discovered = len(source_files)

    for source in source_files:
        relative = source.relative_to(src_root)
        raw_target = dst_root / relative
        target = _resolve_unique_target(raw_target)

        print(f"[FILE] {source} -> {target}")
        if apply:
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(str(source), str(target))
            stats.files_moved += 1

    return stats


async def migrate_db_urls(apply: bool) -> MigrationStats:
    stats = MigrationStats()

    async with AsyncSessionLocal() as session:
        rows = (await session.execute(select(Proof))).scalars().all()
        stats.db_rows_scanned = len(rows)

        for row in rows:
            original = row.file_url
            updated = _rewrite_media_url(original)
            if updated != original:
                print(f"[DB] proof_id={row.id} {original} -> {updated}")
                if apply:
                    row.file_url = updated
                    stats.db_rows_updated += 1

        if apply and stats.db_rows_updated > 0:
            await session.commit()

    return stats


async def main() -> None:
    parser = argparse.ArgumentParser(description="Migrate local media paths and DB URLs from /media to /uploads")
    parser.add_argument("--apply", action="store_true", help="Apply changes. Without this flag, runs in dry-run mode.")
    parser.add_argument("--from-root", default="media", help="Legacy source media root directory")
    parser.add_argument("--to-root", default="uploads", help="Destination uploads root directory")
    args = parser.parse_args()

    apply = args.apply
    src_root = Path(args.from_root)
    dst_root = Path(args.to_root)

    mode = "APPLY" if apply else "DRY-RUN"
    print(f"Running migration in {mode} mode")
    print(f"Source root: {src_root.resolve()}")
    print(f"Destination root: {dst_root.resolve()}")

    file_stats = migrate_files(src_root, dst_root, apply)
    db_stats = await migrate_db_urls(apply)

    print("\nMigration summary")
    print(f"- files discovered: {file_stats.files_discovered}")
    print(f"- files moved: {file_stats.files_moved}")
    print(f"- DB rows scanned (proofs): {db_stats.db_rows_scanned}")
    print(f"- DB rows updated (proofs.file_url): {db_stats.db_rows_updated}")

    if not apply:
        print("\nNo changes were written. Re-run with --apply to execute the migration.")


if __name__ == "__main__":
    asyncio.run(main())
