from datetime import UTC, datetime
from decimal import Decimal
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AIModelPolicy, PolicyApproval
from app.schemas.policy import ModelPolicyCreate, PolicyApprovalResponse, PolicyWeights


def default_policy_weights() -> PolicyWeights:
    return PolicyWeights(
        fund_flow=Decimal("0.45"),
        momentum=Decimal("0.35"),
        news_authority_adjusted=Decimal("0.20"),
    )


def policy_weights_dict(weights: PolicyWeights) -> dict[str, Decimal]:
    return {
        "fund_flow": weights.fund_flow,
        "momentum": weights.momentum,
        "news_authority_adjusted": weights.news_authority_adjusted,
    }


async def get_active_policy(db: AsyncSession) -> AIModelPolicy | None:
    return await db.scalar(
        select(AIModelPolicy)
        .where(AIModelPolicy.status == "active")
        .order_by(AIModelPolicy.approved_at.desc())
    )


async def create_policy(
    db: AsyncSession, payload: ModelPolicyCreate, created_by: UUID
) -> AIModelPolicy:
    if await db.scalar(select(AIModelPolicy).where(AIModelPolicy.version == payload.version)):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="策略版本已存在")
    policy = AIModelPolicy(
        version=payload.version,
        status="draft",
        weights=payload.weights.model_dump(mode="json"),
        rules=payload.rules,
        rationale=payload.rationale,
        created_by=created_by,
    )
    db.add(policy)
    await db.commit()
    await db.refresh(policy)
    return policy


async def transition_policy(
    db: AsyncSession,
    policy: AIModelPolicy,
    action: str,
    actor_id: UUID,
    comment: str = "",
) -> AIModelPolicy:
    now = datetime.now(UTC)
    if action == "submit":
        if policy.status != "draft":
            raise HTTPException(status_code=409, detail="只有草稿可以提交审核")
        policy.status = "pending_review"
        policy.review_round = (policy.review_round or 0) + 1
        policy.submitted_at = now
    elif action == "approve":
        if policy.status != "pending_review":
            raise HTTPException(status_code=409, detail="只有待审核策略可以审批")
        approvals = (
            await db.scalars(
                select(PolicyApproval).where(
                    PolicyApproval.policy_id == policy.id,
                    PolicyApproval.review_round == policy.review_round,
                    PolicyApproval.decision == "approved",
                )
            )
        ).all()
        if any(approval.approver_user_id == actor_id for approval in approvals):
            raise HTTPException(status_code=409, detail="同一审批轮次不可重复审批")
        db.add(
            PolicyApproval(
                policy_id=policy.id,
                approver_user_id=actor_id,
                review_round=policy.review_round,
                decision="approved",
                comment=comment,
                created_at=now,
            )
        )
        if len(approvals) + 1 >= 2:
            await db.execute(
                update(AIModelPolicy)
                .where(AIModelPolicy.status == "active")
                .values(status="retired")
            )
            policy.status = "active"
            policy.approved_by = actor_id
            policy.approved_at = now
    elif action == "reject":
        if policy.status != "pending_review":
            raise HTTPException(status_code=409, detail="只有待审核策略可以驳回")
        db.add(
            PolicyApproval(
                policy_id=policy.id,
                approver_user_id=actor_id,
                review_round=policy.review_round,
                decision="rejected",
                comment=comment,
                created_at=now,
            )
        )
        policy.status = "draft"
    elif action == "retire":
        if policy.status != "active":
            raise HTTPException(status_code=409, detail="只有生效策略可以退役")
        policy.status = "retired"
    else:
        raise HTTPException(status_code=400, detail="不支持的策略操作")
    await db.commit()
    await db.refresh(policy)
    return policy


async def count_policy_approvals(db: AsyncSession, policy_id: UUID, review_round: int) -> int:
    return int(
        await db.scalar(
            select(func.count(PolicyApproval.id)).where(
                PolicyApproval.policy_id == policy_id,
                PolicyApproval.review_round == review_round,
                PolicyApproval.decision == "approved",
            )
        )
        or 0
    )


async def list_policy_approvals(
    db: AsyncSession, policy_id: UUID
) -> list[PolicyApprovalResponse]:
    approvals = (
        await db.scalars(
            select(PolicyApproval)
            .where(PolicyApproval.policy_id == policy_id)
            .order_by(PolicyApproval.created_at.desc())
        )
    ).all()
    return [PolicyApprovalResponse.model_validate(approval) for approval in approvals]
