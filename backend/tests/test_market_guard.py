from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.api.routes import market


class EmptySession:
    async def scalar(self, *_args, **_kwargs):
        return None


@pytest.mark.asyncio
async def test_manual_recommendation_is_blocked_outside_slot(monkeypatch):
    monkeypatch.setattr(market, "is_recommendation_slot", lambda _value: False)
    with pytest.raises(HTTPException) as error:
        await market.recommendation(
            "600519.SH",
            "贵州茅台",
            "1-5d",
            SimpleNamespace(id=uuid4()),
            EmptySession(),
        )
    assert error.value.status_code == 409
    assert "不在 AI 建议槽位" in str(error.value.detail)
