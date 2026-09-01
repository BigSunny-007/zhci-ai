from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_user
from app.core.config import get_settings
from app.db.session import get_db
from app.models import Alert, AlertTrigger, AuditLog, User
from app.schemas.alerts import (
    AlertCheckResponse,
    AlertCreate,
    AlertResponse,
    AlertTriggerResponse,
    AlertUpdate,
)
from app.schemas.common import APIMessage
from app.services.alerts import check_active_alerts
from app.services.data.provider import get_market_provider

router = APIRouter(prefix="/alerts", tags=["提醒"])


@router.get("", response_model=list[AlertResponse])
async def list_alerts(
    user: User = Depends(current_user), db: AsyncSession = Depends(get_db)
) -> list[AlertResponse]:
    rows = (
        await db.scalars(
            select(Alert).where(Alert.user_id == user.id).order_by(Alert.created_at.desc())
        )
    ).all()
    return [AlertResponse.model_validate(row) for row in rows]


@router.post("", response_model=AlertResponse, status_code=status.HTTP_201_CREATED)
async def create_alert(
    payload: AlertCreate, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)
) -> AlertResponse:
    symbol = payload.symbol.upper()
    exists = await db.scalar(
        select(Alert).where(
            Alert.user_id == user.id,
            Alert.symbol == symbol,
            Alert.condition_type == payload.condition_type,
            Alert.is_active.is_(True),
        )
    )
    if exists:
        raise HTTPException(status_code=409, detail="相同提醒已存在")
    row = Alert(user_id=user.id, symbol=symbol, **payload.model_dump())
    db.add(row)
    db.add(
        AuditLog(
            actor_user_id=user.id,
            action="alert.created",
            resource_type="alert",
            resource_id=symbol,
            metadata_json={"condition_type": payload.condition_type, "frequency": payload.frequency},
            created_at=datetime.now(UTC),
        )
    )
    await db.commit()
    await db.refresh(row)
    return AlertResponse.model_validate(row)


@router.get("/triggers", response_model=list[AlertTriggerResponse])
async def list_alert_triggers(
    limit: int = 20,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> list[AlertTriggerResponse]:
    safe_limit = min(max(limit, 1), 100)
    rows = (
        await db.scalars(
            select(AlertTrigger)
            .where(AlertTrigger.user_id == user.id)
            .order_by(AlertTrigger.triggered_at.desc())
            .limit(safe_limit)
        )
    ).all()
    return [AlertTriggerResponse.model_validate(row) for row in rows]


@router.post("/check", response_model=AlertCheckResponse)
async def check_alerts(
    user: User = Depends(current_user), db: AsyncSession = Depends(get_db)
) -> AlertCheckResponse:
    checked_at = datetime.now(UTC)
    provider_name = get_settings().market_data_provider
    result = await check_active_alerts(
        db,
        get_market_provider(provider_name),
        user_id=user.id,
        now=checked_at,
    )
    db.add(
        AuditLog(
            actor_user_id=user.id,
            action="alert.checked",
            resource_type="alert",
            metadata_json={
                "checked_count": result.checked_count,
                "triggered_count": len(result.triggers),
                "suppressed_count": result.suppressed_count,
                "failed_count": result.failed_count,
                "provider": provider_name,
            },
            created_at=checked_at,
        )
    )
    await db.commit()
    if result.failed_count:
        data_status = f"{result.failed_count} 条提醒数据读取失败，其余结果已保留"
    elif result.triggers:
        data_status = f"发现 {len(result.triggers)} 条触发提醒，已写入历史"
    else:
        data_status = "当前没有满足条件的提醒"
    return AlertCheckResponse(
        checked_count=result.checked_count,
        suppressed_count=result.suppressed_count,
        failed_count=result.failed_count,
        checked_at=checked_at,
        data_status=data_status,
        triggers=[AlertTriggerResponse.model_validate(item) for item in result.triggers],
    )


@router.patch("/{alert_id}", response_model=AlertResponse)
async def update_alert(
    alert_id: str,
    payload: AlertUpdate,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> AlertResponse:
    row = await db.scalar(select(Alert).where(Alert.user_id == user.id, Alert.id == alert_id))
    if not row:
        raise HTTPException(status_code=404, detail="提醒不存在")
    row.is_active = payload.is_active
    db.add(
        AuditLog(
            actor_user_id=user.id,
            action="alert.activated" if payload.is_active else "alert.paused",
            resource_type="alert",
            resource_id=str(row.id),
            metadata_json={"symbol": row.symbol},
            created_at=datetime.now(UTC),
        )
    )
    await db.commit()
    await db.refresh(row)
    return AlertResponse.model_validate(row)


@router.delete("/{alert_id}", response_model=APIMessage)
async def delete_alert(
    alert_id: str,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> APIMessage:
    row = await db.scalar(select(Alert).where(Alert.user_id == user.id, Alert.id == alert_id))
    if not row:
        raise HTTPException(status_code=404, detail="提醒不存在")
    db.add(
        AuditLog(
            actor_user_id=user.id,
            action="alert.deleted",
            resource_type="alert",
            resource_id=str(row.id),
            metadata_json={"symbol": row.symbol, "condition_type": row.condition_type},
            created_at=datetime.now(UTC),
        )
    )
    await db.delete(row)
    await db.commit()
    return APIMessage(message="提醒已删除")
