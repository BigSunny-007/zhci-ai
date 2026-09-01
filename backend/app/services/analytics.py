from decimal import Decimal


def portfolio_overview() -> dict:
    """Return a stable contract for portfolio analytics until broker sync is enabled."""
    return {
        "period": "近 30 个交易日",
        "portfolio_return": Decimal("0.0842"),
        "benchmark_return": Decimal("0.0521"),
        "excess_return": Decimal("0.0321"),
        "max_drawdown": Decimal("-0.0268"),
        "win_rate": Decimal("0.68"),
        "profit_loss_ratio": Decimal("1.74"),
        "recommendation_accuracy": Decimal("0.71"),
        "data_status": "演示数据：接入交易流水后自动替换",
        "series": [
            {"date": "2026-08-05", "portfolio": "100.0", "benchmark": "100.0"},
            {"date": "2026-08-12", "portfolio": "101.8", "benchmark": "101.2"},
            {"date": "2026-08-19", "portfolio": "103.6", "benchmark": "102.4"},
            {"date": "2026-08-26", "portfolio": "106.1", "benchmark": "104.0"},
            {"date": "2026-09-01", "portfolio": "108.4", "benchmark": "105.2"},
        ],
    }
