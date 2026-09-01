from decimal import Decimal

import pytest
from pydantic import ValidationError

from app.schemas.common import UserProfileUpdate


def test_profile_update_accepts_supported_risk_and_horizon():
    payload = UserProfileUpdate(
        risk_profile="conservative",
        target_return_rate=Decimal("0.08"),
        investment_horizon="1-5d",
    )
    assert payload.risk_profile == "conservative"


def test_profile_update_rejects_unknown_values():
    with pytest.raises(ValidationError):
        UserProfileUpdate(risk_profile="all-in")
