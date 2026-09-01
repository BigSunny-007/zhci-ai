from datetime import UTC, datetime, timedelta
from decimal import Decimal

from app.schemas.common import MarketIndexSnapshot, MarketQuote, NewsResponse
from app.schemas.policy import PolicyWeights
from app.services.recommendation import generate_recommendation


def quote(inflow: str, change: str) -> MarketQuote:
    return MarketQuote(
        symbol="600519.SH",
        name="贵州茅台",
        price=Decimal("1680"),
        change=Decimal(change),
        change_percent=Decimal(change),
        volume=Decimal("100000"),
        net_inflow=Decimal(inflow),
        source="test",
        as_of=datetime.now(UTC),
    )


def news(sentiment: str) -> list[NewsResponse]:
    return [
        NewsResponse(
            id=1,
            symbol="600519.SH",
            title="测试",
            summary="测试",
            source_name="测试来源",
            source_url="https://example.com",
            published_at=datetime.now(UTC),
            authority_score=Decimal("0.9"),
            sentiment_score=Decimal(sentiment),
        )
    ]


def test_positive_evidence_generates_buy_observation():
    result = generate_recommendation(quote("1000000", "2"), news("0.5"))
    assert result.action == "买入观察"
    assert result.confidence >= Decimal("0.35")
    assert result.evidence["weights"]["fund_flow"] == "45%"


def test_conflicting_evidence_stays_conservative():
    result = generate_recommendation(quote("-1000000", "-2"), news("-0.5"))
    assert result.action == "减仓观察"
    assert "不构成交易指令" in result.rationale


def test_custom_policy_is_frozen_into_recommendation_evidence():
    result = generate_recommendation(
        quote("1000000", "2"),
        news("0.5"),
        weights=PolicyWeights(
            fund_flow=Decimal("0.20"),
            momentum=Decimal("0.20"),
            news_authority_adjusted=Decimal("0.60"),
        ),
        model_version="policy-v13",
    )
    assert result.model_version == "policy-v13"
    assert result.evidence["policy_version"] == "policy-v13"
    assert result.evidence["weights"]["news_authority_adjusted"] == "60%"


def test_market_index_is_frozen_into_recommendation_evidence():
    index = MarketIndexSnapshot(
        symbol="000001.SH",
        name="上证指数",
        price=Decimal("3387.42"),
        change=Decimal("21.10"),
        change_percent=Decimal("0.63"),
        source="demo",
        as_of=datetime.now(UTC),
        data_status="demo",
    )
    result = generate_recommendation(quote("0", "0"), news("0"), market_index=index)
    assert result.evidence["market_context"]["symbol"] == "000001.SH"
    assert result.evidence["market_context_adjustment"] == "0.10"
    assert "大盘环境：上证指数涨跌幅 0.63%" in result.rationale


def test_risk_profile_caps_suggested_position():
    for profile, limit in (
        ("conservative", Decimal("0.10")),
        ("balanced", Decimal("0.20")),
        ("aggressive", Decimal("0.35")),
    ):
        result = generate_recommendation(
            quote("1000000", "2"),
            news("0.5"),
            risk_profile=profile,
        )
        assert result.suggested_position <= limit
        assert result.evidence["position_limit"] == str(limit)
        assert result.evidence["risk_profile"] == profile


def test_existing_position_over_risk_limit_prioritizes_de_risking():
    result = generate_recommendation(
        quote("1000000", "2"),
        news("0.5"),
        current_position=Decimal("0.24"),
        risk_profile="balanced",
    )
    assert result.action == "减仓观察"
    assert result.suggested_position == Decimal("0.20")
    assert result.evidence["risk_breach"] is True


def test_stale_quote_blocks_new_position_suggestion():
    stale_quote = quote("1000000", "2").model_copy(
        update={"as_of": datetime.now(UTC) - timedelta(minutes=31)}
    )
    result = generate_recommendation(stale_quote, news("0.5"))
    assert result.action == "持有观察"
    assert result.suggested_position == Decimal("0")
    assert result.confidence == Decimal("0.45")
    assert result.evidence["quote_freshness"] == "stale"


def test_holding_max_loss_breach_forces_de_risking_and_is_preserved_in_evidence():
    result = generate_recommendation(
        quote("1000000", "2").model_copy(update={"price": Decimal("90")}),
        news("0.5"),
        holding_cost_price=Decimal("100"),
        holding_target_return=Decimal("0.20"),
        holding_max_loss=Decimal("0.05"),
    )
    holding_risk = result.evidence["holding_risk"]
    assert result.action == "减仓观察"
    assert result.confidence <= Decimal("0.55")
    assert holding_risk == {
        "cost_price": "100",
        "target_return": "0.20",
        "max_loss": "0.05",
        "unrealized_return": "-0.1",
        "signal": "loss_limit_breached",
    }


def test_holding_target_reached_downgrades_buy_signal_to_hold():
    result = generate_recommendation(
        quote("1000000", "2").model_copy(update={"price": Decimal("120")}),
        news("0.5"),
        holding_cost_price=Decimal("100"),
        holding_target_return=Decimal("0.15"),
        holding_max_loss=Decimal("0.10"),
    )
    assert result.action == "持有观察"
    assert result.evidence["holding_risk"]["signal"] == "target_reached"


def test_missing_holding_rules_are_explicitly_unavailable():
    result = generate_recommendation(quote("1000000", "2"), news("0.5"))
    assert result.evidence["holding_risk"]["signal"] == "unavailable"
    assert result.evidence["holding_risk"]["unrealized_return"] is None
