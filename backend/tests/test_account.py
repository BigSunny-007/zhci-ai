import pytest
from pydantic import ValidationError

from app.schemas.account import DeleteAccountRequest


def test_delete_account_requires_explicit_confirmation_phrase():
    request = DeleteAccountRequest(password="strong-pass-123", confirmation="DELETE_ACCOUNT")
    assert request.confirmation == "DELETE_ACCOUNT"


def test_delete_account_rejects_ambiguous_confirmation():
    with pytest.raises(ValidationError):
        DeleteAccountRequest(password="strong-pass-123", confirmation="yes")
