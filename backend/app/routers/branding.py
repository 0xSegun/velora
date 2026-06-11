"""Admin branding asset uploads."""

from fastapi import APIRouter, Depends, File, Query, Request, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.services import branding_assets_service
from app.utils.security import require_admin

router = APIRouter(prefix="/api/admin/branding", tags=["Admin Branding"])


@router.post("/upload")
async def upload_branding_asset(
    request: Request,
    asset_type: str = Query(
        ...,
        description="logo | favicon | og_image | twitter_image",
    ),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Upload logo, favicon, or social share image and persist URL in site settings."""
    base_url = str(request.base_url)
    result = await branding_assets_service.upload_branding_asset(
        db,
        asset_type=asset_type,
        file=file,
        base_url=base_url,
        admin_id=admin.id,
    )
    return result