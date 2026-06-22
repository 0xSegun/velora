"""
Security service — MFA (TOTP), sessions, monitoring, password management.
"""

from __future__ import annotations

import secrets
import uuid
from datetime import datetime, timedelta, timezone

import pyotp
from fastapi import HTTPException, Request, status
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.analytics_event import AnalyticsEvent
from app.models.security_audit import SecurityAuditLog
from app.models.user import User
from app.models.user_session import UserSession
from app.schemas.auth import TokenResponse
from app.schemas.security import MfaSetupResponse, SecurityOverviewResponse
from app.services.exchange_rate_service import decrypt_api_key, encrypt_api_key
from app.services import auth_service, session_service
from app.utils.security import (
    create_access_token,
    hash_password,
    verify_password,
    verify_token,
)

settings = get_settings()
APP_NAME = "Velora"


def _parse_device(user_agent: str | None) -> str:
    if not user_agent:
        return "Unknown device"
    ua = user_agent.lower()
    browser = "Browser"
    if "edg/" in ua or "edge" in ua:
        browser = "Edge"
    elif "chrome" in ua and "edg" not in ua:
        browser = "Chrome"
    elif "firefox" in ua:
        browser = "Firefox"
    elif "safari" in ua and "chrome" not in ua:
        browser = "Safari"
    os = "Unknown OS"
    if "windows" in ua:
        os = "Windows"
    elif "mac os" in ua or "macintosh" in ua:
        os = "macOS"
    elif "iphone" in ua or "ipad" in ua:
        os = "iOS"
    elif "android" in ua:
        os = "Android"
    elif "linux" in ua:
        os = "Linux"
    return f"{browser} on {os}"


def _request_meta(request: Request | None) -> tuple[str | None, str | None]:
    if not request:
        return None, None
    ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent")
    return ip, ua


async def log_security_event(
    db: AsyncSession,
    *,
    user_id: uuid.UUID | None,
    action: str,
    details: dict | None = None,
    request: Request | None = None,
) -> None:
    ip, ua = _request_meta(request)
    db.add(
        SecurityAuditLog(
            user_id=user_id,
            action=action,
            details=details or {},
            ip_address=ip,
            user_agent=ua,
        )
    )
    await db.flush()


def _get_totp(user: User) -> pyotp.TOTP | None:
    secret = decrypt_api_key(user.totp_secret) if user.totp_secret else None
    if not secret:
        return None
    return pyotp.TOTP(secret)


def _verify_totp(user: User, code: str) -> bool:
    totp = _get_totp(user)
    if not totp:
        return False
    normalized = code.replace("-", "").strip()
    if totp.verify(normalized, valid_window=1):
        return True
    if user.backup_codes_hash:
        for idx, hashed in enumerate(user.backup_codes_hash):
            if verify_password(normalized, hashed):
                remaining = list(user.backup_codes_hash)
                remaining.pop(idx)
                user.backup_codes_hash = remaining or None
                return True
    return False


async def setup_mfa(db: AsyncSession, user: User, request: Request | None = None) -> MfaSetupResponse:
    secret = pyotp.random_base32()
    user.totp_secret = encrypt_api_key(secret)
    user.mfa_enabled = False
    backup_codes = [secrets.token_hex(4).upper() for _ in range(8)]
    user.backup_codes_hash = [hash_password(code) for code in backup_codes]
    await db.flush()

    totp = pyotp.TOTP(secret)
    uri = totp.provisioning_uri(name=user.email, issuer_name=APP_NAME)
    await log_security_event(db, user_id=user.id, action="mfa_setup_initiated", request=request)
    return MfaSetupResponse(secret=secret, provisioning_uri=uri, backup_codes=backup_codes)


async def enable_mfa(db: AsyncSession, user: User, code: str, request: Request | None = None) -> dict:
    if not user.totp_secret:
        raise HTTPException(status_code=400, detail="MFA setup not initiated")
    if not _verify_totp(user, code):
        raise HTTPException(status_code=400, detail="Invalid authentication code")
    user.mfa_enabled = True
    await db.flush()
    await log_security_event(db, user_id=user.id, action="mfa_enabled", request=request)
    return {"success": True, "message": "Two-factor authentication enabled"}


async def disable_mfa(
    db: AsyncSession, user: User, *, password: str, code: str, request: Request | None = None
) -> dict:
    if not user.password_hash or not verify_password(password, user.password_hash):
        raise HTTPException(status_code=400, detail="Invalid password")
    if not _verify_totp(user, code):
        raise HTTPException(status_code=400, detail="Invalid authentication code")
    user.mfa_enabled = False
    user.totp_secret = None
    user.backup_codes_hash = None
    await db.flush()
    await log_security_event(db, user_id=user.id, action="mfa_disabled", request=request)
    return {"success": True, "message": "Two-factor authentication disabled"}


def create_mfa_challenge(user: User) -> str:
    return create_access_token(
        {"sub": str(user.id), "purpose": "mfa"},
        expires_delta=timedelta(minutes=5),
    )


async def verify_mfa_login(
    db: AsyncSession, challenge_token: str, code: str, request: Request | None = None
) -> TokenResponse:
    payload = verify_token(challenge_token, expected_type="access")
    if payload.get("purpose") != "mfa":
        raise HTTPException(status_code=401, detail="Invalid MFA challenge")
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid MFA challenge")

    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user = result.scalar_one_or_none()
    if not user or not user.is_active or not user.mfa_enabled:
        raise HTTPException(status_code=401, detail="Invalid MFA challenge")
    if not _verify_totp(user, code):
        await log_security_event(
            db,
            user_id=user.id,
            action="mfa_login_failed",
            request=request,
        )
        raise HTTPException(status_code=401, detail="Invalid authentication code")

    await log_security_event(db, user_id=user.id, action="mfa_login_success", request=request)
    return await auth_service.issue_tokens_for_user(db, user, request=request)


