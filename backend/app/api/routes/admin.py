from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import admin_user
from app.core.config import get_settings
from app.db.session import get_db
from app.models import AIModelPolicy, AuditLog, User, calculate_audit_integrity_hash
from app.schemas.admin import (
    AdminOverview,
    AuditEventSummary,
    AuditIntegrityReport,
    DataProviderHealth,
    DataProviderHealthHistory,
    DataProviderStatus,
    SchedulerStatus,
)
from app.schemas.policy import (
    ModelPolicyCreate,
    ModelPolicyResponse,
    PolicyApprovalResponse,
    PolicyTransitionRequest,
)
from app.services.admin import admin_overview
from app.services.data.provider import market_provider_catalog
from app.services.policy import (
    count_policy_approvals,
    create_policy,
    list_policy_approvals,
    transition_policy,
)
from app.services.provider_health import (
    health_event_metadata,
    health_result_from_event,
    probe_configured_providers,
)
from app.services.scheduler import recommendation_scheduler

router = APIRouter(prefix="/admin", tags=["管理员"])


async def serialize_policy(db: AsyncSession, policy: AIModelPolicy) -> ModelPolicyResponse:
    response = ModelPolicyResponse.model_validate(policy)
    response.approval_count = await count_policy_approvals(
        db, policy.id, policy.review_round
    )
    return response


@router.get("/overview", response_model=AdminOverview)
async def overview(
    _: User = Depends(admin_user), db: AsyncSession = Depends(get_db)
) -> AdminOverview:
    return await admin_overview(db)


@router.get("/scheduler", response_model=SchedulerStatus)
async def scheduler_status(_: User = Depends(admin_user)) -> SchedulerStatus:
    return SchedulerStatus.model_validate(recommendation_scheduler.status())


@router.get("/data-providers", response_model=list[DataProviderStatus])
async def data_providers(_: User = Depends(admin_user)) -> list[DataProviderStatus]:
    configured = get_settings().market_data_provider
    return [DataProviderStatus.model_validate(item) for item in market_provider_catalog(configured)]


@router.get("/data-providers/health", response_model=list[DataProviderHealth])
async def data_provider_health(
    admin: User = Depends(admin_user), db: AsyncSession = Depends(get_db)
) -> list[DataProviderHealth]:
    settings = get_settings()
    results = await probe_configured_providers(
        settings.market_data_provider,
        timeout_seconds=settings.provider_health_timeout_seconds,
        max_snapshot_age_seconds=settings.provider_health_max_snapshot_age_seconds,
    )
    for result in results:
        db.add(
            AuditLog(
                actor_user_id=admin.id,
                action="provider.health_probe",
                resource_type="market_provider",
                resource_id=result["name"],
                metadata_json=health_event_metadata(result),
                created_at=result["checked_at"],
            )
        )
    await db.commit()
    return [DataProviderHealth.model_validate(item) for item in results]


@router.get("/data-providers/health/history", response_model=list[DataProviderHealthHistory])
async def data_provider_health_history(
    provider_name: str | None = Query(default=None, alias="provider", max_length=64),
    limit: int = Query(default=30, ge=1, le=100),
    _: User = Depends(admin_user),
    db: AsyncSession = Depends(get_db),
) -> list[DataProviderHealthHistory]:
    statement = select(AuditLog).where(AuditLog.action == "provider.health_probe")
    if provider_name:
        statement = statement.where(AuditLog.resource_id == provider_name)
    events = (
        await db.scalars(statement.order_by(desc(AuditLog.created_at)).limit(limit))
    ).all()
    return [
        DataProviderHealthHistory.model_validate(
            {
                **health_result_from_event(event),
                "event_id": str(event.event_id or event.id),
            }
        )
        for event in events
    ]


