from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any

HORIZON_MATURITY = {
    "1d": timedelta(days=1),
    "1-2d": timedelta(days=2),
    "1-5d": timedelta(days=5),
    "medium": timedelta(days=20),
    "long": timedelta(days=60),
}


@dataclass(frozen=True)
class EvaluationOutcome:
    symbol: str
    evaluated_at: datetime
    realized_return: Decimal
    is_win: bool


def maturity_delta(horizon: str) -> timedelta:
    return HORIZON_MATURITY.get(horizon, HORIZON_MATURITY["1-5d"])


def is_mature(generated_at: datetime, now: datetime, horizon: str) -> bool:
    generated = generated_at if generated_at.tzinfo else generated_at.replace(tzinfo=UTC)
    current = now if now.tzinfo else now.replace(tzinfo=UTC)
    return current >= generated + maturity_delta(horizon)


def _entry_price(evidence: dict[str, Any]) -> Decimal | None:
    raw_price = evidence.get("quote", {}).get("price")
    if raw_price in (None, ""):
        return None
    try:
        price = Decimal(str(raw_price))
    except (ArithmeticError, ValueError):
        return None
    return price if price > 0 else None


def evaluate_recommendation(
    *,
    symbol: str,
    action: str,
    evidence: dict[str, Any],
    generated_at: datetime,
    exit_price: Decimal,
    evaluated_at: datetime | None = None,
) -> EvaluationOutcome | None:
    entry_price = _entry_price(evidence)
    try:
        checked_exit_price = Decimal(str(exit_price))
    except (ArithmeticError, ValueError):
        return None
    if not entry_price or checked_exit_price <= 0:
        return None
    raw_return = (checked_exit_price - entry_price) / entry_price
    if action == "减仓观察":
        strategy_return = -raw_return
    else:
        strategy_return = raw_return
    checked_at = evaluated_at or datetime.now(UTC)
    if checked_at.tzinfo is None:
        checked_at = checked_at.replace(tzinfo=UTC)
    return EvaluationOutcome(
        symbol=symbol,
        evaluated_at=checked_at,
        realized_return=strategy_return.quantize(Decimal("0.000001")),
        is_win=strategy_return > 0,
    )


def summarize_outcomes(outcomes: list[EvaluationOutcome]) -> dict[str, Any]:
    if not outcomes:
        return {
            "evaluated_count": 0,
            "win_rate": Decimal("0"),
            "max_drawdown": Decimal("0"),
            "profit_loss_ratio": Decimal("0"),
            "recommendation_accuracy": Decimal("0"),
            "series": [],
        }
    wins = [item.realized_return for item in outcomes if item.realized_return > 0]
    losses = [item.realized_return for item in outcomes if item.realized_return < 0]
    equity = Decimal("1")
    peak = equity
    max_drawdown = Decimal("0")
    series: list[dict[str, str]] = []
    for item in sorted(
        outcomes,
        key=lambda value: value.evaluated_at
        if value.evaluated_at.tzinfo
        else value.evaluated_at.replace(tzinfo=UTC),
    ):
        equity *= Decimal("1") + item.realized_return
        peak = max(peak, equity)
        drawdown = equity / peak - Decimal("1")
        max_drawdown = min(max_drawdown, drawdown)
        series.append(
            {
                "date": item.evaluated_at.date().isoformat(),
                "symbol": item.symbol,
                "realized_return": str(item.realized_return),
                "cumulative_return": str((equity - Decimal("1")).quantize(Decimal("0.000001"))),
            }
        )
    average_win = sum(wins, Decimal("0")) / len(wins) if wins else Decimal("0")
    average_loss = sum(losses, Decimal("0")) / len(losses) if losses else Decimal("0")
    profit_loss_ratio = average_win / abs(average_loss) if average_loss else Decimal("0")
    win_rate = Decimal(len(wins)) / Decimal(len(outcomes))
    return {
        "evaluated_count": len(outcomes),
        "win_rate": win_rate.quantize(Decimal("0.0001")),
        "max_drawdown": max_drawdown.quantize(Decimal("0.0001")),
        "profit_loss_ratio": profit_loss_ratio.quantize(Decimal("0.01")),
        "recommendation_accuracy": win_rate.quantize(Decimal("0.0001")),
        "series": series,
    }
