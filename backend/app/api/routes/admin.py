from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import admin_user
from app.core.config import get_settings
from app.db.session import get_db
from app.models import AIModelPolicy, AuditLog, User, calculate_audit_integrity_hash
from app.schemas.admin import AdminOverview, AuditIntegrityReport, SchedulerStatus
from app.schemas.policy import (
    ModelPolicyCreate,
    ModelPolicyResponse,
    PolicyApprovalResponse,
    PolicyTransitionRequest,
)
from app.services.admin import admin_overview
from app.services.policy import (
    count_policy_approvals,
    create_policy,
    list_policy_approvals,
    transition_policy,
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
