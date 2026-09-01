import pytest

from app.services.data.provider import (
    DemoMarketDataProvider,
    get_market_provider,
    market_provider_catalog,
    normalize_symbol,
)


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
