from collections import defaultdict
from dataclasses import dataclass
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy import desc, select

from app.core.config import get_settings
from app.core.trading_calendar import RECOMMENDATION_SLOTS, SHANGHAI_TZ
from app.db.session import SessionLocal
from app.models import AIRecommendation, AuditLog, Holding, User, WatchlistItem
from app.schemas.policy import PolicyWeights
from app.services.alerts import check_active_alerts
from app.services.data.provider import get_market_provider
from app.services.policy import default_policy_weights, get_active_policy
from app.services.recommendation import generate_recommendation


@dataclass(frozen=True)
class SchedulerRunResult:
    generated_count: int
    skipped_count: int
    failed_count: int
    started_at: datetime
    finished_at: datetime


RECOMMENDATION_HORIZONS = ("1-2d", "1-5d", "medium")


def recommendation_trigger() -> CronTrigger:
    hours = ",".join(str(hour) for hour, _ in RECOMMENDATION_SLOTS)
    return CronTrigger(
        day_of_week="mon-fri",
        hour=hours,
        minute=0,
        timezone=SHANGHAI_TZ,
    )


async def run_recommendation_cycle() -> SchedulerRunResult:
    started_at = datetime.now(UTC)
    generated_count = 0
    skipped_count = 0
    failed_count = 0
    alert_triggered_count = 0
    alert_failed_count = 0
    settings = get_settings()
    provider = get_market_provider(settings.market_data_provider)
    try:
        market_index = await provider.market_index()
    except Exception:
        market_index = None
    async with SessionLocal() as db:
        users = (
            await db.scalars(
                select(User).where(
                    User.is_active.is_(True),
                    User.email_verified.is_(True),
                )
            )
        ).all()
        active_policy = await get_active_policy(db)
        weights = (
            default_policy_weights()
            if active_policy is None
            else PolicyWeights.model_validate(active_policy.weights)
        )
        model_version = active_policy.version if active_policy else "rule-based-v1"
        targets: dict[Any, dict[str, str]] = defaultdict(dict)
        holdings_by_user: dict[Any, dict[str, Holding]] = defaultdict(dict)
        portfolio_costs: dict[Any, Decimal] = defaultdict(Decimal)
        for item in (
            await db.execute(select(WatchlistItem.user_id, WatchlistItem.symbol, WatchlistItem.name))
        ).all():
            targets[item.user_id][item.symbol] = item.name
        for item in (await db.scalars(select(Holding))).all():
            targets[item.user_id][item.symbol] = item.name
            holdings_by_user[item.user_id][item.symbol] = item
            portfolio_costs[item.user_id] += item.quantity * item.cost_price
        for user in users:
            for symbol, name in targets.get(user.id, {}).items():
                try:
                    quote = await provider.quote(symbol, name)
                    news = await provider.news(symbol)
                    holding = holdings_by_user.get(user.id, {}).get(symbol)
                    current_position = Decimal("0")
                    total_cost = portfolio_costs.get(user.id, Decimal("0"))
                    if holding and total_cost > 0:
                        current_position = (
                            holding.quantity * holding.cost_price / total_cost
                        ).quantize(Decimal("0.0001"))
                    for horizon in RECOMMENDATION_HORIZONS:
                        try:
                            recommendation = generate_recommendation(
                                quote,
                                news,
                                horizon,
                                current_position=current_position,
                                risk_profile=user.risk_profile,
                                target_return_rate=user.target_return_rate,
                                max_quote_age_seconds=settings.recommendation_quote_max_age_seconds,
                                weights=weights,
                                model_version=model_version,
                                market_index=market_index,
                            )
                            generated_at = recommendation.generated_at
                            if generated_at.tzinfo is None:
                                generated_at = generated_at.replace(tzinfo=UTC)
                            hour_start = generated_at.replace(minute=0, second=0, microsecond=0)
                            existing = await db.scalar(
                                select(AIRecommendation)
                                .where(
                                    AIRecommendation.user_id == user.id,
                                    AIRecommendation.symbol == recommendation.symbol,
                                    AIRecommendation.horizon == recommendation.horizon,
                                    AIRecommendation.generated_at >= hour_start,
                                )
                                .order_by(desc(AIRecommendation.generated_at))
                            )
                            if existing:
                                skipped_count += 1
                                continue
                            db.add(
                                AIRecommendation(
                                    user_id=user.id,
                                    symbol=recommendation.symbol,
                                    horizon=recommendation.horizon,
                                    action=recommendation.action,
                                    confidence=recommendation.confidence,
                                    suggested_position=recommendation.suggested_position,
                                    rationale=recommendation.rationale,
                                    evidence=recommendation.evidence,
                                    model_version=recommendation.model_version,
                                    generated_at=generated_at,
                                )
                            )
                            generated_count += 1
                        except Exception:
                            failed_count += 1
                except Exception:
                    failed_count += 1
        try:
            alert_result = await check_active_alerts(db, provider, now=started_at)
            alert_triggered_count = len(alert_result.triggers)
            alert_failed_count = alert_result.failed_count
        except Exception:
            alert_failed_count = 1
        db.add(
            AuditLog(
                action="scheduler.recommendation_cycle",
                resource_type="scheduler",
                metadata_json={
                    "generated_count": generated_count,
                    "skipped_count": skipped_count,
                    "failed_count": failed_count,
                    "provider": provider.name,
                    "model_policy_version": model_version,
                    "alert_triggered_count": alert_triggered_count,
                    "alert_failed_count": alert_failed_count,
                },
                created_at=started_at,
            )
        )
        await db.commit()
    return SchedulerRunResult(
        generated_count=generated_count,
        skipped_count=skipped_count,
        failed_count=failed_count,
        started_at=started_at,
        finished_at=datetime.now(UTC),
    )


class RecommendationScheduler:
    job_id = "hourly-recommendations"

    def __init__(self) -> None:
        self._scheduler: AsyncIOScheduler | None = None

    @property
    def is_running(self) -> bool:
        return bool(self._scheduler and self._scheduler.running)

    def start(self) -> None:
        if self.is_running:
            return
        self._scheduler = AsyncIOScheduler(timezone=SHANGHAI_TZ)
        self._scheduler.add_job(
            run_recommendation_cycle,
            trigger=recommendation_trigger(),
            id=self.job_id,
            replace_existing=True,
            max_instances=1,
            coalesce=True,
            misfire_grace_time=300,
        )
        self._scheduler.start()

    def shutdown(self) -> None:
        if self._scheduler and self._scheduler.running:
            self._scheduler.shutdown(wait=False)

    def status(self) -> dict[str, object]:
        job = self._scheduler.get_job(self.job_id) if self._scheduler else None
        return {
            "enabled": get_settings().enable_scheduler,
            "running": self.is_running,
            "job_id": self.job_id,
            "next_run_at": job.next_run_time if job else None,
            "timezone": "Asia/Shanghai",
        }


recommendation_scheduler = RecommendationScheduler()
