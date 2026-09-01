from datetime import UTC, datetime, timedelta

from jose import jwt

from app.core.config import get_settings
from app.core.security import (
    create_access_token,
    create_verification_token,
    hash_verification_token,
)


def test_openapi_exposes_recommendation_history_contract():
    from app.main import app

    assert "/api/v1/market/recommendations" in app.openapi()["paths"]


def test_verification_token_is_random_and_hash_is_not_reversible():
    first, first_expiry = create_verification_token()
    second, second_expiry = create_verification_token()

    assert first != second
    assert hash_verification_token(first) != first
    assert first_expiry > datetime.now(UTC)
    assert second_expiry > datetime.now(UTC)


def test_access_token_carries_session_version_for_global_logout():
    token = create_access_token("user-1", session_version=7)
    payload = jwt.decode(token, get_settings().secret_key, algorithms=["HS256"])

    assert payload["type"] == "access"
    assert payload["session_version"] == 7


def test_verification_expiry_window_is_short_lived():
    _, expires_at = create_verification_token()
    assert expires_at - datetime.now(UTC) <= timedelta(minutes=16)
