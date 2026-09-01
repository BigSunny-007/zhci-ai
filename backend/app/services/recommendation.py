from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

from app.schemas.common import (
    MarketIndexSnapshot,
    MarketQuote,
    NewsResponse,
    RecommendationResponse,
)
from app.schemas.policy import PolicyWeights
from app.services.policy import default_policy_weights, policy_weights_dict

RISK_POSITION_LIMITS = {
    "conservative": Decimal("0.10"),
    "balanced": Decimal("0.20"),
    "aggressive": Decimal("0.35"),
}
MARKET_CONTEXT_ADJUSTMENT = Decimal("0.10")


def risk_position_limit(risk_profile: str) -> Decimal:
    return RISK_POSITION_LIMITS.get(risk_profile, RISK_POSITION_LIMITS["balanced"])


def generate_recommendation(
    quote: MarketQuote,
    news: list[NewsResponse],
    horizon: str = "1-5d",
    current_position: Decimal = Decimal("0"),
    risk_profile: str = "balanced",
    target_return_rate: Decimal | None = None,
    max_quote_age_seconds: int | None = 1800,
    weights: PolicyWeights | None = None,
    model_version: str = "rule-based-v1",
    market_index: MarketIndexSnapshot | None = None,
) -> RecommendationResponse:
    selected_weights = weights or default_policy_weights()
    weight_values = policy_weights_dict(selected_weights)
    inflow_signal = (
        Decimal("1")
        if quote.net_inflow > 0
        else Decimal("-1")
        if quote.net_inflow < 0
        else Decimal("0")
    )
    momentum_signal = Decimal("1") if quote.change_percent >= 0 else Decimal("-1")
    news_signal = sum((item.sentiment_score * item.authority_score for item in news), Decimal("0"))
    base_score = (
        inflow_signal * weight_values["fund_flow"]
        + momentum_signal * weight_values["momentum"]
        + news_signal * weight_values["news_authority_adjusted"]
    )
    market_signal = (
        Decimal("1")
        if market_index and market_index.change_percent > 0
        else Decimal("-1")
        if market_index and market_index.change_percent < 0
        else Decimal("0")
    )
    market_adjustment = market_signal * MARKET_CONTEXT_ADJUSTMENT
    score = base_score + market_adjustment
    if score >= Decimal("0.35"):
        action = "买入观察"
    elif score <= Decimal("-0.35"):
        action = "减仓观察"
    else:
        action = "持有观察"
    confidence = min(Decimal("0.95"), max(Decimal("0.35"), abs(score) + Decimal("0.32")))
    position_limit = risk_position_limit(risk_profile)
    quote_as_of = quote.as_of if quote.as_of.tzinfo else quote.as_of.replace(tzinfo=UTC)
    quote_age_seconds = max(0, int((datetime.now(UTC) - quote_as_of).total_seconds()))
    stale_quote = (
        max_quote_age_seconds is not None and quote_age_seconds > max_quote_age_seconds
    )
    if stale_quote:
        action = "持有观察"
        confidence = min(confidence, Decimal("0.45"))
    risk_breach = current_position > position_limit
    if risk_breach:
        action = "减仓观察"
    base_position = (
        min(Decimal("0.20"), position_limit)
        if action == "买入观察"
        else min(current_position, position_limit)
    )
    rationale = "；".join(
        [
            (
                f"资金流：净流入 {quote.net_inflow:,.0f}，权重 {selected_weights.fund_flow:.0%}"
                if quote.fund_flow_status != "unavailable"
                else "资金流：当前数据源未提供，资金流信号不参与本次评分"
            ),
            f"价格动量：涨跌幅 {quote.change_percent:.2f}%，权重 {selected_weights.momentum:.0%}",
            f"新闻加权情绪：{news_signal:.3f}，权重 {selected_weights.news_authority_adjusted:.0%}",
            (
                f"大盘环境：{market_index.name}涨跌幅 {market_index.change_percent:.2f}%，"
                f"上下文修正 {market_adjustment:+.2f}"
                if market_index
                else "大盘环境：当前未取得指数快照，不参与评分"
            ),
            f"风险档位：{risk_profile}，建议仓位上限 {position_limit:.0%}，当前占比 {current_position:.0%}",
            (
                f"行情快照已延迟 {quote_age_seconds} 秒，超过 {max_quote_age_seconds} 秒阈值，"
                "暂停新增仓位建议。"
                if stale_quote
                else f"行情快照年龄 {quote_age_seconds} 秒，未超过新鲜度阈值。"
            ),
            "当前仓位超过风险上限，优先控制超配风险。" if risk_breach else "当前仓位未超过风险上限。",
            "证据不足时仅作观察，不构成交易指令。",
        ]
    )
    evidence: dict[str, Any] = {
        "quote": quote.model_dump(mode="json"),
        "news": [item.model_dump(mode="json") for item in news],
        "weights": {
            key: f"{value:.0%}" for key, value in weight_values.items()
        },
        "policy_version": model_version,
        "score": str(score),
        "base_score": str(base_score),
        "market_context": market_index.model_dump(mode="json") if market_index else None,
        "market_context_adjustment": str(market_adjustment),
        "risk_profile": risk_profile,
        "position_limit": str(position_limit),
        "current_position": str(current_position),
        "risk_breach": risk_breach,
        "quote_age_seconds": quote_age_seconds,
        "quote_freshness": "stale" if stale_quote else "fresh",
        "fund_flow_status": quote.fund_flow_status,
        "quote_max_age_seconds": max_quote_age_seconds,
        "target_return_rate": str(target_return_rate) if target_return_rate is not None else None,
        "limitations": ["演示数据源", "未接入真实实时行情", "不得直接用于投资决策"],
    }
    return RecommendationResponse(
        symbol=quote.symbol,
        horizon=horizon,
        action=action,
        confidence=confidence.quantize(Decimal("0.01")),
        suggested_position=base_position,
        rationale=rationale,
        evidence=evidence,
        generated_at=quote.as_of,
        model_version=model_version,
    )
