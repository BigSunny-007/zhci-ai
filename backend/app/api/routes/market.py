from datetime import UTC, datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_user
from app.core.config import get_settings
from app.core.trading_calendar import (
    is_recommendation_slot,
    is_trading_day,
    market_session,
    next_recommendation_at,
    to_shanghai,
)
from app.db.session import get_db
from app.models import AIRecommendation, Holding, User
from app.schemas.common import (
    MarketHistoryPoint,
    MarketIndexSnapshot,
    MarketProviderInfo,
    MarketQuote,
    MarketSessionResponse,
    NewsResponse,
    RecommendationHistoryItem,
    RecommendationResponse,
)
from app.schemas.policy import PolicyWeights
from app.services.data.provider import get_market_provider, market_provider_catalog
from app.services.policy import default_policy_weights, get_active_policy
from app.services.rate_limit import MarketRateLimit
from app.services.recommendation import generate_recommendation

router = APIRouter(prefix="/market", tags=["行情"], dependencies=[MarketRateLimit])


@router.get("/session", response_model=MarketSessionResponse)
async def session_status() -> MarketSessionResponse:
    now = to_shanghai()
    return MarketSessionResponse(
        as_of=now,
        timezone="Asia/Shanghai",
        is_trading_day=is_trading_day(now),
        session=market_session(now),
        can_generate_recommendation=is_recommendation_slot(now),
        next_recommendation_at=next_recommendation_at(now),
    )


@router.get("/providers", response_model=list[MarketProviderInfo])
async def providers() -> list[MarketProviderInfo]:
    configured = get_settings().market_data_provider
    return [MarketProviderInfo.model_validate(item) for item in market_provider_catalog(configured)]


@router.get("/quote", response_model=MarketQuote)
async def quote(
    symbol: str = Query(min_length=2, max_length=24),
    name: str = Query(default="自选股"),
    _: User = Depends(current_user),
) -> MarketQuote:
    provider = get_market_provider(get_settings().market_data_provider)
    return await provider.quote(symbol.upper(), name)


@router.get("/index", response_model=MarketIndexSnapshot)
async def market_index(_: User = Depends(current_user)) -> MarketIndexSnapshot:
    provider = get_market_provider(get_settings().market_data_provider)
    return await provider.market_index()


@router.get("/history", response_model=list[MarketHistoryPoint])
async def history(
    symbol: str = Query(min_length=2, max_length=24),
    days: int = Query(default=30, ge=5, le=180),
    _: User = Depends(current_user),
) -> list[MarketHistoryPoint]:
    provider = get_market_provider(get_settings().market_data_provider)
    return await provider.history(symbol.upper(), days)


@router.get("/news", response_model=list[NewsResponse])
async def news(
    symbol: str | None = Query(default=None, max_length=24), _: User = Depends(current_user)
) -> list[NewsResponse]:
    provider = get_market_provider(get_settings().market_data_provider)
    return await provider.news(symbol.upper() if symbol else None)


@router.get("/recommendation", response_model=RecommendationResponse)
async def recommendation(
    symbol: str = Query(min_length=2, max_length=24),
    name: str = Query(default="自选股"),
    horizon: str = Query(default="1-5d"),
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> RecommendationResponse:
    symbol_upper = symbol.upper()
    now = datetime.now(UTC)
    if not is_recommendation_slot(now):
        existing = await db.scalar(
            select(AIRecommendation)
            .where(
                AIRecommendation.user_id == user.id,
                AIRecommendation.symbol == symbol_upper,
                AIRecommendation.horizon == horizon,
            )
            .order_by(desc(AIRecommendation.generated_at))
        )
        if existing:
            return RecommendationResponse.model_validate(existing).model_copy(
                update={"is_stale": True, "delivery_mode": "cached"}
            )
        next_slot = next_recommendation_at(now)
        next_label = next_slot.isoformat() if next_slot else "下个交易日"
        raise HTTPException(
            status_code=409,
            detail=f"当前不在 AI 建议槽位，仅允许查看已有建议；下一次槽位：{next_label}",
        )
    provider = get_market_provider(get_settings().market_data_provider)
    quote_data = await provider.quote(symbol_upper, name)
    news_data = await provider.news(symbol_upper)
    try:
        market_index_data = await provider.market_index()
    except Exception:
        market_index_data = None
    active_policy = await get_active_policy(db)
    weights = (
        default_policy_weights()
        if active_policy is None
        else PolicyWeights.model_validate(active_policy.weights)
    )
    model_version = active_policy.version if active_policy else "rule-based-v1"
    holding = await db.scalar(
        select(Holding).where(Holding.user_id == user.id, Holding.symbol == symbol_upper)
    )
    total_cost = await db.scalar(
        select(func.coalesce(func.sum(Holding.quantity * Holding.cost_price), 0)).where(
            Holding.user_id == user.id
        )
    )
    current_position = Decimal("0")
    if holding and total_cost:
        current_position = (holding.quantity * holding.cost_price / total_cost).quantize(
            Decimal("0.0001")
        )
    generated = generate_recommendation(
        quote_data,
        news_data,
        horizon,
        weights=weights,
        model_version=model_version,
        current_position=current_position,
        risk_profile=user.risk_profile,
        target_return_rate=user.target_return_rate,
        holding_cost_price=holding.cost_price if holding else None,
        holding_target_return=holding.target_return if holding else None,
        holding_max_loss=holding.max_loss if holding else None,
        max_quote_age_seconds=get_settings().recommendation_quote_max_age_seconds,
        market_index=market_index_data,
    )
    generated_at = generated.generated_at
    if generated_at.tzinfo is None:
        generated_at = generated_at.replace(tzinfo=UTC)
        generated = generated.model_copy(update={"generated_at": generated_at})
    hour_start = generated_at.astimezone(UTC).replace(minute=0, second=0, microsecond=0)
    existing = await db.scalar(
        select(AIRecommendation)
        .where(
            AIRecommendation.user_id == user.id,
            AIRecommendation.symbol == generated.symbol,
            AIRecommendation.horizon == generated.horizon,
            AIRecommendation.generated_at >= hour_start,
        )
        .order_by(desc(AIRecommendation.generated_at))
    )
    if existing:
        return RecommendationResponse.model_validate(existing).model_copy(
            update={"is_stale": False, "delivery_mode": "cached"}
        )
    record = AIRecommendation(
        user_id=user.id,
        symbol=generated.symbol,
        horizon=generated.horizon,
        action=generated.action,
        confidence=generated.confidence,
        suggested_position=generated.suggested_position,
        rationale=generated.rationale,
        evidence=generated.evidence,
        model_version=generated.model_version,
        generated_at=generated.generated_at,
    )
    db.add(record)
    await db.commit()
    return generated


@router.get("/recommendations", response_model=list[RecommendationHistoryItem])
async def recommendation_history(
    limit: int = Query(default=20, ge=1, le=100),
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> list[RecommendationHistoryItem]:
    records = (
        await db.scalars(
            select(AIRecommendation)
            .where(AIRecommendation.user_id == user.id)
            .order_by(desc(AIRecommendation.generated_at))
            .limit(limit)
        )
    ).all()
    return [RecommendationHistoryItem.model_validate(record) for record in records]