@router.get("/audit-integrity", response_model=AuditIntegrityReport)
async def audit_integrity(
    _: User = Depends(admin_user), db: AsyncSession = Depends(get_db)
) -> AuditIntegrityReport:
    events = (
        await db.scalars(select(AuditLog).order_by(AuditLog.id.desc()).limit(2000))
    ).all()
    valid = 0
    unverifiable = 0
    for event in events:
        if not event.integrity_hash:
            unverifiable += 1
        elif event.integrity_hash == calculate_audit_integrity_hash(
            event, get_settings().secret_key
        ):
            valid += 1
    return AuditIntegrityReport(
        checked_events=len(events),
        valid_events=valid,
        invalid_events=len(events) - valid - unverifiable,
        unverifiable_events=unverifiable,
        checked_at=datetime.now(UTC),
        data_scope="最近 2000 条审计事件；旧事件可能没有完整性签名",
    )


@router.get("/audit-events", response_model=list[AuditEventSummary])
async def audit_events(
    limit: int = 20,
    _: User = Depends(admin_user),
    db: AsyncSession = Depends(get_db),
) -> list[AuditEventSummary]:
    safe_limit = min(max(limit, 1), 100)
    events = (
        await db.scalars(select(AuditLog).order_by(AuditLog.created_at.desc()).limit(safe_limit))
    ).all()
    return [
        AuditEventSummary(
            event_id=str(event.event_id),
            action=event.action,
            resource_type=event.resource_type,
            created_at=event.created_at,
        )
        for event in events
    ]


@router.get("/model-policies", response_model=list[ModelPolicyResponse])
async def list_model_policies(
    _: User = Depends(admin_user), db: AsyncSession = Depends(get_db)
) -> list[ModelPolicyResponse]:
    policies = (
        await db.scalars(select(AIModelPolicy).order_by(AIModelPolicy.created_at.desc()))
    ).all()
    return [await serialize_policy(db, policy) for policy in policies]


@router.get(
    "/model-policies/{policy_id}/approvals", response_model=list[PolicyApprovalResponse]
)
async def list_model_policy_approvals(
    policy_id: UUID,
    _: User = Depends(admin_user),
    db: AsyncSession = Depends(get_db),
) -> list[PolicyApprovalResponse]:
    if not await db.get(AIModelPolicy, policy_id):
        raise HTTPException(status_code=404, detail="策略不存在")
    return await list_policy_approvals(db, policy_id)


@router.post("/model-policies", response_model=ModelPolicyResponse, status_code=201)
async def create_model_policy(
    payload: ModelPolicyCreate,
    admin: User = Depends(admin_user),
    db: AsyncSession = Depends(get_db),
) -> ModelPolicyResponse:
    policy = await create_policy(db, payload, admin.id)
    db.add(
        AuditLog(
            actor_user_id=admin.id,
            action="model_policy.created",
            resource_type="ai_model_policy",
            resource_id=str(policy.id),
            metadata_json={"version": policy.version, "status": policy.status},
            created_at=datetime.now(UTC),
        )
    )
    await db.commit()
    return await serialize_policy(db, policy)


@router.post("/model-policies/{policy_id}/{action}", response_model=ModelPolicyResponse)
async def transition_model_policy(
    policy_id: UUID,
    action: str,
    payload: PolicyTransitionRequest | None = None,
    admin: User = Depends(admin_user),
    db: AsyncSession = Depends(get_db),
) -> ModelPolicyResponse:
    policy = await db.get(AIModelPolicy, policy_id)
    if not policy:
        raise HTTPException(status_code=404, detail="策略不存在")
    previous_status = policy.status
    policy = await transition_policy(
        db, policy, action, admin.id, payload.comment if payload else ""
    )
    db.add(
        AuditLog(
            actor_user_id=admin.id,
            action=f"model_policy.{action}",
            resource_type="ai_model_policy",
            resource_id=str(policy.id),
            metadata_json={
                "version": policy.version,
                "from": previous_status,
                "to": policy.status,
                "approval_count": await count_policy_approvals(
                    db, policy.id, policy.review_round
                ),
            },
            created_at=datetime.now(UTC),
        )
    )
    await db.commit()
    return await serialize_policy(db, policy)
