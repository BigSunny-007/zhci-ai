from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

SHANGHAI_TZ = ZoneInfo("Asia/Shanghai")
MORNING_OPEN = time(9, 30)
MORNING_CLOSE = time(11, 30)
AFTERNOON_OPEN = time(13, 0)
AFTERNOON_CLOSE = time(15, 0)
RECOMMENDATION_SLOTS = ((10, 0), (11, 0), (14, 0))


def to_shanghai(value: datetime | None = None) -> datetime:
    current = value or datetime.now(SHANGHAI_TZ)
    if current.tzinfo is None:
        return current.replace(tzinfo=SHANGHAI_TZ)
    return current.astimezone(SHANGHAI_TZ)


def is_trading_day(value: datetime | None = None, holidays: set[str] | None = None) -> bool:
    current = to_shanghai(value)
    return current.weekday() < 5 and current.date().isoformat() not in (holidays or set())


def market_session(value: datetime | None = None, holidays: set[str] | None = None) -> str:
    current = to_shanghai(value)
    if not is_trading_day(current, holidays):
        return "closed"
    current_time = current.time().replace(tzinfo=None)
    if MORNING_OPEN <= current_time < MORNING_CLOSE:
        return "morning"
    if AFTERNOON_OPEN <= current_time < AFTERNOON_CLOSE:
        return "afternoon"
    if current_time < MORNING_OPEN:
        return "pre_open"
    return "closed"


def is_recommendation_slot(value: datetime | None = None, holidays: set[str] | None = None) -> bool:
    current = to_shanghai(value)
    return (
        is_trading_day(current, holidays)
        and (current.hour, current.minute) in RECOMMENDATION_SLOTS
    )


def next_recommendation_at(
    value: datetime | None = None, holidays: set[str] | None = None
) -> datetime | None:
    current = to_shanghai(value).replace(second=0, microsecond=0)
    blocked_days = holidays or set()
    for day_offset in range(0, 370):
        candidate_date = (current + timedelta(days=day_offset)).date()
        candidate = datetime.combine(candidate_date, time(0), tzinfo=SHANGHAI_TZ)
        if not is_trading_day(candidate, blocked_days):
            continue
        for hour, minute in RECOMMENDATION_SLOTS:
            slot = datetime.combine(candidate_date, time(hour, minute), tzinfo=SHANGHAI_TZ)
            if slot >= current:
                return slot
    return None
