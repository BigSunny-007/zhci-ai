from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_user
from app.db.session import get_db
from app.models import AuditLog, Holding, User, WatchlistItem
from app.schemas.common import (
    APIMessage,
    HoldingCreate,
    HoldingResponse,
    HoldingUpdate,
    WatchlistCreate,
    WatchlistResponse,
)

router = APIRouter(prefix="/portfolio", tags=["组合"])


@router.get("/holdings", response_model=list[HoldingResponse])
async def holdings(
    user: User = Depends(current_user), db: AsyncSession = Depends(get_db)
) -> list[HoldingResponse]:
    rows = (
        await db.scalars(
            select(Holding).where(Holding.user_id == user.id).order_by(Holding.updated_at.desc())
        )
    ).all()
    return [HoldingResponse.model_validate(row) for row in rows]


@router.post("/holdings", response_model=HoldingResponse, status_code=status.HTTP_201_CREATED)
async def add_holding(
    payload: HoldingCreate, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)
) -> HoldingResponse:
    if await db.scalar(
        select(Holding).where(Holding.user_id == user.id, Holding.symbol == payload.symbol.upper())
    ):
        raise HTTPException(status_code=409, detail="该持仓已存在")
    row = Holding(
        user_id=user.id, **payload.model_dump(exclude_unset=True), symbol=payload.symbol.upper()
    )
    db.add(row)
    db.add(
        AuditLog(
            actor_user_id=user.id,
            action="portfolio.holding_created",
            resource_type="holding",
            resource_id=payload.symbol.upper(),
            metadata_json={"quantity": str(payload.quantity), "cost_price": str(payload.cost_price)},
            created_at=datetime.now(UTC),
        )
    )
    await db.commit()
    await db.refresh(row)
    return HoldingResponse.model_validate(row)


@router.patch("/holdings/{symbol}", response_model=HoldingResponse)
async def update_holding(
    symbol: str,
    payload: HoldingUpdate,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> HoldingResponse:
    row = await db.scalar(
        select(Holding).where(Holding.user_id == user.id, Holding.symbol == symbol.upper())
    )
    if not row:
        raise HTTPException(status_code=404, detail="持仓不存在")
    changes = payload.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(status_code=422, detail="至少提供一个需要修改的字段")
    for field, value in changes.items():
        setattr(row, field, value)
    db.add(
        AuditLog(
            actor_user_id=user.id,
            action="portfolio.holding_updated",
            resource_type="holding",
            resource_id=row.symbol,
            metadata_json={"fields": sorted(changes)},
            created_at=datetime.now(UTC),
        )
    )
    await db.commit()
    await db.refresh(row)
    return HoldingResponse.model_validate(row)


@router.delete("/holdings/{symbol}", response_model=APIMessage)
async def remove_holding(
    symbol: str,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> APIMessage:
    row = await db.scalar(
        select(Holding).where(Holding.user_id == user.id, Holding.symbol == symbol.upper())
    )
    if not row:
        raise HTTPException(status_code=404, detail="持仓不存在")
    db.add(
        AuditLog(
            actor_user_id=user.id,
            action="portfolio.holding_deleted",
            resource_type="holding",
            resource_id=row.symbol,
            metadata_json={"quantity": str(row.quantity), "cost_price": str(row.cost_price)},
            created_at=datetime.now(UTC),
        )
    )
    await db.delete(row)
    await db.commit()
    return APIMessage(message="持仓已删除")


@router.get("/watchlist", response_model=list[WatchlistResponse])
async def watchlist(
    user: User = Depends(current_user), db: AsyncSession = Depends(get_db)
) -> list[WatchlistResponse]:
    rows = (
        await db.scalars(
            select(WatchlistItem)
            .where(WatchlistItem.user_id == user.id)
            .order_by(WatchlistItem.created_at)
        )
    ).all()
    return [WatchlistResponse.model_validate(row) for row in rows]


@router.post("/watchlist", response_model=WatchlistResponse, status_code=status.HTTP_201_CREATED)
async def add_watchlist(
    payload: WatchlistCreate, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)
) -> WatchlistResponse:
    if await db.scalar(
        select(WatchlistItem).where(
            WatchlistItem.user_id == user.id, WatchlistItem.symbol == payload.symbol.upper()
        )
    ):
        raise HTTPException(status_code=409, detail="该股票已在自选列表")
    row = WatchlistItem(user_id=user.id, name=payload.name, symbol=payload.symbol.upper())
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return WatchlistResponse.model_validate(row)


@router.delete("/watchlist/{symbol}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_watchlist(
    symbol: str, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)
) -> None:
    await db.execute(
        delete(WatchlistItem).where(
            WatchlistItem.user_id == user.id, WatchlistItem.symbol == symbol.upper()
        )
    )
    await db.commit()
