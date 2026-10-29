#!/usr/bin/env python3
"""Set a private ACL on every KYC object in Spaces.

KYC documents used to be uploaded as public-read. New uploads are private and
are only served through /api/media/presign; this repairs the existing ones.

Usage:
  # Preview only
  python scripts/make_kyc_objects_private.py

  # Apply changes
  python scripts/make_kyc_objects_private.py --apply
"""

from __future__ import annotations

import argparse
from pathlib import Path
import sys

from botocore.exceptions import ClientError

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.services.do_spaces_strategy import DOSpacesStrategy


def main() -> None:
    parser = argparse.ArgumentParser(description="Make KYC objects in Spaces private")
    parser.add_argument("--apply", action="store_true", help="Change ACLs (default is a dry run)")
    args = parser.parse_args()

    storage = DOSpacesStrategy()
    prefix = storage._key("kyc") + "/"
    paginator = storage.s3_client.get_paginator("list_objects_v2")

    found = updated = 0
    for page in paginator.paginate(Bucket=storage.bucket, Prefix=prefix):
        for obj in page.get("Contents", []):
            found += 1
            key = obj["Key"]
            if not args.apply:
                print(f"[DRY RUN] {key} -> private")
                continue
            try:
                storage.s3_client.put_object_acl(Bucket=storage.bucket, Key=key, ACL="private")
                updated += 1
                print(f"[ACL] {key} -> private")
            except ClientError as exc:
                print(f"[WARN] {key}: {exc}")

    print(f"Found {found} KYC objects under {prefix}; updated {updated}")


if __name__ == "__main__":
    main()
