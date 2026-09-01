from datetime import UTC, datetime, timedelta
from decimal import Decimal

from app.schemas.common import MarketQuote
from app.services.alerts import can_trigger, condition_matches, observed_value


def quote() -> MarketQuote:
    return MarketQuote(
        symbol="600519.SH",
        name="贵州茅台",
        price=Decimal("1680"),
        change=Decimal("12"),
        change_percent=Decimal("0.72"),
        volume=Decimal("100000"),
        net_inflow=Decimal("1200000"),
        source="test",
        as_of=datetime(2026, 9, 2, tzinfo=UTC),
    )


def test_observed_value_maps_supported_alert_conditions():
    snapshot = quote()
    assert observed_value("price_above", snapshot) == Decimal("1680")
    assert observed_value("inflow_above", snapshot) == Decimal("1200000")
    assert observed_value("change_percent_above", snapshot) == Decimal("0.72")


def test_condition_matches_uses_inclusive_thresholds():
    assert condition_matches("price_above", Decimal("10"), Decimal("10"))
    assert condition_matches("price_below", Decimal("10"), Decimal("10"))
    assert condition_matches("inflow_above", Decimal("10"), Decimal("10"))
    assert not condition_matches("unknown", Decimal("10"), Decimal("1"))


def test_once_alert_can_trigger_again_only_without_history():
    now = datetime(2026, 9, 2, 10, tzinfo=UTC)
    previous = now - timedelta(days=1)
    assert can_trigger(frequency="once", last_triggered_at=previous, now=now) is True


def test_recurring_alerts_respect_frequency_windows():
    now = datetime(2026, 9, 2, 10, tzinfo=UTC)
    assert not can_trigger(frequency="hourly", last_triggered_at=now - timedelta(minutes=59), now=now)
    assert can_trigger(frequency="hourly", last_triggered_at=now - timedelta(hours=1), now=now)
    assert not can_trigger(frequency="daily", last_triggered_at=now - timedelta(hours=23), now=now)
    assert can_trigger(frequency="daily", last_triggered_at=now - timedelta(days=1), now=now)
