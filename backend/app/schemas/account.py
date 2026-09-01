from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import (
    HoldingResponse,
    RecommendationHistoryItem,
    UserResponse,
    WatchlistResponse,
)


class AuditEventExport(BaseModel):
    id: int
    event_id: UUID | None = None
    action: str
    resource_type: str
    resource_id: str | None
    metadata_json: dict
    created_at: datetime
    integrity_hash: str | None = None


class UserDataExport(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    exported_at: datetime
    user: UserResponse
    holdings: list[HoldingResponse]
    watchlist: list[WatchlistResponse]
    recommendations: list[RecommendationHistoryItem]
    audit_events: list[AuditEventExport]


class DeleteAccountRequest(BaseModel):
    password: str = Field(min_length=8, max_length=128)
    confirmation: str = Field(pattern="^DELETE_ACCOUNT$")
