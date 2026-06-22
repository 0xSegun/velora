"""
Security endpoints — MFA, sessions, monitoring for admin control center.
"""

import uuid

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.schemas.auth import TokenResponse
from app.schemas.security import (
    ChangePasswordRequest,
    MfaDisableRequest,
    MfaEnableRequest,
    MfaSetupResponse,
    MfaVerifyRequest,
)
from app.services import security_service
from app.utils.security import get_current_user, require_admin

router = APIRouter(prefix="/api/admin/security", tags=["Security"])


@router.get("/overview")
async def security_overview(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_admin),
):
    return await security_service.get_security_overview(db, user)


@router.get("/login-history")
async def login_history(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_admin),
):
    return await security_service.get_login_history(db, user)


@router.get("/sessions")
async def list_sessions(
    request: Request,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_admin),
):
    refresh = request.headers.get("x-refresh-token")
    return await security_service.list_user_sessions(db, user, current_token=refresh)


@router.delete("/sessions/{session_id}")
async def revoke_session(
    session_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_admin),
):
    result = await security_service.revoke_session_by_id(db, user, session_id, request=request)
    await db.commit()
    return result


@router.post("/sessions/revoke-others")
async def revoke_other_sessions(
    request: Request,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_admin),
):
    refresh = request.headers.get("x-refresh-token")
    result = await security_service.revoke_other_sessions(
        db, user, refresh, request=request
    )
    await db.commit()
    return result


@router.post("/mfa/setup", response_model=MfaSetupResponse)
async def mfa_setup(
    request: Request,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_admin),
):
    result = await security_service.setup_mfa(db, user, request=request)
    await db.commit()
    return result


@router.post("/mfa/enable")
async def mfa_enable(
    payload: MfaEnableRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_admin),
):
    result = await security_service.enable_mfa(db, user, payload.code, request=request)
    await db.commit()
    return result


@router.post("/mfa/disable")
async def mfa_disable(
    payload: MfaDisableRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_admin),
):
    result = await security_service.disable_mfa(
        db, user, password=payload.password, code=payload.code, request=request
    )
    await db.commit()
    return result


@router.post("/change-password")
async def change_password(
    payload: ChangePasswordRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_admin),
):
    result = await security_service.change_password(
        db,
        user,
        current_password=payload.current_password,
        new_password=payload.new_password,
        request=request,
    )
    await db.commit()
    return result