#!/usr/bin/env python3
"""Set public-read ACL on all proof objects referenced by the database.

This repairs existing proof files in Spaces that were uploaded without a public ACL.
The script reads the current `proofs.file_url` values, extracts the Spaces key, and
applies `public-read` so the browser can open the returned URLs directly.

Usage:
  python scripts/make_proof_objects_public.py
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import unquote, urlparse
import sys

import boto3
from botocore.exceptions import ClientError
from sqlalchemy import text

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.core.config import settings
from app.db.database import AsyncSessionLocal


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


def _build_s3_client(config: StorageConfig):
    return boto3.client(
        "s3",
        region_name=config.region,
        endpoint_url=config.endpoint,
        aws_access_key_id=config.access_key,
        aws_secret_access_key=config.secret_key,
    )


def _extract_key(file_url: str) -> str | None:
    parsed = urlparse(file_url)
    path = unquote(parsed.path.lstrip("/"))

    if "/Kambeng/" in path:
        return path[path.index("Kambeng/") :]

    if path.startswith("Kambeng/"):
        return path

    return None


async def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(description="Make proof objects publicly readable in Spaces")
    parser.add_argument("--bucket", default=settings.DO_SPACES_BUCKET, help="Spaces bucket name")
    parser.add_argument("--region", default=settings.DO_SPACES_REGION, help="Spaces region, e.g. lon1")
    parser.add_argument("--endpoint", default=settings.DO_SPACES_ENDPOINT, help="S3-compatible API endpoint")
    parser.add_argument(
        "--public-endpoint",
        default=settings.DO_SPACES_PUBLIC_ENDPOINT,
        help="Public bucket endpoint used to build stored proof URLs",
    )
    args = parser.parse_args()

    config = StorageConfig(
        bucket=args.bucket,
        region=args.region,
        endpoint=args.endpoint,
        public_endpoint=args.public_endpoint,
        access_key=settings.DO_SPACES_KEY,
        secret_key=settings.DO_SPACES_SECRET,
    )
    s3 = _build_s3_client(config)

    async with AsyncSessionLocal() as session:
        rows = (
            await session.execute(
                text(
                    """
                    SELECT id, file_url
                    FROM proofs
                    WHERE file_url LIKE :spaces_pattern
                       OR file_url LIKE :legacy_pattern
                    ORDER BY id
                    """
                ),
                {
                    "spaces_pattern": "https://%/Kambeng/%",
                    "legacy_pattern": "%Kambeng/%",
                },
            )
        ).mappings().all()

        updated = 0
        for row in rows:
            key = _extract_key(str(row["file_url"]))
            if not key:
                continue

            try:
                s3.put_object_acl(Bucket=config.bucket, Key=key, ACL="public-read")
                updated += 1
                print(f"[ACL] proof_id={row['id']} {key} -> public-read ({_public_endpoint(config)}/{key})")
            except ClientError as exc:
                print(f"[WARN] proof_id={row['id']} {key}: {exc}")

        print(f"Updated ACLs for {updated} proof objects")


if __name__ == "__main__":
    asyncio.run(main())