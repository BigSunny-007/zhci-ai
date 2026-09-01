from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_user
from app.db.session import get_db
from app.models import Alert, User
from app.schemas.alerts import AlertCreate, AlertResponse

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
