#!/usr/bin/env python3
"""Smoke-test API endpoints via OpenAPI and report endpoint-level failures.

Usage:
  python scripts/api_endpoint_smoke_test.py --base-url http://127.0.0.1:8001
"""

from __future__ import annotations

import argparse
import json
import os
from dataclasses import dataclass
from typing import Any

import httpx


DEFAULT_PARAM_VALUES = {
    "campaign_id": "1",
    "submission_id": "1",
    "review_id": "1",
    "report_id": "1",
    "alias_id": "1",
    "slug": "test-campaign",
    "short_code": "testcode",
    "id": "1",
}

METHODS = ["get", "post", "put", "patch", "delete"]


@dataclass
class EndpointResult:
    method: str
    path: str
    status_code: int | None
    outcome: str
    detail: str


def _guess_path_value(name: str) -> str:
    return DEFAULT_PARAM_VALUES.get(name, "1")


def _build_url(base_url: str, raw_path: str) -> str:
    path = raw_path
    for part in raw_path.split("{"):
        if "}" not in part:
            continue
        name = part.split("}", 1)[0]
        path = path.replace("{" + name + "}", _guess_path_value(name))
    return base_url.rstrip("/") + path


def _minimal_json_body(operation: dict[str, Any], openapi: dict[str, Any]) -> dict[str, Any] | None:
    request_body = operation.get("requestBody", {})
    content = request_body.get("content", {})
    json_schema = content.get("application/json", {}).get("schema")
    if not json_schema:
        return None

    if "$ref" in json_schema:
        ref = json_schema["$ref"]
        key = ref.split("/")[-1]
        json_schema = openapi.get("components", {}).get("schemas", {}).get(key, {})

    properties = json_schema.get("properties", {})
    required = set(json_schema.get("required", []))
    payload: dict[str, Any] = {}

    for prop, spec in properties.items():
        typ = spec.get("type")
        if "enum" in spec and spec["enum"]:
            payload[prop] = spec["enum"][0]
        elif typ == "string":
            if spec.get("format") == "email":
                payload[prop] = "smoke@example.com"
            else:
                payload[prop] = "smoke-test"
        elif typ == "integer":
            payload[prop] = 1
        elif typ == "number":
            payload[prop] = 1
        elif typ == "boolean":
            payload[prop] = True
        elif typ == "array":
            payload[prop] = []
        elif typ == "object":
            payload[prop] = {}

        if prop not in required and prop not in payload:
            payload[prop] = "smoke-test"

    return payload if payload else None


def _collect_query_params(operation: dict[str, Any]) -> dict[str, str]:
    params: dict[str, str] = {}
    for param in operation.get("parameters", []):
        if param.get("in") != "query":
            continue
        name = param.get("name")
        schema = param.get("schema", {})
        required = bool(param.get("required", False))
        if not name:
            continue

        # Avoid poisoning optional filters with arbitrary values.
        # For optional query params, send only explicit defaults.
        if not required and "default" not in schema:
            continue

        if "default" in schema:
            params[name] = str(schema["default"])
        elif "enum" in schema and schema["enum"]:
            params[name] = str(schema["enum"][0])
        elif schema.get("type") in {"integer", "number"}:
            params[name] = "1"
        elif schema.get("type") == "boolean":
            params[name] = "true"
        else:
            params[name] = "smoke"
    return params


def _login_and_get_token(client: httpx.Client, base_url: str, username: str, password: str) -> str | None:
    try:
        resp = client.post(
            base_url.rstrip("/") + "/api/auth/login",
            data={"username": username, "password": password},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=15,
        )
    except Exception:
        return None

    if resp.status_code != 200:
        return None

    try:
        body = resp.json()
        return body["data"]["tokens"]["accessToken"]
    except Exception:
        return None


def run_smoke_test(base_url: str, username: str, password: str, timeout: float) -> dict[str, Any]:
    results: list[EndpointResult] = []

    with httpx.Client(timeout=timeout, follow_redirects=False) as client:
        openapi_url = base_url.rstrip("/") + "/openapi.json"
        openapi = client.get(openapi_url).json()

        token = _login_and_get_token(client, base_url, username, password)
        headers = {"Authorization": f"Bearer {token}"} if token else {}

        paths = openapi.get("paths", {})
        for raw_path, path_item in paths.items():
            for method in METHODS:
                operation = path_item.get(method)
                if not operation:
                    continue

                url = _build_url(base_url, raw_path)
                query = _collect_query_params(operation)
                body = _minimal_json_body(operation, openapi)

                request_headers = dict(headers)
                if body is not None:
                    request_headers["Content-Type"] = "application/json"

                try:
                    response = client.request(
                        method.upper(),
                        url,
                        params=query if query else None,
                        json=body,
                        headers=request_headers,
                    )
                    status_code = response.status_code
                    if status_code >= 500:
                        outcome = "FAIL"
                        detail = f"Server error: {status_code}"
                    elif status_code in {401, 403, 404, 405, 409, 422}:
                        outcome = "SKIP"
                        detail = f"Expected/acceptable non-success: {status_code}"
                    elif 200 <= status_code < 300:
                        outcome = "PASS"
                        detail = f"Success: {status_code}"
                    else:
                        outcome = "WARN"
                        detail = f"Unexpected status: {status_code}"

                    results.append(
                        EndpointResult(
                            method=method.upper(),
                            path=raw_path,
                            status_code=status_code,
                            outcome=outcome,
                            detail=detail,
                        )
                    )
                except Exception as exc:
                    results.append(
                        EndpointResult(
                            method=method.upper(),
                            path=raw_path,
                            status_code=None,
                            outcome="FAIL",
                            detail=f"Request exception: {exc}",
                        )
                    )

    summary = {
        "total": len(results),
        "pass": sum(1 for r in results if r.outcome == "PASS"),
        "skip": sum(1 for r in results if r.outcome == "SKIP"),
        "warn": sum(1 for r in results if r.outcome == "WARN"),
        "fail": sum(1 for r in results if r.outcome == "FAIL"),
        "failed_endpoints": [
            {
                "method": r.method,
                "path": r.path,
                "status_code": r.status_code,
                "detail": r.detail,
            }
            for r in results
            if r.outcome == "FAIL"
        ],
        "results": [r.__dict__ for r in results],
    }
    return summary


def main() -> None:
    parser = argparse.ArgumentParser(description="Smoke test all OpenAPI endpoints and report failures.")
    parser.add_argument("--base-url", default="http://127.0.0.1:8001", help="API base URL")
    parser.add_argument("--admin-username", default=os.getenv("SMOKE_ADMIN_USERNAME", "+2207000000"))
    parser.add_argument("--admin-password", default=os.getenv("SMOKE_ADMIN_PASSWORD", "AdminPass123!"))
    parser.add_argument("--timeout", type=float, default=15.0)
    parser.add_argument(
        "--output",
        default="smoke_test_report.json",
        help="Path to write JSON report",
    )
    args = parser.parse_args()

    report = run_smoke_test(
        base_url=args.base_url,
        username=args.admin_username,
        password=args.admin_password,
        timeout=args.timeout,
    )

    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    print(f"Smoke test complete: total={report['total']} pass={report['pass']} skip={report['skip']} warn={report['warn']} fail={report['fail']}")
    print(f"Detailed report written to: {args.output}")

    if report["failed_endpoints"]:
        print("\nFailed endpoints:")
        for item in report["failed_endpoints"]:
            print(f"- {item['method']} {item['path']} -> {item['status_code']} ({item['detail']})")


if __name__ == "__main__":
    main()
