from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel


class AdminOverview(BaseModel):
    generated_at: datetime
    total_users: int
    active_users: int
    verified_users: int
    users_with_holdings: int
    holdings_cost_basis: Decimal
    recommendations_count: int
    evaluated_recommendations: int
    login_events_24h: int
    market_net_inflow_24h: Decimal
    data_scope: str
    data_status: str


class SchedulerStatus(BaseModel):
    enabled: bool
    running: bool
    job_id: str
    next_run_at: datetime | None
    timezone: str


class DataProviderStatus(BaseModel):
    name: str
    kind: str
    available: bool
    configured: bool
    description: str
    limitations: list[str]
    source_url: str | None


class AuditIntegrityReport(BaseModel):
    checked_events: int
    valid_events: int
    invalid_events: int
    unverifiable_events: int
    checked_at: datetime
    data_scope: str
