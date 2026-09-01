import hmac
from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from jose import JWTError, jwt
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_user
from app.core.config import get_settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    create_verification_token,
    hash_password,
    hash_verification_token,
    verify_password,
)
from app.db.session import get_db
from app.models import AIRecommendation, Alert, AuditLog, Holding, User, WatchlistItem
from app.schemas.account import (
    AuditEventExport,
    DeleteAccountRequest,
    PasswordChangeRequest,
    UserDataExport,
)
from app.schemas.common import (
    APIMessage,
    HoldingResponse,
    LoginRequest,
    RecommendationHistoryItem,
    RefreshRequest,
    RegisterRequest,
    ResendVerificationRequest,
    TokenResponse,
    UserProfileUpdate,
    UserResponse,
    VerificationResponse,
    VerifyEmailRequest,
    WatchlistResponse,
)
from app.services.rate_limit import AuthRateLimit

router = APIRouter(prefix="/auth", tags=["认证"], dependencies=[AuthRateLimit])


def _verification_token_for_response(raw_token: str) -> str | None:
    settings = get_settings()
    if settings.app_env != "production" or settings.expose_verification_token:
        return raw_token
    return None


async def _audit(
    db: AsyncSession,
    *,
    action: str,
    actor_user_id=None,
    resource_id: str | None = None,
    metadata: dict | None = None,
) -> None:
    db.add(
        AuditLog(
            actor_user_id=actor_user_id,
            action=action,
            resource_type="auth",
            resource_id=resource_id,
            metadata_json=metadata or {},
            created_at=datetime.now(UTC),
        )
    )


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    existing = await db.scalar(select(User).where(User.email == payload.email.lower()))
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="邮箱已注册")
    settings = get_settings()
    email_verified = not settings.require_email_verification
    raw_token, expires_at = create_verification_token()
    user = User(
        email=payload.email.lower(),
        password_hash=hash_password(payload.password),
        display_name=payload.display_name,
        email_verified=email_verified,
        verification_token_hash=None if email_verified else hash_verification_token(raw_token),
        verification_expires_at=None if email_verified else expires_at,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    await _audit(db, action="auth.registered", actor_user_id=user.id, resource_id=str(user.id))
    await db.commit()
    return TokenResponse(
        access_token=create_access_token(str(user.id), user.session_version),
        refresh_token=create_refresh_token(str(user.id), user.session_version),
        email_verified=user.email_verified,
        verification_required=not user.email_verified,
        verification_token=None if email_verified else _verification_token_for_response(raw_token),
    )


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    user = await db.scalar(select(User).where(User.email == payload.email.lower()))
    if not user or not verify_password(payload.password, user.password_hash):
        await _audit(db, action="auth.login_failed")
        await db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="邮箱或密码错误")
    if get_settings().require_email_verification and not user.email_verified:
        await _audit(db, action="auth.login_blocked_unverified", actor_user_id=user.id)
        await db.commit()
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="请先完成邮箱验证")
    await _audit(db, action="auth.login_succeeded", actor_user_id=user.id, resource_id=str(user.id))
    await db.commit()
    return TokenResponse(
        access_token=create_access_token(str(user.id), user.session_version),
        refresh_token=create_refresh_token(str(user.id), user.session_version),
        email_verified=user.email_verified,
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    payload: RefreshRequest, db: AsyncSession = Depends(get_db)
) -> TokenResponse:
    settings = get_settings()
    try:
        claims = jwt.decode(payload.refresh_token, settings.secret_key, algorithms=["HS256"])
        if claims.get("type") != "refresh":
            raise ValueError("invalid token type")
        user_id = UUID(str(claims.get("sub")))
    except (JWTError, ValueError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="刷新令牌无效") from None
    user = await db.scalar(select(User).where(User.id == user_id, User.is_active.is_(True)))
    if not user or claims.get("session_version", 0) != user.session_version:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="刷新令牌已失效")
    if settings.require_email_verification and not user.email_verified:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="请先完成邮箱验证")
    await _audit(db, action="auth.token_refreshed", actor_user_id=user.id, resource_id=str(user.id))
    await db.commit()
    return TokenResponse(
        access_token=create_access_token(str(user.id), user.session_version),
        refresh_token=create_refresh_token(str(user.id), user.session_version),
        email_verified=user.email_verified,
    )


@router.post("/verify-email", response_model=VerificationResponse)
async def verify_email(
    payload: VerifyEmailRequest, db: AsyncSession = Depends(get_db)
) -> VerificationResponse:
    user = await db.scalar(select(User).where(User.email == payload.email.lower()))
    if not user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="验证链接无效或已过期")
    if user.email_verified:
        return VerificationResponse(message="邮箱已完成验证", email_verified=True)
    token_hash = user.verification_token_hash
    expires_at = user.verification_expires_at
    if expires_at and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=UTC)
    if (
        not token_hash
        or not expires_at
        or expires_at <= datetime.now(UTC)
        or not hmac.compare_digest(hash_verification_token(payload.token), token_hash)
    ):
        await _audit(db, action="auth.email_verification_failed", actor_user_id=user.id)
        await db.commit()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="验证链接无效或已过期")
    user.email_verified = True
    user.verification_token_hash = None
    user.verification_expires_at = None
    await _audit(db, action="auth.email_verified", actor_user_id=user.id, resource_id=str(user.id))
    await db.commit()
    return VerificationResponse(message="邮箱验证成功，现在可以登录", email_verified=True)


