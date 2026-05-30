#!/usr/bin/env python3
"""Backfill legacy proof objects from Kambeng/proofs/ into campaign-scoped folders.

The current upload path stores proofs at:
  Kambeng/campaigns/{campaign_id}/proofs/{file_name}

This script migrates older proof rows and bucket objects that still live at:
  Kambeng/proofs/{file_name}

It copies each legacy object into the campaign-scoped folder, updates the
database URL, and optionally deletes the old source object.

Usage:
  # Preview only
  python scripts/migrate_legacy_proof_objects.py

  # Apply changes and delete legacy source objects after successful copy
  python scripts/migrate_legacy_proof_objects.py --apply

  # Keep the old objects in place after copying
  python scripts/migrate_legacy_proof_objects.py --apply --keep-source
"""

from __future__ import annotations

import argparse
import asyncio
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlparse, unquote
import sys

import boto3
from botocore.exceptions import ClientError
from sqlalchemy import text

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.core.config import settings
from app.db.database import AsyncSessionLocal


LEGACY_PREFIX = "Kambeng/proofs/"


@dataclass
class MigrationStats:
    rows_scanned: int = 0
    rows_matched: int = 0
    rows_updated: int = 0
    objects_copied: int = 0
    objects_deleted: int = 0
    objects_delete_failed: int = 0
    objects_skipped: int = 0


@dataclass
class StorageConfig:
    bucket: str
    region: str
    endpoint: str
    public_endpoint: str
    access_key: str
    secret_key: str


def _public_endpoint(config: StorageConfig) -> str:
    endpoint = config.public_endpoint.strip()
    if endpoint:
        return endpoint.rstrip("/")

    return f"https://{config.bucket}.{config.region}.digitaloceanspaces.com"


def _build_public_url(config: StorageConfig, key: str) -> str:
    return f"{_public_endpoint(config)}/{key}"


def _extract_key(file_url: str) -> str | None:
    parsed = urlparse(file_url)
    path = unquote(parsed.path.lstrip("/"))

    if LEGACY_PREFIX in path:
        return path[path.index(LEGACY_PREFIX) :]

    if path.startswith(LEGACY_PREFIX):
        return path

    return None


def _resolve_destination_key(campaign_id: int, file_url: str) -> str:
    file_name = Path(urlparse(file_url).path).name
    return f"Kambeng/campaigns/{campaign_id}/proofs/{file_name}"


def _build_s3_client(config: StorageConfig):
    return boto3.client(
        "s3",
        region_name=config.region,
        endpoint_url=config.endpoint,
        aws_access_key_id=config.access_key,
        aws_secret_access_key=config.secret_key,
    )


async def migrate(apply: bool, keep_source: bool, config: StorageConfig) -> MigrationStats:
    stats = MigrationStats()
    s3 = _build_s3_client(config)

    async with AsyncSessionLocal() as session:
        rows = (
            await session.execute(
                text(
                    """
                    SELECT id, campaign_id, file_url
                    FROM proofs
                    WHERE file_url LIKE :legacy_pattern
                    ORDER BY id
                    """
                ),
                {"legacy_pattern": f"%{LEGACY_PREFIX}%"},
            )
        ).mappings().all()
        stats.rows_scanned = len(rows)

        for proof in rows:
            source_key = _extract_key(str(proof["file_url"]))
            if not source_key:
                continue

            stats.rows_matched += 1
            campaign_id = int(proof["campaign_id"])
            destination_key = _resolve_destination_key(campaign_id, str(proof["file_url"]))
            destination_url = _build_public_url(config, destination_key)

            print(f"[DB] proof_id={proof['id']} {proof['file_url']} -> {destination_url}")

            if not apply:
                continue

            try:
                s3.head_object(Bucket=settings.DO_SPACES_BUCKET, Key=destination_key)
                destination_exists = True
            except ClientError as exc:
                error_code = str(exc.response.get("Error", {}).get("Code", ""))
                destination_exists = error_code in {"404", "NoSuchKey", "NotFound"}

            if not destination_exists:
                s3.copy_object(
                    Bucket=config.bucket,
                    CopySource={"Bucket": config.bucket, "Key": source_key},
                    Key=destination_key,
                    MetadataDirective="COPY",
                )
                stats.objects_copied += 1
            else:
                stats.objects_skipped += 1

            if not keep_source and source_key != destination_key:
                try:
                    s3.delete_object(Bucket=config.bucket, Key=source_key)
                    stats.objects_deleted += 1
                except ClientError as exc:
                    print(f"[WARN] Failed to delete legacy object {source_key}: {exc}")
                    stats.objects_delete_failed += 1

            await session.execute(
                text("UPDATE proofs SET file_url = :file_url WHERE id = :id"),
                {"file_url": destination_url, "id": int(proof["id"])},
            )
            stats.rows_updated += 1

        if apply and stats.rows_updated > 0:
            await session.commit()

    return stats


async def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill legacy proof objects into campaign-scoped folders")
    parser.add_argument("--apply", action="store_true", help="Apply changes. Without this flag, runs in dry-run mode.")
    parser.add_argument(
        "--keep-source",
        action="store_true",
        help="Keep the legacy source object after copying. The default is to delete it after a successful migration.",
    )
    parser.add_argument("--bucket", default=settings.DO_SPACES_BUCKET, help="Spaces bucket name")
    parser.add_argument("--region", default=settings.DO_SPACES_REGION, help="Spaces region, e.g. lon1")
    parser.add_argument("--endpoint", default=settings.DO_SPACES_ENDPOINT, help="S3-compatible API endpoint")
    parser.add_argument(
        "--public-endpoint",
        default=settings.DO_SPACES_PUBLIC_ENDPOINT,
        help="Public bucket endpoint used to build stored proof URLs",
    )
    args = parser.parse_args()

    apply = args.apply
    config = StorageConfig(
        bucket=args.bucket,
        region=args.region,
        endpoint=args.endpoint,
        public_endpoint=args.public_endpoint,
        access_key=settings.DO_SPACES_KEY,
        secret_key=settings.DO_SPACES_SECRET,
    )

    stats = await migrate(apply=apply, keep_source=args.keep_source, config=config)

    mode = "APPLY" if apply else "DRY-RUN"
    print(f"Running migration in {mode} mode")
    print(f"- bucket: {config.bucket}")
    print(f"- region: {config.region}")
    print(f"- endpoint: {config.endpoint}")
    print(f"- public endpoint: {config.public_endpoint or '(derived from bucket/region)'}")
    print(f"- rows scanned: {stats.rows_scanned}")
    print(f"- rows matched: {stats.rows_matched}")
    print(f"- rows updated: {stats.rows_updated}")
    print(f"- objects copied: {stats.objects_copied}")
    print(f"- objects deleted: {stats.objects_deleted}")
    print(f"- objects delete failed: {stats.objects_delete_failed}")
    print(f"- objects skipped: {stats.objects_skipped}")

    if not apply:
        print("\nNo changes were written. Re-run with --apply to execute the migration.")


if __name__ == "__main__":
    asyncio.run(main())