from datetime import UTC, datetime, timedelta
from decimal import Decimal

from sqlalchemy import distinct, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AIRecommendation, AuditLog, Holding, MarketBar, User
from app.schemas.admin import AdminOverview


async def admin_overview(db: AsyncSession) -> AdminOverview:
    now = datetime.now(UTC)
    yesterday = now - timedelta(hours=24)
    total_users = int(await db.scalar(select(func.count(User.id))) or 0)
    active_users = int(
        await db.scalar(select(func.count(User.id)).where(User.is_active.is_(True))) or 0
    )
    verified_users = int(
        await db.scalar(select(func.count(User.id)).where(User.email_verified.is_(True))) or 0
    )
    users_with_holdings = int(
        await db.scalar(
            select(func.count(distinct(Holding.user_id))).where(Holding.quantity > 0)
        )
        or 0
    )
    holdings_cost_basis = (
        await db.scalar(select(func.coalesce(func.sum(Holding.quantity * Holding.cost_price), 0)))
        or Decimal("0")
    )
    recommendations_count = int(await db.scalar(select(func.count(AIRecommendation.id))) or 0)
    evaluated_recommendations = int(
        await db.scalar(
            select(func.count(AIRecommendation.id)).where(
                AIRecommendation.evaluated_at.is_not(None)
            )
        )
        or 0
    )
    login_events_24h = int(
        await db.scalar(
            select(func.count(AuditLog.id)).where(
                AuditLog.action == "auth.login_succeeded",
                AuditLog.created_at >= yesterday,
            )
        )
        or 0
    )
    market_net_inflow_24h = (
        await db.scalar(
            select(func.coalesce(func.sum(MarketBar.net_inflow), 0)).where(
                MarketBar.bar_time >= yesterday
            )
        )
        or Decimal("0")
    )
    return AdminOverview(
        generated_at=now,
        total_users=total_users,
        active_users=active_users,
        verified_users=verified_users,
        users_with_holdings=users_with_holdings,
        holdings_cost_basis=holdings_cost_basis,
        recommendations_count=recommendations_count,
        evaluated_recommendations=evaluated_recommendations,
        login_events_24h=login_events_24h,
        market_net_inflow_24h=market_net_inflow_24h,
        data_scope="匿名聚合，不包含用户身份与持仓明细",
        data_status="指标来自当前数据库；行情资金流受数据源覆盖范围限制",
    )
