from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_user
from app.db.session import get_db
from app.models import Alert, AuditLog, User
from app.schemas.alerts import AlertCreate, AlertResponse, AlertUpdate
from app.schemas.common import APIMessage

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
    await db.commit()
    await db.refresh(row)
    return AlertResponse.model_validate(row)


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
