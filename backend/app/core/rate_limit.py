"""In-process sliding-window rate limits for sensitive endpoints.

The API runs as a single uvicorn process behind nginx, so per-process memory is
enough. Direct callers are identified by uvicorn's --proxy-headers (see
docker-compose.yml). Calls from the Next.js server (on Vercel) arrive from
Vercel's shared IPs, so that server names the browser's IP in
X-Kambeng-Client-IP, which is trusted only alongside INTERNAL_PROXY_SECRET.
"""

import hmac
import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request, status

from app.core.config import settings

_hits: dict[tuple[str, str], deque[float]] = defaultdict(deque)


def client_ip(request: Request) -> str:
    secret = settings.INTERNAL_PROXY_SECRET
    named_ip = request.headers.get("x-kambeng-client-ip", "").strip()
    presented = request.headers.get("x-kambeng-proxy-secret", "")
    if secret and named_ip and hmac.compare_digest(presented.encode(), secret.encode()):
        return named_ip
    return request.client.host if request.client else "unknown"


def rate_limit(name: str, limit: int, window_seconds: int):
    """Dependency allowing `limit` requests per client IP per `window_seconds` for `name`."""

    async def dependency(request: Request) -> None:
        if settings.ENVIRONMENT.lower() == "test":
            return
        now = time.monotonic()
        hits = _hits[(name, client_ip(request))]
        while hits and hits[0] <= now - window_seconds:
            hits.popleft()
        if len(hits) >= limit:
            retry_after = int(hits[0] + window_seconds - now) + 1
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many attempts. Please wait and try again.",
                headers={"Retry-After": str(retry_after)},
            )
        hits.append(now)

    return dependency
