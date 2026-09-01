from collections import defaultdict, deque
from threading import Lock
from time import monotonic

from fastapi import Depends, HTTPException, Request, status

from app.core.config import get_settings


class SlidingWindowRateLimiter:
    def __init__(self) -> None:
        self._events: defaultdict[str, deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def allow(self, key: str, limit: int, window_seconds: int = 60) -> tuple[bool, int]:
        now = monotonic()
        cutoff = now - window_seconds
        with self._lock:
            events = self._events[key]
            while events and events[0] <= cutoff:
                events.popleft()
            if len(events) >= limit:
                retry_after = max(1, int(events[0] + window_seconds - now + 0.999))
                return False, retry_after
            events.append(now)
            return True, 0

    def reset(self) -> None:
        with self._lock:
            self._events.clear()


limiter = SlidingWindowRateLimiter()


async def auth_rate_limit(request: Request) -> None:
    settings = get_settings()
    if not settings.rate_limit_enabled:
        return
    client_host = request.client.host if request.client else "unknown"
    key = f"auth:{client_host}:{request.url.path}"
    allowed, retry_after = limiter.allow(key, settings.auth_rate_limit_per_minute)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="请求过于频繁，请稍后再试",
            headers={"Retry-After": str(retry_after)},
        )


AuthRateLimit = Depends(auth_rate_limit)


async def market_rate_limit(request: Request) -> None:
    settings = get_settings()
    if not settings.rate_limit_enabled:
        return
    client_host = request.client.host if request.client else "unknown"
    key = f"market:{client_host}:{request.url.path}"
    allowed, retry_after = limiter.allow(key, settings.market_rate_limit_per_minute)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="行情请求过于频繁，请稍后再试",
            headers={"Retry-After": str(retry_after)},
        )


MarketRateLimit = Depends(market_rate_limit)
