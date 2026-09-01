from app.services.rate_limit import SlidingWindowRateLimiter


def test_sliding_window_rejects_after_limit_and_returns_retry_hint():
    limiter = SlidingWindowRateLimiter()
    assert limiter.allow("client", limit=2, window_seconds=60)[0]
    assert limiter.allow("client", limit=2, window_seconds=60)[0]
    allowed, retry_after = limiter.allow("client", limit=2, window_seconds=60)
    assert not allowed
    assert retry_after >= 1


def test_rate_limiter_keys_are_isolated_and_resettable():
    limiter = SlidingWindowRateLimiter()
    assert limiter.allow("one", limit=1)[0]
    assert limiter.allow("two", limit=1)[0]
    limiter.reset()
    assert limiter.allow("one", limit=1)[0]
