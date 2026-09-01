from datetime import datetime

from app.core.trading_calendar import (
    is_recommendation_slot,
    is_trading_day,
    market_session,
    next_recommendation_at,
)


def shanghai(hour: int, minute: int, day: int = 1) -> datetime:
    return datetime(2026, 9, day, hour, minute, tzinfo=None)


def test_trading_windows_and_hourly_recommendation_slots():
    assert market_session(shanghai(9, 29)) == "pre_open"
    assert market_session(shanghai(9, 30)) == "morning"
    assert market_session(shanghai(13, 30)) == "afternoon"
    assert market_session(shanghai(15, 0)) == "closed"
    assert is_recommendation_slot(shanghai(10, 0))
    assert is_recommendation_slot(shanghai(14, 0))
    assert not is_recommendation_slot(shanghai(9, 30))


def test_weekends_and_holidays_are_blocked():
    saturday = shanghai(10, 0, day=5)
    assert not is_trading_day(saturday)
    assert market_session(shanghai(10, 0), {"2026-09-01"}) == "closed"


def test_next_recommendation_slot_rolls_forward():
    result = next_recommendation_at(shanghai(10, 15))
    assert result is not None
    assert (result.hour, result.minute) == (11, 0)
