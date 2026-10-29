"""In-process sliding-window rate limits for sensitive endpoints.

The API runs as a single uvicorn process behind nginx, so per-process memory is
enough. Client IPs come from uvicorn's --proxy-headers (see docker-compose.yml).
"""

import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request, status

from app.core.config import settings

_hits: dict[tuple[str, str], deque[float]] = defaultdict(deque)


def rate_limit(name: str, limit: int, window_seconds: int):
    """Dependency allowing `limit` requests per client IP per `window_seconds` for `name`."""

    async def dependency(request: Request) -> None:
        if settings.ENVIRONMENT.lower() == "test":
            return
        client_ip = request.client.host if request.client else "unknown"
        now = time.monotonic()
        hits = _hits[(name, client_ip)]
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
