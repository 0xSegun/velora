"""Upload and serve website branding assets (logo, favicon, social images)."""

from __future__ import annotations

import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.services import site_settings_service

settings = get_settings()
BACKEND_ROOT = Path(__file__).resolve().parents[2]
BRANDING_DIR_NAME = "branding"
ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".svg", ".ico", ".gif"}
MAX_BYTES = {
    "logo": 5 * 1024 * 1024,
    "favicon": 1 * 1024 * 1024,
    "og_image": 8 * 1024 * 1024,
    "twitter_image": 8 * 1024 * 1024,
}

ASSET_TARGETS: dict[str, tuple[str, str]] = {
    "logo": ("branding", "logoUrl"),
    "favicon": ("branding", "faviconUrl"),
    "og_image": ("seo", "ogImage"),
    "twitter_image": ("seo", "twitterImage"),
}


def branding_dir() -> Path:
    path = BACKEND_ROOT / settings.UPLOAD_DIR / BRANDING_DIR_NAME
    path.mkdir(parents=True, exist_ok=True)
    return path


def build_public_url(base_url: str, filename: str) -> str:
    root = base_url.rstrip("/")
    return f"{root}/files/branding/{filename}"


async def upload_branding_asset(
    db: AsyncSession,
    *,
    asset_type: str,
    file: UploadFile,
    base_url: str,
    admin_id,
) -> dict:
    if asset_type not in ASSET_TARGETS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid asset_type. Allowed: {', '.join(ASSET_TARGETS)}",
        )

    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename is required")

    suffix = Path(file.filename).suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}",
        )

    content = await file.read()
    limit = MAX_BYTES[asset_type]
    if len(content) > limit:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Max {limit // (1024 * 1024)}MB for {asset_type}.",
        )

    stored_name = f"{asset_type}_{uuid.uuid4().hex}{suffix}"
    dest = branding_dir() / stored_name
    dest.write_bytes(content)

    public_url = build_public_url(base_url, stored_name)
    section, field = ASSET_TARGETS[asset_type]

    bundle = await site_settings_service.get_public_settings(db)
    section_data = dict(bundle.get(section, {}))
    section_data[field] = public_url
    await site_settings_service.update_settings_bundle(db, {section: section_data}, admin_id)
    await db.commit()

    return {
        "asset_type": asset_type,
        "filename": stored_name,
        "url": public_url,
        "section": section,
        "field": field,
    }