from datetime import datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class APIMessage(BaseModel):
    message: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class RefreshRequest(BaseModel):
    refresh_token: str = Field(min_length=20, max_length=4096)


class RegisterRequest(LoginRequest):
    display_name: str = Field(default="投资者", min_length=1, max_length=80)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: Literal["bearer"] = "bearer"
    email_verified: bool = True
    verification_required: bool = False
    verification_token: str | None = None


class VerifyEmailRequest(BaseModel):
    email: EmailStr
    token: str = Field(min_length=20, max_length=128)


class ResendVerificationRequest(BaseModel):
    email: EmailStr


class VerificationResponse(BaseModel):
    message: str
    email_verified: bool
    verification_token: str | None = None


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    email: EmailStr
    display_name: str
    risk_profile: str
    target_return_rate: Decimal | None = None
    investment_horizon: str | None = None
    is_admin: bool
    email_verified: bool


class UserProfileUpdate(BaseModel):
    risk_profile: Literal["conservative", "balanced", "aggressive"] | None = None
    target_return_rate: Decimal | None = Field(default=None, ge=-1, le=10)
    investment_horizon: Literal["1d", "1-2d", "1-5d", "medium", "long"] | None = None


class HoldingCreate(BaseModel):
    symbol: str = Field(min_length=2, max_length=24)
    name: str = Field(min_length=1, max_length=80)
    quantity: Decimal = Field(ge=0)
    cost_price: Decimal = Field(gt=0)
    target_return: Decimal | None = Field(default=None, ge=-1, le=10)
    max_loss: Decimal | None = Field(default=None, ge=0, le=1)


class HoldingUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    quantity: Decimal | None = Field(default=None, ge=0)
    cost_price: Decimal | None = Field(default=None, gt=0)
    target_return: Decimal | None = Field(default=None, ge=-1, le=10)
    max_loss: Decimal | None = Field(default=None, ge=0, le=1)


class HoldingResponse(HoldingCreate):
    model_config = ConfigDict(from_attributes=True)
    id: UUID


class PortfolioSummary(BaseModel):
    cost_basis: Decimal
    market_value: Decimal
    unrealized_pnl: Decimal
    unrealized_pnl_percent: Decimal
    positions_count: int
    valued_positions: int
    data_status: str
    source: str
    as_of: datetime


class WatchlistCreate(BaseModel):
    symbol: str = Field(min_length=2, max_length=24)
    name: str = Field(min_length=1, max_length=80)


class WatchlistResponse(WatchlistCreate):
    model_config = ConfigDict(from_attributes=True)
    id: UUID


class MarketQuote(BaseModel):
    symbol: str
    name: str
    price: Decimal
    change: Decimal
    change_percent: Decimal
    volume: Decimal
    net_inflow: Decimal
    source: str
    as_of: datetime
    fund_flow_status: Literal["available", "unavailable", "demo"] = "available"


class MarketSessionResponse(BaseModel):
    as_of: datetime
    timezone: str
    is_trading_day: bool
    session: str
    can_generate_recommendation: bool
    next_recommendation_at: datetime | None


class MarketProviderInfo(BaseModel):
    name: str
    kind: str
    available: bool
    configured: bool
    description: str
    limitations: list[str]
    source_url: str | None = None


class MarketHistoryPoint(BaseModel):
    time: datetime
    close: Decimal
    volume: Decimal
    net_inflow: Decimal


class NewsResponse(BaseModel):
    id: int
    symbol: str | None
    title: str
    summary: str
    source_name: str
    source_url: str
    published_at: datetime
    authority_score: Decimal
    sentiment_score: Decimal


class RecommendationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    symbol: str
    horizon: str
    action: str
    confidence: Decimal
    suggested_position: Decimal
    rationale: str
    evidence: dict
    generated_at: datetime
    model_version: str
    is_stale: bool = False
    delivery_mode: Literal["generated", "cached"] = "generated"


class RecommendationHistoryItem(RecommendationResponse):
    id: UUID
    evaluated_at: datetime | None = None
    realized_return: Decimal | None = None
