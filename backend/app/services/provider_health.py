import asyncio
from datetime import UTC, datetime
from time import perf_counter
from typing import Any

from app.services.data.provider import get_market_provider, market_provider_catalog


def _utc(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=UTC)


def health_event_metadata(result: dict[str, Any]) -> dict[str, Any]:
    return {
        "provider": result["name"],
        "kind": result["kind"],
        "description": result["description"],
        "configured": result["configured"],
        "status": result["status"],
        "latency_ms": result["latency_ms"],
        "snapshot_as_of": (
            result["snapshot_as_of"].isoformat() if result["snapshot_as_of"] else None
        ),
        "snapshot_age_seconds": result["snapshot_age_seconds"],
        "source": result["source"],
        "message": result["message"],
        "checked_at": result["checked_at"].isoformat(),
    }


def health_result_from_event(event: Any) -> dict[str, Any]:
    metadata = event.metadata_json or {}
    checked_at = metadata.get("checked_at") or event.created_at
    snapshot_as_of = metadata.get("snapshot_as_of")
    status = metadata.get("status")
    if status not in {"healthy", "demo", "timeout", "error", "unavailable"}:
        status = "error"
    return {
        "name": metadata.get("provider") or event.resource_id or "unknown",
        "kind": metadata.get("kind") or "未知",
        "description": metadata.get("description") or "历史探测记录",
        "configured": bool(metadata.get("configured", False)),
        "status": status,
        "latency_ms": metadata.get("latency_ms"),
        "snapshot_as_of": snapshot_as_of,
        "snapshot_age_seconds": metadata.get("snapshot_age_seconds"),
        "source": metadata.get("source"),
        "message": metadata.get("message") or "历史探测记录",
        "checked_at": checked_at,
    }


async def probe_provider_health(
    provider_name: str,
    configured_name: str,
    *,
    timeout_seconds: float = 3.0,
) -> dict[str, Any]:
    catalog_item = next(
        (item for item in market_provider_catalog(configured_name) if item["name"] == provider_name),
        None,
    )
    checked_at = datetime.now(UTC)
    if catalog_item is None:
        return {
            "name": provider_name,
            "kind": "未知",
            "description": "未注册的数据源",
            "configured": False,
            "status": "unavailable",
            "latency_ms": None,
            "snapshot_as_of": None,
            "snapshot_age_seconds": None,
            "source": None,
            "message": "Provider 未注册",
            "checked_at": checked_at,
        }
    if not catalog_item["available"]:
        return {
            "name": provider_name,
            "kind": catalog_item["kind"],
            "description": catalog_item["description"],
            "configured": bool(catalog_item["configured"]),
            "status": "unavailable",
            "latency_ms": None,
            "snapshot_as_of": None,
            "snapshot_age_seconds": None,
            "source": None,
            "message": "依赖未安装或当前不可用",
            "checked_at": checked_at,
        }

    started = perf_counter()
    try:
        snapshot = await asyncio.wait_for(
            get_market_provider(provider_name).market_index(), timeout=timeout_seconds
        )
    except TimeoutError:
        return {
            "name": provider_name,
            "kind": catalog_item["kind"],
            "description": catalog_item["description"],
            "configured": bool(catalog_item["configured"]),
            "status": "timeout",
            "latency_ms": round((perf_counter() - started) * 1000),
            "snapshot_as_of": None,
            "snapshot_age_seconds": None,
            "source": None,
            "message": f"探测超过 {timeout_seconds:g} 秒",
            "checked_at": checked_at,
        }
    except Exception:
        return {
            "name": provider_name,
            "kind": catalog_item["kind"],
            "description": catalog_item["description"],
            "configured": bool(catalog_item["configured"]),
            "status": "error",
            "latency_ms": round((perf_counter() - started) * 1000),
            "snapshot_as_of": None,
            "snapshot_age_seconds": None,
            "source": None,
            "message": "探测失败，未返回上游异常详情",
            "checked_at": checked_at,
        }

    snapshot_as_of = _utc(snapshot.as_of)
    age_seconds = max(0, int((datetime.now(UTC) - snapshot_as_of).total_seconds()))
    return {
        "name": provider_name,
        "kind": catalog_item["kind"],
        "description": catalog_item["description"],
        "configured": bool(catalog_item["configured"]),
        "status": "demo" if snapshot.data_status == "demo" else "healthy",
        "latency_ms": round((perf_counter() - started) * 1000),
        "snapshot_as_of": snapshot_as_of,
        "snapshot_age_seconds": age_seconds,
        "source": snapshot.source,
        "message": "指数快照探测成功",
        "checked_at": checked_at,
    }


async def probe_configured_providers(
    configured_name: str, *, timeout_seconds: float = 3.0
) -> list[dict[str, Any]]:
    catalog = market_provider_catalog(configured_name)
    return [
        await probe_provider_health(
            str(item["name"]), configured_name, timeout_seconds=timeout_seconds
        )
        for item in catalog
    ]
