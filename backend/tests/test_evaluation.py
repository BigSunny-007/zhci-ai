from datetime import UTC, datetime, timedelta
from decimal import Decimal

from app.services.evaluation import (
    evaluate_recommendation,
    is_mature,
    summarize_outcomes,
)


def test_buy_and_reduce_actions_are_evaluated_directionally():
    generated_at = datetime(2026, 9, 1, tzinfo=UTC)
    buy = evaluate_recommendation(
        symbol="600519.SH",
        action="买入观察",
        evidence={"quote": {"price": "100"}},
        generated_at=generated_at,
        exit_price=Decimal("110"),
        evaluated_at=generated_at + timedelta(days=1),
    )
    reduce = evaluate_recommendation(
        symbol="601318.SH",
        action="减仓观察",
        evidence={"quote": {"price": "100"}},
        generated_at=generated_at,
        exit_price=Decimal("90"),
        evaluated_at=generated_at + timedelta(days=1),
    )
    assert buy and buy.is_win and buy.realized_return == Decimal("0.100000")
    assert reduce and reduce.is_win and reduce.realized_return == Decimal("0.100000")


def test_summary_calculates_win_rate_drawdown_and_profit_loss_ratio():
    generated_at = datetime(2026, 9, 1, tzinfo=UTC)
    outcomes = [
        evaluate_recommendation(
            symbol="A",
            action="买入观察",
            evidence={"quote": {"price": "100"}},
            generated_at=generated_at,
            exit_price=Decimal("110"),
            evaluated_at=generated_at + timedelta(days=1),
        ),
        evaluate_recommendation(
            symbol="B",
            action="买入观察",
            evidence={"quote": {"price": "100"}},
            generated_at=generated_at,
            exit_price=Decimal("95"),
            evaluated_at=generated_at + timedelta(days=2),
        ),
    ]
    summary = summarize_outcomes([item for item in outcomes if item])
    assert summary["evaluated_count"] == 2
    assert summary["win_rate"] == Decimal("0.5000")
    assert summary["max_drawdown"] < 0
    assert summary["profit_loss_ratio"] == Decimal("2.00")


def test_maturity_respects_horizon():
    generated_at = datetime(2026, 9, 1, tzinfo=UTC)
    assert not is_mature(generated_at, generated_at + timedelta(days=4), "1-5d")
    assert is_mature(generated_at, generated_at + timedelta(days=5), "1-5d")
