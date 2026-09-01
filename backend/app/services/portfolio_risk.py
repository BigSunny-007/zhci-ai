from dataclasses import dataclass
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

POSITION_LIMITS = {
    "conservative": Decimal("0.10"),
    "balanced": Decimal("0.20"),
    "aggressive": Decimal("0.35"),
}


@dataclass(frozen=True)
class RiskPosition:
    symbol: str
    name: str
    quantity: Decimal
    cost_price: Decimal
    market_price: Decimal | None
    source: str
    as_of: datetime | None


def _q4(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.0001"))


def summarize_portfolio_risk(
    positions: list[RiskPosition],
    *,
    risk_profile: str = "balanced",
    as_of: datetime | None = None,
) -> dict[str, Any]:
    checked_at = as_of or datetime.now(UTC)
    limit = POSITION_LIMITS.get(risk_profile, POSITION_LIMITS["balanced"])
    valued = [
        position
        for position in positions
        if position.market_price is not None and position.market_price >= 0
    ]
    total_value = sum(
        (position.quantity * position.market_price for position in valued), Decimal("0")
    )
    incomplete = len(valued) < len(positions)
    if total_value > 0:
        weights = {
            position.symbol: _q4(position.quantity * position.market_price / total_value)
            for position in valued
        }
    else:
        weights = {position.symbol: Decimal("0") for position in positions}
    concentration_index = _q4(
        sum((weight * weight for weight in weights.values()), Decimal("0"))
    )
    top_position_weight = max(weights.values(), default=Decimal("0"))

    if not positions:
        concentration_level = "empty"
        data_status = "暂无持仓，无法计算组合集中度"
    elif incomplete:
        concentration_level = "unavailable"
        data_status = f"{len(positions) - len(valued)} 个持仓暂无法估值，集中度结论暂不可用"
    elif total_value <= 0:
        concentration_level = "empty"
        data_status = "持仓市值为 0，暂无法计算集中度"
    elif top_position_weight > limit or concentration_index >= Decimal("0.25"):
        concentration_level = "high"
        data_status = "组合集中度超过当前风险偏好的观察阈值"
    elif top_position_weight > limit * Decimal("0.8") or concentration_index >= Decimal("0.18"):
        concentration_level = "watch"
        data_status = "组合集中度接近当前风险偏好的观察阈值"
    else:
        concentration_level = "balanced"
        data_status = "已按当前风险偏好完成组合集中度检查"

    serialized = []
    for position in sorted(
        positions,
        key=lambda item: weights.get(item.symbol, Decimal("0")),
        reverse=True,
    ):
        market_value = (
            position.quantity * position.market_price
            if position.market_price is not None
            else Decimal("0")
        )
        cost_basis = position.quantity * position.cost_price
        serialized.append(
            {
                "symbol": position.symbol,
                "name": position.name,
                "market_value": market_value.quantize(Decimal("0.01")),
                "weight": weights.get(position.symbol, Decimal("0")),
                "unrealized_pnl": (
                    (market_value - cost_basis).quantize(Decimal("0.01"))
                    if position.market_price is not None
                    else None
                ),
                "quote_status": "valued" if position.market_price is not None else "unavailable",
                "source": position.source,
                "as_of": position.as_of,
            }
        )
    return {
        "risk_profile": risk_profile,
        "single_position_limit": _q4(limit),
        "market_value": total_value.quantize(Decimal("0.01")),
        "total_positions": len(positions),
        "valued_positions": len(valued),
        "top_position_weight": top_position_weight,
        "concentration_index": concentration_index,
        "concentration_level": concentration_level,
        "data_status": data_status,
        "as_of": checked_at,
        "positions": serialized,
    }
