from datetime import datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


class PolicyWeights(BaseModel):
    fund_flow: Decimal = Field(ge=0, le=1)
    momentum: Decimal = Field(ge=0, le=1)
    news_authority_adjusted: Decimal = Field(ge=0, le=1)

    @model_validator(mode="after")
    def weights_must_sum_to_one(self) -> "PolicyWeights":
        total = self.fund_flow + self.momentum + self.news_authority_adjusted
        if total != Decimal("1"):
            raise ValueError("权重总和必须等于 1")
        return self


class ModelPolicyCreate(BaseModel):
    version: str = Field(pattern=r"^policy-[a-z0-9][a-z0-9.-]{1,62}$")
    weights: PolicyWeights
    rules: dict[str, str] = Field(default_factory=dict)
    rationale: str = Field(min_length=10, max_length=2000)


class ModelPolicyResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    version: str
    status: Literal["draft", "pending_review", "active", "retired"]
    weights: PolicyWeights
    rules: dict[str, str]
    rationale: str
    created_by: UUID
    review_round: int = 0
    approval_count: int = 0
    submitted_at: datetime | None
    approved_by: UUID | None
    approved_at: datetime | None
    created_at: datetime
    updated_at: datetime


class PolicyApprovalResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    policy_id: UUID
    approver_user_id: UUID
    review_round: int
    decision: Literal["approved", "rejected"]
    comment: str
    created_at: datetime


class PolicyTransitionRequest(BaseModel):
    comment: str = Field(default="", max_length=1000)
