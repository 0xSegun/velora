"""
Admin API configuration endpoints.
"""

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.schemas.api_config import (
    ApiConfigCreate,
    ApiConfigResponse,
    ApiConfigUpdate,
    ApiTestResponse,
)
from app.services import api_config_service, report_service
from app.utils.security import get_current_user, require_admin

router = APIRouter(
    prefix="/api/admin/api-configs",
    tags=["API Configuration"],
    dependencies=[Depends(require_admin)],
)


@router.get("", response_model=list[ApiConfigResponse])
async def list_configs(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_user),
):
    return await api_config_service.list_api_configs(db)


@router.post("", response_model=ApiConfigResponse, status_code=201)
async def create_config(
    payload: ApiConfigCreate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_user),
):
    return await api_config_service.create_api_config(db, admin=admin, payload=payload)


@router.get("/health")
async def health_overview(db: AsyncSession = Depends(get_db)):
    return await api_config_service.get_health_overview(db)


@router.get("/logs")
async def api_logs(
    api_id: uuid.UUID | None = None,
    status: str | None = None,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
):
    return await api_config_service.get_filtered_logs(
        db, api_id=api_id, status=status, limit=limit
    )


@router.post("/refresh-reports")
async def refresh_reports(db: AsyncSession = Depends(get_db)):
    synced = await report_service.sync_reports_from_apis(db)
    return {"synced": synced}


@router.put("/{config_id}", response_model=ApiConfigResponse)
async def update_config(
    config_id: uuid.UUID,
    payload: ApiConfigUpdate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_user),
):
    return await api_config_service.update_api_config(
        db, config_id=config_id, admin=admin, payload=payload
    )


@router.delete("/{config_id}", status_code=204)
async def delete_config(
    config_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    await api_config_service.delete_api_config(db, config_id)


@router.post("/{config_id}/test", response_model=ApiTestResponse)
async def test_config(
    config_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    return await api_config_service.test_api_config(db, config_id)


@router.post("/{config_id}/sync")
async def sync_config(
    config_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    return await api_config_service.sync_api_config(db, config_id)


# Alias router — /api/admin/apis (frontend/admin spec compatibility)
alias_router = APIRouter(
    prefix="/api/admin/apis",
    tags=["API Configuration"],
    dependencies=[Depends(require_admin)],
)

alias_router.add_api_route("", list_configs, methods=["GET"], response_model=list[ApiConfigResponse])
alias_router.add_api_route("", create_config, methods=["POST"], response_model=ApiConfigResponse, status_code=201)
alias_router.add_api_route("/{config_id}", update_config, methods=["PUT"], response_model=ApiConfigResponse)
alias_router.add_api_route("/{config_id}", delete_config, methods=["DELETE"], status_code=204)
alias_router.add_api_route("/{config_id}/test", test_config, methods=["POST"], response_model=ApiTestResponse)