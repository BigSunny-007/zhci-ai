from decimal import Decimal
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from app.models import AIModelPolicy
from app.schemas.policy import ModelPolicyCreate, PolicyWeights
from app.services.policy import transition_policy


class FakeSession:
    def __init__(self) -> None:
        self.committed = False
        self.approvals = []

    async def execute(self, *_args, **_kwargs):
        return SimpleNamespace()

    async def scalars(self, *_args, **_kwargs):
        return SimpleNamespace(all=lambda: list(self.approvals))

    def add(self, entity):
        self.approvals.append(entity)

    async def commit(self):
        self.committed = True

    async def refresh(self, _entity):
        return None


def weights() -> PolicyWeights:
    return PolicyWeights(
        fund_flow=Decimal("0.45"),
        momentum=Decimal("0.35"),
        news_authority_adjusted=Decimal("0.20"),
    )


def test_policy_weights_must_sum_to_one():
    assert weights().fund_flow == Decimal("0.45")
    with pytest.raises(ValidationError):
        PolicyWeights(fund_flow=Decimal("0.40"), momentum=Decimal("0.35"), news_authority_adjusted=Decimal("0.20"))


def test_policy_version_and_rationale_are_validated():
    payload = ModelPolicyCreate(version="policy-v13", weights=weights(), rationale="经过完整回测与人工复核确认")
    assert payload.version == "policy-v13"
    with pytest.raises(ValidationError):
        ModelPolicyCreate(version="V13", weights=weights(), rationale="太短")


@pytest.mark.asyncio
async def test_policy_state_machine_requires_ordered_actions():
    policy = AIModelPolicy(
        id=uuid4(),
        version="policy-v13",
        status="draft",
        weights=weights().model_dump(mode="json"),
        rules={},
        rationale="人工确认后用于测试",
        created_by=uuid4(),
    )
    session = FakeSession()
    actor = uuid4()
    second_actor = uuid4()
    with pytest.raises(HTTPException):
        await transition_policy(session, policy, "approve", actor)
    await transition_policy(session, policy, "submit", actor)
    assert policy.status == "pending_review"
    await transition_policy(session, policy, "approve", actor)
    assert policy.status == "pending_review"
    await transition_policy(session, policy, "approve", second_actor)
    assert policy.status == "active"
    await transition_policy(session, policy, "retire", actor)
    assert policy.status == "retired"


@pytest.mark.asyncio
async def test_policy_requires_two_distinct_approvers_and_supports_rejection():
    policy = AIModelPolicy(
        id=uuid4(),
        version="policy-v14",
        status="draft",
        weights=weights().model_dump(mode="json"),
        rules={},
        rationale="双人审批门禁测试",
        created_by=uuid4(),
    )
    session = FakeSession()
    first_admin = uuid4()
    second_admin = uuid4()
    await transition_policy(session, policy, "submit", first_admin)
    await transition_policy(session, policy, "approve", first_admin, "初审通过")
    assert policy.status == "pending_review"
    with pytest.raises(HTTPException) as duplicate:
        await transition_policy(session, policy, "approve", first_admin)
    assert duplicate.value.status_code == 409
    await transition_policy(session, policy, "approve", second_admin, "复核通过")
    assert policy.status == "active"

    rejected = AIModelPolicy(
        id=uuid4(),
        version="policy-v14-rejected",
        status="draft",
        weights=weights().model_dump(mode="json"),
        rules={},
        rationale="驳回流程测试",
        created_by=uuid4(),
    )
    await transition_policy(session, rejected, "submit", first_admin)
    await transition_policy(session, rejected, "reject", second_admin, "缺少回测证据")
    assert rejected.status == "draft"
