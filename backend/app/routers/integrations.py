"""
Unified platform integrations registry for the API Configuration Center.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.services import integrations_registry_service
from app.utils.security import get_current_user, require_admin

router = APIRouter(
    prefix="/api/admin/integrations",
    tags=["Integrations"],
    dependencies=[Depends(require_admin)],
)


@router.get("")
async def list_platform_integrations(db: AsyncSession = Depends(get_db)):
    return await integrations_registry_service.list_integrations(db)


@router.post("/{integration_id}/sync")
async def sync_platform_integration(
    integration_id: str,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_user),
):
    result = await integrations_registry_service.trigger_integration_sync(
        db, integration_id, admin_id=admin.id
    )
    if not result.get("background"):
        await db.commit()
    return result