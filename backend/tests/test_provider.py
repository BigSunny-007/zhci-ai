import asyncio
from types import SimpleNamespace

import pytest

from app.services import provider_health
from app.services.data.provider import (
    DemoMarketDataProvider,
    get_market_provider,
    market_provider_catalog,
    normalize_symbol,
)
from app.services.provider_health import probe_configured_providers, probe_provider_health


@pytest.mark.asyncio
async def test_demo_provider_exposes_a_timestamped_market_index():
    snapshot = await DemoMarketDataProvider().market_index()
    assert snapshot.symbol == "000001.SH"
    assert snapshot.data_status == "demo"
    assert snapshot.as_of.tzinfo is not None


def test_symbol_normalization_supports_exchange_suffixes():
    assert normalize_symbol("600519.sh") == "600519"
    assert normalize_symbol("000001") == "000001"


def test_unknown_or_unavailable_provider_falls_back_to_demo():
    assert get_market_provider("unknown").name == "demo"
    if not any(item["name"] == "akshare" and item["available"] for item in market_provider_catalog("akshare")):
        assert get_market_provider("akshare").name == "demo"


def test_provider_catalog_exposes_explicit_limitations():
    catalog = market_provider_catalog("demo")
    demo = next(item for item in catalog if item["name"] == "demo")
    assert demo["configured"] is True
    assert demo["limitations"]


@pytest.mark.asyncio
async def test_provider_health_probe_reports_demo_snapshot_latency_and_age():
    result = await probe_provider_health("demo", "demo")
    assert result["status"] == "demo"
    assert result["latency_ms"] is not None
    assert result["latency_ms"] >= 0
    assert result["snapshot_age_seconds"] is not None
    assert result["snapshot_age_seconds"] >= 0
    assert result["source"] == "demo"
    results = await probe_configured_providers("demo")
    assert [item["name"] for item in results] == ["demo", "akshare"]


@pytest.mark.asyncio
async def test_provider_health_probe_is_explicit_when_dependency_is_unavailable():
    result = await probe_provider_health("unknown", "demo")
    assert result["status"] == "unavailable"
    assert result["message"] == "Provider 未注册"


@pytest.mark.asyncio
async def test_provider_health_probe_marks_slow_upstream_as_timeout(monkeypatch):
    class SlowProvider:
        async def market_index(self):
            await asyncio.sleep(0.02)
            return SimpleNamespace(
                as_of=None, source="slow", data_status="available"
            )

    monkeypatch.setattr(
        provider_health,
        "market_provider_catalog",
        lambda _: [{"name": "slow", "kind": "测试", "description": "测试", "available": True, "configured": True}],
    )
    monkeypatch.setattr(provider_health, "get_market_provider", lambda _: SlowProvider())
    result = await probe_provider_health("slow", "slow", timeout_seconds=0.001)
    assert result["status"] == "timeout"
    assert result["latency_ms"] is not None
