#!/usr/bin/env python3
"""Test DigitalOcean Spaces credentials and bucket access.

Usage:
  python scripts/test_do_spaces_credentials.py
  python scripts/test_do_spaces_credentials.py --probe-write
  python scripts/test_do_spaces_credentials.py --bucket my-space --region lon1
"""

from __future__ import annotations

import argparse
import sys
from dataclasses import dataclass, asdict
from pathlib import Path
from time import time
from typing import Any
from uuid import uuid4

import boto3
from botocore.exceptions import ClientError, EndpointConnectionError, NoCredentialsError

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.core.config import settings


@dataclass
class CredentialProbeResult:
    ok: bool
    bucket: str
    region: str
    endpoint: str
    head_bucket_ok: bool = False
    write_probe_ok: bool = False
    details: str = ""


def _build_s3_client(endpoint: str, region: str, access_key: str, secret_key: str):
    return boto3.client(
        "s3",
        region_name=region,
        endpoint_url=endpoint,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
    )


def _normalize_region(region: str) -> str:
    return (region or "").strip().lower()


def _normalize_endpoint(endpoint: str) -> str:
    return (endpoint or "").strip().rstrip("/")


def _error_detail(exc: Exception) -> str:
    if isinstance(exc, ClientError):
        error = exc.response.get("Error", {})
        code = error.get("Code", "ClientError")
        message = error.get("Message", str(exc))
        return f"{code}: {message}"
    return str(exc)


def probe_credentials(
    *,
    bucket: str,
    region: str,
    endpoint: str,
    access_key: str,
    secret_key: str,
    probe_write: bool,
) -> CredentialProbeResult:
    s3 = _build_s3_client(endpoint, region, access_key, secret_key)
    result = CredentialProbeResult(ok=False, bucket=bucket, region=region, endpoint=endpoint)

    try:
        s3.head_bucket(Bucket=bucket)
        result.head_bucket_ok = True
    except (NoCredentialsError, EndpointConnectionError, ClientError) as exc:
        result.details = f"head_bucket failed: {_error_detail(exc)}"
        return result

    if probe_write:
        key = f"credential-probe/{int(time())}-{uuid4().hex}.txt"
        body = b"DO Spaces credential probe from kambeng backend"
        try:
            s3.put_object(Bucket=bucket, Key=key, Body=body)
            s3.delete_object(Bucket=bucket, Key=key)
            result.write_probe_ok = True
        except (NoCredentialsError, EndpointConnectionError, ClientError) as exc:
            result.details = f"write probe failed: {_error_detail(exc)}"
            return result

    result.ok = True
    result.details = "Credentials are valid and bucket access succeeded"
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description="Test DigitalOcean Spaces credentials and bucket access.")
    parser.add_argument("--bucket", default=settings.DO_SPACES_BUCKET, help="Spaces bucket / Space name")
    parser.add_argument("--region", default=settings.DO_SPACES_REGION, help="Spaces region, e.g. lon1")
    parser.add_argument("--endpoint", default=settings.DO_SPACES_ENDPOINT, help="S3-compatible endpoint URL")
    parser.add_argument("--probe-write", action="store_true", help="Upload and delete a temporary object")
    parser.add_argument("--json", action="store_true", help="Print machine-readable JSON output")
    args = parser.parse_args()

    bucket = str(args.bucket).strip()
    region = _normalize_region(str(args.region))
    endpoint = _normalize_endpoint(str(args.endpoint))

    if not settings.DO_SPACES_KEY or not settings.DO_SPACES_SECRET:
        print("DO Spaces credentials are missing. Set DO_SPACES_KEY and DO_SPACES_SECRET first.", file=sys.stderr)
        return 2

    result = probe_credentials(
        bucket=bucket,
        region=region,
        endpoint=endpoint,
        access_key=settings.DO_SPACES_KEY,
        secret_key=settings.DO_SPACES_SECRET,
        probe_write=bool(args.probe_write),
    )

    if args.json:
        import json

        print(json.dumps(asdict(result), indent=2, sort_keys=True))
    else:
        print(f"Bucket:   {result.bucket}")
        print(f"Region:   {result.region}")
        print(f"Endpoint: {result.endpoint}")
        print(f"head_bucket: {'OK' if result.head_bucket_ok else 'FAIL'}")
        if args.probe_write:
            print(f"write_probe: {'OK' if result.write_probe_ok else 'FAIL'}")
        print(f"Result:   {'OK' if result.ok else 'FAIL'}")
        if result.details:
            print(f"Details:  {result.details}")

    return 0 if result.ok else 1


if __name__ == "__main__":
    raise SystemExit(main())