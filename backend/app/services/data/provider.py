import asyncio
import importlib.util
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Protocol

from app.schemas.common import MarketHistoryPoint, MarketQuote, NewsResponse


class MarketDataProvider(Protocol):
    name: str

    async def quote(self, symbol: str, name: str) -> MarketQuote: ...
    async def history(self, symbol: str, days: int = 30) -> list[MarketHistoryPoint]: ...
    async def news(self, symbol: str | None = None) -> list[NewsResponse]: ...


def normalize_symbol(symbol: str) -> str:
    return symbol.upper().split(".", 1)[0]


class DemoMarketDataProvider:
    name = "demo"

    async def quote(self, symbol: str, name: str) -> MarketQuote:
        seed = sum(ord(char) for char in symbol) % 97
        price = Decimal(str(round(8 + seed / 10, 2)))
        change = Decimal(str(round(((seed % 13) - 6) / 10, 2)))
        change_percent = (change / price * 100).quantize(Decimal("0.01"))
        now = datetime.now(UTC)
        return MarketQuote(
            symbol=symbol,
            name=name,
            price=price,
            change=change,
            change_percent=change_percent,
            volume=Decimal(str(1200000 + seed * 17000)),
            net_inflow=Decimal(str((seed - 48) * 130000)),
            source=self.name,
            as_of=now,
        )

    async def history(self, symbol: str, days: int = 30) -> list[MarketHistoryPoint]:
        seed = sum(ord(char) for char in symbol) % 31
        now = datetime.now(UTC)
        result: list[MarketHistoryPoint] = []
        close = Decimal(str(8 + seed / 10))
        for index in range(days):
            drift = Decimal(str(((index + seed) % 9 - 4) / 100))
            close = (close * (Decimal("1") + drift)).quantize(Decimal("0.01"))
            result.append(
                MarketHistoryPoint(
                    time=now - timedelta(days=days - index - 1),
                    close=close,
                    volume=Decimal(str(800000 + ((index + seed) % 17) * 40000)),
                    net_inflow=Decimal(str(((index + seed) % 11 - 5) * 100000)),
                )
            )
        return result

    async def news(self, symbol: str | None = None) -> list[NewsResponse]:
        now = datetime.now(UTC)
        subject = symbol or "A股市场"
        return [
            NewsResponse(
                id=1,
                symbol=symbol,
                title=f"{subject}盘中资金与行业景气度观察",
                summary="示例新闻仅用于开发环境展示，接入正式来源前不应作为交易依据。",
                source_name="演示数据源",
                source_url="https://example.com/news/1",
                published_at=now - timedelta(minutes=18),
                authority_score=Decimal("0.20"),
                sentiment_score=Decimal("0.10"),
            ),
            NewsResponse(
                id=2,
                symbol=symbol,
                title="政策与宏观环境仍需结合权威公告核验",
                summary="系统会将权威公告权重设置为高于媒体与舆情，避免单一来源造成误判。",
                source_name="智策研究室",
                source_url="https://example.com/news/2",
                published_at=now - timedelta(hours=1),
                authority_score=Decimal("0.70"),
                sentiment_score=Decimal("0.02"),
            ),
        ]


