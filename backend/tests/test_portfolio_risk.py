from datetime import UTC, datetime
from decimal import Decimal

from app.services.portfolio_risk import RiskPosition, summarize_portfolio_risk


def position(
    symbol: str,
    quantity: str,
    price: str | None,
    cost: str = "10",
    target_return: str | None = None,
    max_loss: str | None = None,
) -> RiskPosition:
    return RiskPosition(
        symbol=symbol,
        name=symbol,
        quantity=Decimal(quantity),
        cost_price=Decimal(cost),
        market_price=Decimal(price) if price is not None else None,
        target_return=Decimal(target_return) if target_return is not None else None,
        max_loss=Decimal(max_loss) if max_loss is not None else None,
        source="test",
        as_of=datetime(2026, 9, 2, tzinfo=UTC) if price is not None else None,
    )


def test_risk_summary_calculates_weights_and_flags_concentration():
    result = summarize_portfolio_risk(
        [position("A", "70", "10"), position("B", "20", "10"), position("C", "10", "10")],
        risk_profile="balanced",
    )
    assert result["market_value"] == Decimal("1000.00")
    assert result["top_position_weight"] == Decimal("0.7000")
    assert result["concentration_index"] == Decimal("0.5400")
    assert result["concentration_level"] == "high"
    assert result["positions"][0]["symbol"] == "A"


def test_risk_summary_with_unvalued_position_withholds_conclusion():
    result = summarize_portfolio_risk(
        [position("A", "10", "10"), position("B", "10", None)],
        risk_profile="conservative",
    )
    assert result["valued_positions"] == 1
    assert result["concentration_level"] == "unavailable"
    assert result["positions"][1]["quote_status"] == "unavailable"
    assert result["positions"][1]["unrealized_pnl"] is None


def test_empty_risk_summary_does_not_fabricate_exposure():
    result = summarize_portfolio_risk([])
    assert result["market_value"] == Decimal("0.00")
    assert result["concentration_level"] == "empty"
    assert result["positions"] == []


def test_risk_summary_surfaces_holding_level_target_and_loss_alerts():
    result = summarize_portfolio_risk(
        [
            position("WIN", "10", "12", target_return="0.10"),
            position("LOSS", "10", "8", max_loss="0.15"),
        ]
    )
    signals = {item["symbol"]: item["risk_signal"] for item in result["positions"]}
    assert signals == {"WIN": "target_reached", "LOSS": "loss_limit_breached"}
    assert result["target_reached_count"] == 1
    assert result["loss_limit_breached_count"] == 1
