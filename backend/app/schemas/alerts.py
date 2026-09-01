from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field


class AlertCreate(BaseModel):
    symbol: str = Field(min_length=2, max_length=24)
    condition_type: str = Field(
        pattern="^(price_above|price_below|inflow_above|change_percent_above)$"
    )
    threshold: Decimal
    frequency: str = Field(default="once", pattern="^(once|hourly|daily)$")
    expires_at: datetime | None = None
    message: str = Field(default="智策提醒", max_length=240)
    channel: str = Field(default="in_app", pattern="^(in_app|email)$")


class AlertResponse(AlertCreate):
    id: UUID
    is_active: bool


class AlertUpdate(BaseModel):
    is_active: bool