class AkShareMarketDataProvider:
    name = "akshare"

    @staticmethod
    def _module():
        if importlib.util.find_spec("akshare") is None:
            raise RuntimeError("AKShare 未安装，请安装 backend 的 market 可选依赖")
        import akshare

        return akshare

    @staticmethod
    def _decimal(value: object, default: str = "0") -> Decimal:
        if value is None or str(value).strip() in {"", "-", "nan", "None"}:
            return Decimal(default)
        try:
            return Decimal(str(value).replace(",", ""))
        except (ArithmeticError, ValueError):
            return Decimal(default)

    async def quote(self, symbol: str, name: str) -> MarketQuote:
        return await asyncio.to_thread(self._quote_sync, symbol, name)

    def _quote_sync(self, symbol: str, name: str) -> MarketQuote:
        ak = self._module()
        frame = ak.stock_zh_a_spot_em()
        code = normalize_symbol(symbol)
        matches = frame[frame["代码"].astype(str) == code]
        if matches.empty:
            raise ValueError(f"未找到股票 {symbol}")
        row = matches.iloc[0]
        price = self._decimal(row.get("最新价"))
        change = self._decimal(row.get("涨跌额"))
        return MarketQuote(
            symbol=symbol.upper(),
            name=str(row.get("名称") or name),
            price=price,
            change=change,
            change_percent=self._decimal(row.get("涨跌幅")),
            volume=self._decimal(row.get("成交量")),
            net_inflow=Decimal("0"),
            source=self.name,
            as_of=datetime.now(UTC),
        )

    async def history(self, symbol: str, days: int = 30) -> list[MarketHistoryPoint]:
        return await asyncio.to_thread(self._history_sync, symbol, days)

    def _history_sync(self, symbol: str, days: int) -> list[MarketHistoryPoint]:
        ak = self._module()
        end = datetime.now(UTC).date()
        start = end - timedelta(days=days * 2)
        frame = ak.stock_zh_a_hist(
            symbol=normalize_symbol(symbol),
            period="daily",
            start_date=start.strftime("%Y%m%d"),
            end_date=end.strftime("%Y%m%d"),
            adjust="",
        )
        points: list[MarketHistoryPoint] = []
        for _, row in frame.tail(days).iterrows():
            points.append(
                MarketHistoryPoint(
                    time=datetime.strptime(str(row["日期"]), "%Y-%m-%d").replace(tzinfo=UTC),
                    close=self._decimal(row.get("收盘")),
                    volume=self._decimal(row.get("成交量")),
                    net_inflow=Decimal("0"),
                )
            )
        return points

    async def news(self, symbol: str | None = None) -> list[NewsResponse]:
        return await asyncio.to_thread(self._news_sync, symbol)

    def _news_sync(self, symbol: str | None) -> list[NewsResponse]:
        ak = self._module()
        if not symbol:
            return []
        frame = ak.stock_news_em(symbol=normalize_symbol(symbol))
        items: list[NewsResponse] = []
        for index, (_, row) in enumerate(frame.head(20).iterrows(), start=1):
            published = datetime.strptime(str(row["发布时间"]), "%Y-%m-%d %H:%M:%S").replace(
                tzinfo=UTC
            )
            items.append(
                NewsResponse(
                    id=index,
                    symbol=symbol.upper(),
                    title=str(row.get("新闻标题") or "未命名资讯"),
                    summary=str(row.get("新闻内容") or ""),
                    source_name=str(row.get("文章来源") or "AKShare"),
                    source_url=str(row.get("新闻链接") or ""),
                    published_at=published,
                    authority_score=Decimal("0.50"),
                    sentiment_score=Decimal("0"),
                )
            )
        return items


def market_provider_catalog(configured_name: str) -> list[dict[str, object]]:
    akshare_available = importlib.util.find_spec("akshare") is not None
    return [
        {
            "name": "demo",
            "kind": "演示",
            "available": True,
            "configured": configured_name == "demo",
            "description": "稳定的本地演示数据，用于开发联调",
            "limitations": ["不代表真实行情", "不提供真实资金流"],
            "source_url": None,
        },
        {
            "name": "akshare",
            "kind": "免费开源适配",
            "available": akshare_available,
            "configured": configured_name == "akshare",
            "description": "通过 AKShare 调用公开 A 股接口",
            "limitations": ["接口稳定性与频率受上游影响", "资金流字段暂不由该适配器填充"],
            "source_url": "https://akshare.akfamily.xyz/",
        },
    ]


def get_market_provider(name: str = "demo") -> MarketDataProvider:
    providers: dict[str, MarketDataProvider] = {
        "demo": DemoMarketDataProvider(),
        "akshare": AkShareMarketDataProvider(),
    }
    selected = providers.get(name)
    if selected is None:
        return providers["demo"]
    if name == "akshare" and importlib.util.find_spec("akshare") is None:
        return providers["demo"]
    return selected
