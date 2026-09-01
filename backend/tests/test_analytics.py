from decimal import Decimal

from app.services.analytics import portfolio_overview


def test_portfolio_overview_exposes_benchmark_and_risk_metrics():
    result = portfolio_overview()
    assert result["excess_return"] == Decimal("0.0321")
    assert result["max_drawdown"] < 0
    assert len(result["series"]) == 5
