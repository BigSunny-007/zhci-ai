from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from uuid import UUID

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Alert, AlertTrigger
from app.services.data.provider import MarketDataProvider


@dataclass(frozen=True)
class AlertCheckResult:
    checked_count: int
    suppressed_count: int
    failed_count: int
    triggers: list[AlertTrigger]


def observed_value(condition_type: str, quote: object) -> Decimal | None:
    field_by_condition = {
        "price_above": "price",
        "price_below": "price",
        "inflow_above": "net_inflow",
        "change_percent_above": "change_percent",
    }
    field = field_by_condition.get(condition_type)
    raw_value = getattr(quote, field, None) if field else None
    if raw_value is None:
        return None
    try:
        return Decimal(str(raw_value))
    except (ArithmeticError, ValueError):
        return None


def condition_matches(condition_type: str, observed: Decimal, threshold: Decimal) -> bool:
    if condition_type == "price_above" or condition_type == "inflow_above":
        return observed >= threshold
    if condition_type == "price_below":
        return observed <= threshold
    if condition_type == "change_percent_above":
        return observed >= threshold
    return False


def frequency_window(frequency: str) -> timedelta | None:
    return {"hourly": timedelta(hours=1), "daily": timedelta(days=1)}.get(frequency)


def can_trigger(
    *,
    frequency: str,
    last_triggered_at: datetime | None,
    now: datetime,
) -> bool:
    if last_triggered_at is None or frequency == "once":
        return True
    window = frequency_window(frequency)
    if window is None:
        return True
    last = (
        last_triggered_at
        if last_triggered_at.tzinfo
        else last_triggered_at.replace(tzinfo=UTC)
    )
    return now >= last + window


async def check_active_alerts(
    db: AsyncSession,
    provider: MarketDataProvider,
    *,
    user_id: UUID | None = None,
    now: datetime | None = None,
) -> AlertCheckResult:
    checked_at = now or datetime.now(UTC)
    conditions = [Alert.is_active.is_(True)]
    if user_id is not None:
        conditions.append(Alert.user_id == user_id)
    alerts = (
        await db.scalars(
            select(Alert)
            .where(*conditions)
            .where((Alert.expires_at.is_(None)) | (Alert.expires_at > checked_at))
            .order_by(Alert.created_at)
        )
    ).all()
    triggers: list[AlertTrigger] = []
    suppressed_count = 0
    failed_count = 0
    for alert in alerts:
        try:
            quote = await provider.quote(alert.symbol, alert.symbol)
            value = observed_value(alert.condition_type, quote)
            if value is None or not condition_matches(alert.condition_type, value, alert.threshold):
                continue
            last_trigger = await db.scalar(
                select(AlertTrigger)
                .where(AlertTrigger.alert_id == alert.id)
                .order_by(desc(AlertTrigger.triggered_at))
            )
            if not can_trigger(
                frequency=alert.frequency,
                last_triggered_at=last_trigger.triggered_at if last_trigger else None,
                now=checked_at,
            ):
                suppressed_count += 1
                continue
            trigger = AlertTrigger(
                alert_id=alert.id,
                user_id=alert.user_id,
                symbol=alert.symbol,
                condition_type=alert.condition_type,
                threshold=alert.threshold,
                observed_value=value,
                message=alert.message,
                source=quote.source,
                evidence={
                    "price": str(quote.price),
                    "net_inflow": str(quote.net_inflow),
                    "change_percent": str(quote.change_percent),
                    "as_of": quote.as_of.isoformat(),
                    "source": quote.source,
                },
                triggered_at=checked_at,
            )
            db.add(trigger)
            triggers.append(trigger)
            if alert.frequency == "once":
                alert.is_active = False
        except Exception:
            failed_count += 1
    return AlertCheckResult(
        checked_count=len(alerts),
        suppressed_count=suppressed_count,
        failed_count=failed_count,
        triggers=triggers,
    )
