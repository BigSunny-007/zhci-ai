from datetime import UTC, datetime

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_user
from app.core.config import get_settings
from app.db.session import get_db
from app.models import AIRecommendation, User
from app.schemas.analytics import AnalyticsOverview, RecommendationEvaluationOverview
from app.services.analytics import portfolio_overview
from app.services.data.provider import get_market_provider
from app.services.evaluation import (
    evaluate_recommendation,
    is_mature,
    summarize_by_horizon,
    summarize_outcomes,
)

router = APIRouter(prefix="/analytics", tags=["绩效"])


@router.get("/overview", response_model=AnalyticsOverview)
async def overview(_: User = Depends(current_user)) -> AnalyticsOverview:
    return AnalyticsOverview.model_validate(portfolio_overview())


@router.get("/recommendations", response_model=RecommendationEvaluationOverview)
async def recommendation_evaluation(
    user: User = Depends(current_user), db: AsyncSession = Depends(get_db)
) -> RecommendationEvaluationOverview:
    now = datetime.now(UTC)
    records = (
        await db.scalars(
            select(AIRecommendation)
            .where(AIRecommendation.user_id == user.id)
            .order_by(AIRecommendation.generated_at)
            .limit(200)
        )
    ).all()
    provider = get_market_provider(get_settings().market_data_provider)
    outcomes = []
    outcomes_by_horizon: dict[str, list] = {}
    dirty = False
    for record in records:
        if record.realized_return is not None and record.evaluated_at is not None:
            outcome = evaluate_recommendation(
                symbol=record.symbol,
                action=record.action,
                evidence=record.evidence,
                generated_at=record.generated_at,
                exit_price=record.evidence.get("evaluation", {}).get("exit_price", 0),
                evaluated_at=record.evaluated_at,
            )
            if outcome:
                outcomes.append(outcome)
                outcomes_by_horizon.setdefault(record.horizon, []).append(outcome)
            continue
        if not is_mature(record.generated_at, now, record.horizon):
            continue
        quote_evidence = record.evidence.get("quote", {})
        quote = await provider.quote(record.symbol, quote_evidence.get("name", "自选股"))
        outcome = evaluate_recommendation(
            symbol=record.symbol,
            action=record.action,
            evidence=record.evidence,
            generated_at=record.generated_at,
            exit_price=quote.price,
            evaluated_at=now,
        )
        if outcome is None:
            continue
        record.evaluated_at = outcome.evaluated_at
        record.realized_return = outcome.realized_return
        record.evidence = {
            **record.evidence,
            "evaluation": {
                "exit_price": str(quote.price),
                "exit_source": quote.source,
                "evaluated_at": outcome.evaluated_at.isoformat(),
            },
        }
        outcomes.append(outcome)
        outcomes_by_horizon.setdefault(record.horizon, []).append(outcome)
        dirty = True
    if dirty:
        await db.commit()
    summary = summarize_outcomes([item for item in outcomes if item is not None])
    summary["period"] = "已到期建议"
    summary["by_horizon"] = summarize_by_horizon(outcomes_by_horizon)
    summary["data_status"] = (
        "演示数据：当前兑现结果仅用于验证评估链路"
        if get_settings().market_data_provider == "demo"
        else f"数据源：{get_settings().market_data_provider}"
    )
    return RecommendationEvaluationOverview.model_validate(summary)