@router.post("/resend-verification", response_model=VerificationResponse)
async def resend_verification(
    payload: ResendVerificationRequest, db: AsyncSession = Depends(get_db)
) -> VerificationResponse:
    user = await db.scalar(select(User).where(User.email == payload.email.lower()))
    generic_response = VerificationResponse(message="如果账号存在，验证邮件将发送至邮箱", email_verified=False)
    if not user or user.email_verified:
        return generic_response if not user else VerificationResponse(message="邮箱已完成验证", email_verified=True)
    raw_token, expires_at = create_verification_token()
    user.verification_token_hash = hash_verification_token(raw_token)
    user.verification_expires_at = expires_at
    await _audit(db, action="auth.verification_resent", actor_user_id=user.id)
    await db.commit()
    return VerificationResponse(
        message="验证邮件已重新发送",
        email_verified=False,
        verification_token=_verification_token_for_response(raw_token),
    )


@router.post("/logout", response_model=APIMessage)
async def logout(user: User = Depends(current_user), db: AsyncSession = Depends(get_db)) -> APIMessage:
    user.session_version += 1
    await _audit(db, action="auth.logout", actor_user_id=user.id, resource_id=str(user.id))
    await db.commit()
    return APIMessage(message="已安全退出，当前会话已失效")


@router.get("/data-export", response_model=UserDataExport)
async def data_export(
    user: User = Depends(current_user), db: AsyncSession = Depends(get_db)
) -> UserDataExport:
    holdings = (
        await db.scalars(select(Holding).where(Holding.user_id == user.id).order_by(Holding.symbol))
    ).all()
    watchlist = (
        await db.scalars(
            select(WatchlistItem).where(WatchlistItem.user_id == user.id).order_by(WatchlistItem.symbol)
        )
    ).all()
    recommendations = (
        await db.scalars(
            select(AIRecommendation)
            .where(AIRecommendation.user_id == user.id)
            .order_by(AIRecommendation.generated_at.desc())
            .limit(500)
        )
    ).all()
    audit_events = (
        await db.scalars(
            select(AuditLog)
            .where(AuditLog.actor_user_id == user.id)
            .order_by(AuditLog.created_at.desc())
            .limit(500)
        )
    ).all()
    return UserDataExport(
        exported_at=datetime.now(UTC),
        user=UserResponse.model_validate(user),
        holdings=[HoldingResponse.model_validate(item) for item in holdings],
        watchlist=[WatchlistResponse.model_validate(item) for item in watchlist],
        recommendations=[RecommendationHistoryItem.model_validate(item) for item in recommendations],
        audit_events=[AuditEventExport.model_validate(item) for item in audit_events],
    )


@router.post("/delete-account", response_model=APIMessage)
async def delete_account(
    payload: DeleteAccountRequest,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> APIMessage:
    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="密码错误")
    db.add(
        AuditLog(
            actor_user_id=user.id,
            action="auth.account_deleted",
            resource_type="user",
            resource_id=str(user.id),
            metadata_json={"confirmation": "verified"},
            created_at=datetime.now(UTC),
        )
    )
    await db.flush()
    await db.execute(delete(AIRecommendation).where(AIRecommendation.user_id == user.id))
    await db.execute(delete(Alert).where(Alert.user_id == user.id))
    await db.execute(delete(Holding).where(Holding.user_id == user.id))
    await db.execute(delete(WatchlistItem).where(WatchlistItem.user_id == user.id))
    await db.delete(user)
    await db.commit()
    return APIMessage(message="账号及个人投研数据已删除，保留的审计记录已去标识化")


@router.post("/change-password", response_model=APIMessage)
async def change_password(
    payload: PasswordChangeRequest,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> APIMessage:
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="当前密码错误")
    if payload.current_password == payload.new_password:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="新密码不能与当前密码相同")
    user.password_hash = hash_password(payload.new_password)
    user.session_version += 1
    await _audit(db, action="auth.password_changed", actor_user_id=user.id, resource_id=str(user.id))
    await db.commit()
    return APIMessage(message="密码已更新，请重新登录")


@router.get("/me", response_model=UserResponse)
async def me(user: User = Depends(current_user)) -> UserResponse:
    return UserResponse.model_validate(user)


@router.patch("/profile", response_model=UserResponse)
async def update_profile(
    payload: UserProfileUpdate,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    changes = payload.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(status_code=422, detail="至少提供一项偏好设置")
    for field, value in changes.items():
        setattr(user, field, value)
    await _audit(
        db,
        action="auth.profile_updated",
        actor_user_id=user.id,
        resource_id=str(user.id),
        metadata={"fields": sorted(changes)},
    )
    await db.commit()
    await db.refresh(user)
    return UserResponse.model_validate(user)
