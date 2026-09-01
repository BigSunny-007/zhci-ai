import hashlib
import secrets
from datetime import UTC, datetime, timedelta
from typing import Any

from jose import jwt
from passlib.context import CryptContext

from app.core.config import get_settings

password_context = CryptContext(schemes=["argon2"], deprecated="auto")
ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    return password_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return password_context.verify(password, password_hash)


def create_token(
    subject: str, token_type: str, expires_delta: timedelta, session_version: int = 0
) -> str:
    settings = get_settings()
    now = datetime.now(UTC)
    payload: dict[str, Any] = {
        "sub": subject,
        "type": token_type,
        "iat": now,
        "exp": now + expires_delta,
        "session_version": session_version,
    }
    return jwt.encode(payload, settings.secret_key, algorithm=ALGORITHM)


def create_access_token(subject: str, session_version: int = 0) -> str:
    settings = get_settings()
    return create_token(
        subject, "access", timedelta(minutes=settings.access_token_minutes), session_version
    )


def create_refresh_token(subject: str, session_version: int = 0) -> str:
    settings = get_settings()
    return create_token(
        subject, "refresh", timedelta(days=settings.refresh_token_days), session_version
    )


def create_verification_token() -> tuple[str, datetime]:
    settings = get_settings()
    raw_token = secrets.token_urlsafe(32)
    expires_at = datetime.now(UTC) + timedelta(minutes=settings.verification_token_minutes)
    return raw_token, expires_at


def hash_verification_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
