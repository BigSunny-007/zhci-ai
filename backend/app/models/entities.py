import hashlib
import hmac
import json
from datetime import UTC, datetime
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    event,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class User(TimestampMixin, Base):
    __tablename__ = "users"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    display_name: Mapped[str] = mapped_column(String(80), default="投资者")
    risk_profile: Mapped[str] = mapped_column(String(24), default="balanced")
    target_return_rate: Mapped[Decimal | None] = mapped_column(Numeric(8, 4), nullable=True)
    investment_horizon: Mapped[str] = mapped_column(String(16), default="1-5d")
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    verification_token_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    verification_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    session_version: Mapped[int] = mapped_column(Integer, default=0)

    holdings: Mapped[list["Holding"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    watchlist: Mapped[list["WatchlistItem"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


class AIModelPolicy(TimestampMixin, Base):
    __tablename__ = "ai_model_policies"
    __table_args__ = (UniqueConstraint("version", name="uq_ai_model_policy_version"),)

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    version: Mapped[str] = mapped_column(String(64), index=True)
    status: Mapped[str] = mapped_column(String(24), default="draft", index=True)
    weights: Mapped[dict] = mapped_column(JSON)
    rules: Mapped[dict] = mapped_column(JSON, default=dict)
    rationale: Mapped[str] = mapped_column(Text)
    created_by: Mapped[UUID] = mapped_column(ForeignKey("users.id"), index=True)
    review_round: Mapped[int] = mapped_column(Integer, default=0)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    approved_by: Mapped[UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    approvals: Mapped[list["PolicyApproval"]] = relationship(
        back_populates="policy", cascade="all, delete-orphan"
    )


class PolicyApproval(Base):
    __tablename__ = "ai_model_policy_approvals"
    __table_args__ = (
        UniqueConstraint(
            "policy_id", "review_round", "approver_user_id",
            name="uq_policy_approval_reviewer_round",
        ),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    policy_id: Mapped[UUID] = mapped_column(
        ForeignKey("ai_model_policies.id", ondelete="CASCADE"), index=True
    )
    approver_user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"), index=True)
    review_round: Mapped[int] = mapped_column(Integer)
    decision: Mapped[str] = mapped_column(String(16))
    comment: Mapped[str] = mapped_column(String(1000), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))

    policy: Mapped[AIModelPolicy] = relationship(back_populates="approvals")


class Holding(TimestampMixin, Base):
    __tablename__ = "holdings"
    __table_args__ = (UniqueConstraint("user_id", "symbol", name="uq_holdings_user_symbol"),)

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    symbol: Mapped[str] = mapped_column(String(24), index=True)
    name: Mapped[str] = mapped_column(String(80))
    quantity: Mapped[Decimal] = mapped_column(Numeric(18, 4), default=0)
    cost_price: Mapped[Decimal] = mapped_column(Numeric(18, 4), default=0)
    target_return: Mapped[Decimal | None] = mapped_column(Numeric(8, 4), nullable=True)
    max_loss: Mapped[Decimal | None] = mapped_column(Numeric(8, 4), nullable=True)
    user: Mapped[User] = relationship(back_populates="holdings")


class WatchlistItem(TimestampMixin, Base):
    __tablename__ = "watchlist_items"
    __table_args__ = (UniqueConstraint("user_id", "symbol", name="uq_watchlist_user_symbol"),)

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    symbol: Mapped[str] = mapped_column(String(24), index=True)
    name: Mapped[str] = mapped_column(String(80))
    user: Mapped[User] = relationship(back_populates="watchlist")


class MarketBar(Base):
    __tablename__ = "market_bars"
    __table_args__ = (
        UniqueConstraint("symbol", "bar_time", "interval_name", name="uq_market_bar"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    symbol: Mapped[str] = mapped_column(String(24), index=True)
    market: Mapped[str] = mapped_column(String(16), default="CN")
    bar_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    interval: Mapped[str] = mapped_column("interval_name", String(8), default="1d")
    open: Mapped[Decimal] = mapped_column("open_price", Numeric(18, 4))
    high: Mapped[Decimal] = mapped_column("high_price", Numeric(18, 4))
    low: Mapped[Decimal] = mapped_column("low_price", Numeric(18, 4))
    close: Mapped[Decimal] = mapped_column("close_price", Numeric(18, 4))
    volume: Mapped[Decimal] = mapped_column(Numeric(24, 4), default=0)
    net_inflow: Mapped[Decimal] = mapped_column(Numeric(24, 4), default=0)
    source: Mapped[str] = mapped_column(String(40), default="demo")


class NewsItem(Base):
    __tablename__ = "news_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    symbol: Mapped[str | None] = mapped_column(String(24), index=True, nullable=True)
    title: Mapped[str] = mapped_column(String(500))
    summary: Mapped[str] = mapped_column(Text, default="")
    source_name: Mapped[str] = mapped_column(String(120))
    source_url: Mapped[str] = mapped_column(String(1000))
    published_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    authority_score: Mapped[Decimal] = mapped_column(Numeric(5, 4), default=0.5)
    sentiment_score: Mapped[Decimal] = mapped_column(Numeric(5, 4), default=0)


class AIRecommendation(Base):
    __tablename__ = "ai_recommendations"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    symbol: Mapped[str] = mapped_column(String(24), index=True)
    horizon: Mapped[str] = mapped_column(String(16))
    action: Mapped[str] = mapped_column(String(24))
    confidence: Mapped[Decimal] = mapped_column(Numeric(5, 4))
    suggested_position: Mapped[Decimal] = mapped_column(Numeric(5, 4), default=0)
    rationale: Mapped[str] = mapped_column(Text)
    evidence: Mapped[dict] = mapped_column(JSON)
    model_version: Mapped[str] = mapped_column(String(64), default="rule-based-v1")
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    evaluated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    realized_return: Mapped[Decimal | None] = mapped_column(Numeric(10, 6), nullable=True)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    event_id: Mapped[UUID | None] = mapped_column(default=uuid4, nullable=True, index=True)
    actor_user_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    action: Mapped[str] = mapped_column(String(120))
    resource_type: Mapped[str] = mapped_column(String(80))
    resource_id: Mapped[str | None] = mapped_column(String(80), nullable=True)
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    integrity_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)


def audit_integrity_payload(target: AuditLog) -> str:
    return json.dumps(
        {
            "event_id": str(target.event_id) if target.event_id else None,
            "actor_user_id": str(target.actor_user_id) if target.actor_user_id else None,
            "action": target.action,
            "resource_type": target.resource_type,
            "resource_id": target.resource_id,
            "metadata_json": target.metadata_json or {},
            "created_at": target.created_at.isoformat() if target.created_at else None,
        },
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
        default=str,
    )


def calculate_audit_integrity_hash(target: AuditLog, secret_key: str) -> str:
    return hmac.new(
        secret_key.encode("utf-8"),
        audit_integrity_payload(target).encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


@event.listens_for(AuditLog, "before_insert")
def populate_audit_integrity_hash(_mapper, _connection, target: AuditLog) -> None:
    if not target.event_id:
        target.event_id = uuid4()
    if not target.integrity_hash:
        from app.core.config import get_settings

        target.integrity_hash = calculate_audit_integrity_hash(
            target, get_settings().secret_key
        )


class Alert(TimestampMixin, Base):
    __tablename__ = "alerts"
    __table_args__ = (
        UniqueConstraint("user_id", "symbol", "condition_type", name="uq_alert_rule"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    symbol: Mapped[str] = mapped_column(String(24), index=True)
    condition_type: Mapped[str] = mapped_column(String(32))
    threshold: Mapped[Decimal] = mapped_column(Numeric(18, 4))
    frequency: Mapped[str] = mapped_column(String(16), default="once")
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    message: Mapped[str] = mapped_column(String(240), default="智策提醒")
    channel: Mapped[str] = mapped_column(String(16), default="in_app")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
