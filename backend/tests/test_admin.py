from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.api.deps import admin_user
from app.schemas.admin import AdminOverview


@pytest.mark.asyncio
async def test_admin_guard_denies_regular_user():
    with pytest.raises(HTTPException) as error:
        await admin_user(SimpleNamespace(is_admin=False))
    assert error.value.status_code == 403


def test_admin_overview_contract_is_aggregate_only():
    overview = AdminOverview(
        generated_at="2026-09-01T10:00:00Z",
        total_users=10,
        active_users=9,
        verified_users=8,
        users_with_holdings=4,
        holdings_cost_basis="120000.00",
        recommendations_count=42,
        evaluated_recommendations=30,
        login_events_24h=12,
        market_net_inflow_24h="5000000",
        data_scope="匿名聚合，不包含用户身份与持仓明细",
        data_status="测试",
    )
    assert not hasattr(overview, "email")
    assert overview.users_with_holdings == 4
