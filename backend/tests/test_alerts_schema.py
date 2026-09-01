from decimal import Decimal

import pytest
from pydantic import ValidationError

from app.schemas.alerts import AlertCreate


def test_alert_schema_freezes_supported_condition_contract():
    alert = AlertCreate(
        symbol="600519.SH", condition_type="inflow_above", threshold=Decimal("1000000")
    )
    assert alert.frequency == "once"


def test_alert_schema_rejects_ambiguous_condition():
    with pytest.raises(ValidationError):
        AlertCreate(symbol="600519.SH", condition_type="guess", threshold=Decimal("1"))