async def change_password(
    db: AsyncSession,
    user: User,
    *,
    current_password: str,
    new_password: str,
    request: Request | None = None,
) -> dict:
    if not user.password_hash or not verify_password(current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    user.password_hash = hash_password(new_password)
    user.password_changed_at = datetime.now(timezone.utc)
    await db.flush()
    await session_service.revoke_all_user_sessions(db, user.id)
    await log_security_event(db, user_id=user.id, action="password_changed", request=request)
    return {"success": True, "message": "Password updated. Please sign in again."}


async def list_user_sessions(
    db: AsyncSession, user: User, *, current_token: str | None = None
) -> list[dict]:
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(UserSession)
        .where(
            UserSession.user_id == user.id,
            UserSession.expires_at > now,
            UserSession.revoked_at.is_(None),
        )
        .order_by(desc(UserSession.last_active_at), desc(UserSession.created_at))
    )
    sessions = result.scalars().all()
    items = []
    for s in sessions:
        items.append(
            {
                "id": str(s.id),
                "device_label": s.device_label or _parse_device(s.user_agent),
                "ip_address": s.ip_address,
                "user_agent": s.user_agent,
                "created_at": s.created_at,
                "last_active_at": s.last_active_at or s.created_at,
                "expires_at": s.expires_at,
                "is_current": bool(current_token and s.token == current_token),
            }
        )
    return items


async def revoke_session_by_id(
    db: AsyncSession, user: User, session_id: uuid.UUID, request: Request | None = None
) -> dict:
    result = await db.execute(
        select(UserSession).where(
            UserSession.id == session_id,
            UserSession.user_id == user.id,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    session.revoked_at = datetime.now(timezone.utc)
    await db.flush()
    await log_security_event(
        db,
        user_id=user.id,
        action="session_revoked",
        details={"session_id": str(session_id)},
        request=request,
    )
    return {"success": True, "message": "Session revoked"}


async def revoke_other_sessions(
    db: AsyncSession, user: User, current_token: str | None, request: Request | None = None
) -> dict:
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(UserSession).where(
            UserSession.user_id == user.id,
            UserSession.revoked_at.is_(None),
            UserSession.expires_at > now,
        )
    )
    revoked = 0
    for session in result.scalars().all():
        if current_token and session.token == current_token:
            continue
        session.revoked_at = now
        revoked += 1
    await db.flush()
    await log_security_event(
        db,
        user_id=user.id,
        action="sessions_revoked_others",
        details={"count": revoked},
        request=request,
    )
    return {"success": True, "message": f"Revoked {revoked} session(s)"}


async def get_security_overview(db: AsyncSession, user: User) -> SecurityOverviewResponse:
    now = datetime.now(timezone.utc)
    day_ago = now - timedelta(hours=24)

    active_sessions = await db.scalar(
        select(func.count(UserSession.id)).where(
            UserSession.user_id == user.id,
            UserSession.expires_at > now,
            UserSession.revoked_at.is_(None),
        )
    )

    failed_logins = await db.scalar(
        select(func.count(AnalyticsEvent.id)).where(
            AnalyticsEvent.user_id == user.id,
            AnalyticsEvent.event_type == "login_failed",
            AnalyticsEvent.created_at >= day_ago,
        )
    )
    successful_logins = await db.scalar(
        select(func.count(AnalyticsEvent.id)).where(
            AnalyticsEvent.user_id == user.id,
            AnalyticsEvent.event_type == "login",
            AnalyticsEvent.created_at >= day_ago,
        )
    )

    audit_result = await db.execute(
        select(SecurityAuditLog)
        .where(SecurityAuditLog.user_id == user.id)
        .order_by(desc(SecurityAuditLog.created_at))
        .limit(10)
    )
    recent_audit = [
        {
            "id": str(row.id),
            "action": row.action,
            "details": row.details,
            "ip_address": row.ip_address,
            "created_at": row.created_at.isoformat(),
        }
        for row in audit_result.scalars().all()
    ]

    alerts: list[dict] = []
    if failed_logins and failed_logins > 3:
        alerts.append(
            {
                "severity": "warning",
                "message": f"{failed_logins} failed login attempts in the last 24 hours",
            }
        )
    if not user.mfa_enabled and user.role.value == "admin":
        alerts.append(
            {
                "severity": "info",
                "message": "Two-factor authentication is not enabled for this admin account",
            }
        )

    return SecurityOverviewResponse(
        mfa_enabled=user.mfa_enabled,
        password_changed_at=user.password_changed_at,
        active_sessions=int(active_sessions or 0),
        failed_logins_24h=int(failed_logins or 0),
        successful_logins_24h=int(successful_logins or 0),
        security_alerts=alerts,
        recent_audit=recent_audit,
    )


async def get_login_history(db: AsyncSession, user: User, *, limit: int = 25) -> list[dict]:
    result = await db.execute(
        select(AnalyticsEvent)
        .where(
            AnalyticsEvent.user_id == user.id,
            AnalyticsEvent.event_type.in_(["login", "login_failed", "mfa_login_success"]),
        )
        .order_by(desc(AnalyticsEvent.created_at))
        .limit(limit)
    )
    items = []
    for row in result.scalars().all():
        status_label = "Success" if row.event_type in ("login", "mfa_login_success") else "Failed"
        items.append(
            {
                "id": str(row.id),
                "event_type": row.event_type,
                "ip_address": row.ip_address,
                "user_agent": row.user_agent,
                "created_at": row.created_at,
                "status": status_label,
                "device_label": _parse_device(row.user_agent),
            }
        )
    return items