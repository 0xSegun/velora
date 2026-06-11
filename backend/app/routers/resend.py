"""
Resend email API endpoints — admin config and statistics.
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.schemas.resend import (
    ResendAuditLogResponse,
    ResendConfigResponse,
    ResendConfigUpdate,
    ResendHealthResponse,
    ResendLogResponse,
    ResendSendTestRequest,
    ResendStatisticsResponse,
    ResendTestRequest,
    ResendTestResponse,
)
from app.services import resend_service
from app.utils.security import get_current_user, require_admin

admin_router = APIRouter(
    prefix="/api/admin/resend-config",
    tags=["Resend Email API"],
    dependencies=[Depends(require_admin)],
)

stats_router = APIRouter(
    prefix="/api/admin/resend",
    tags=["Resend Email API"],
    dependencies=[Depends(require_admin)],
)


@admin_router.get("", response_model=ResendConfigResponse)
async def get_resend_config(db: AsyncSession = Depends(get_db)):
    config = await resend_service.get_config(db)
    return resend_service._to_config_response(config)


@admin_router.put("", response_model=ResendConfigResponse)
async def update_resend_config(
    payload: ResendConfigUpdate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_user),
):
    return await resend_service.update_config(db, admin=admin, payload=payload)


@admin_router.post("/test", response_model=ResendTestResponse)
async def test_resend_connection(
    payload: ResendTestRequest | None = None,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_user),
):
    api_key = payload.api_key if payload else None
    try:
        return await resend_service.test_connection(
            db, api_key_override=api_key, admin_id=admin.id
        )
    except Exception:
        return ResendTestResponse(
            success=False,
            message="Connection test failed. Please try again.",
            diagnostics={"error_type": "unexpected_error"},
        )


@admin_router.post("/send-test", response_model=ResendTestResponse)
async def send_resend_test_email(
    payload: ResendSendTestRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_user),
):
    return await resend_service.send_test_email(
        db,
        to=payload.to,
        api_key_override=payload.api_key,
        admin_id=admin.id,
    )


@admin_router.post("/enable", response_model=ResendConfigResponse)
async def enable_resend_api(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_user),
):
    return await resend_service.enable_api(db, admin=admin)


@admin_router.post("/disable", response_model=ResendConfigResponse)
async def disable_resend_api(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_user),
):
    return await resend_service.disable_api(db, admin=admin)


@admin_router.get("/health", response_model=ResendHealthResponse)
async def resend_health(db: AsyncSession = Depends(get_db)):
    return await resend_service.get_health(db)


@admin_router.get("/audit-logs", response_model=list[ResendAuditLogResponse])
async def resend_audit_logs(
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
):
    return await resend_service.get_audit_logs(db, limit=limit)


@admin_router.get("/logs", response_model=list[ResendLogResponse])
async def resend_logs(
    status: str | None = Query(None),
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
):
    return await resend_service.get_logs(db, status_filter=status, limit=limit)


@stats_router.get("/statistics", response_model=ResendStatisticsResponse)
async def resend_statistics(db: AsyncSession = Depends(get_db)):
    try:
        return await resend_service.get_statistics(db)
    except Exception:
        return resend_service._empty_statistics(
            reason="Unable to load Resend statistics right now. Try again shortly.",
        )


@stats_router.get("/emails")
async def resend_emails(
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    return await resend_service.list_emails(db, limit=limit)


@stats_router.get("/domains")
async def resend_domains(db: AsyncSession = Depends(get_db)):
    return await resend_service.list_domains(db)