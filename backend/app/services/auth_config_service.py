"""
Google OAuth configuration — loaded from SiteSettings with env fallback.
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.site_settings import SiteSettings

settings = get_settings()
GOOGLE_OAUTH_KEY = "google_oauth"


async def get_google_oauth_config(db: AsyncSession) -> dict:
    """Return merged Google OAuth config (DB overrides env)."""
    result = await db.execute(
        select(SiteSettings).where(SiteSettings.key == GOOGLE_OAUTH_KEY)
    )
    row = result.scalar_one_or_none()
    stored = row.value if row and isinstance(row.value, dict) else {}

    client_id = stored.get("client_id") or settings.GOOGLE_CLIENT_ID
    client_secret = stored.get("client_secret") or settings.GOOGLE_CLIENT_SECRET
    enabled = stored.get("enabled")
    if enabled is None:
        enabled = bool(client_id)

    redirect_uri = (
        stored.get("redirect_uri")
        or f"{settings.FRONTEND_URL.rstrip('/')}/login"
    )

    return {
        "client_id": client_id or "",
        "client_secret": client_secret or "",
        "enabled": bool(enabled and client_id),
        "redirect_uri": redirect_uri,
        "status": "configured" if client_id else "not_configured",
    }


async def save_google_oauth_config(
    db: AsyncSession,
    *,
    client_id: str,
    client_secret: str,
    enabled: bool,
    redirect_uri: str | None,
    admin_id,
) -> dict:
    payload = {
        "client_id": client_id.strip(),
        "client_secret": client_secret.strip(),
        "enabled": enabled,
        "redirect_uri": redirect_uri or f"{settings.FRONTEND_URL.rstrip('/')}/login",
        "category": "authentication",
    }

    result = await db.execute(
        select(SiteSettings).where(SiteSettings.key == GOOGLE_OAUTH_KEY)
    )
    row = result.scalar_one_or_none()
    if row:
        if not payload["client_secret"] and isinstance(row.value, dict):
            payload["client_secret"] = row.value.get("client_secret", "")
        row.value = payload
        row.updated_by = admin_id
    else:
        db.add(
            SiteSettings(
                key=GOOGLE_OAUTH_KEY,
                value=payload,
                category="authentication",
                updated_by=admin_id,
            )
        )
    await db.flush()
    return await get_google_oauth_config(db)


async def get_public_google_config(db: AsyncSession) -> dict:
    """Public-safe config for frontend (no secret)."""
    cfg = await get_google_oauth_config(db)
    return {
        "enabled": cfg["enabled"],
        "client_id": cfg["client_id"] if cfg["enabled"] else "",
        "redirect_uri": cfg["redirect_uri"],
    }


async def test_google_connection(db: AsyncSession) -> dict:
    cfg = await get_google_oauth_config(db)
    if not cfg["client_id"]:
        return {"ok": False, "message": "Google Client ID is not configured."}
    if not cfg["enabled"]:
        return {"ok": False, "message": "Google Login is disabled."}
    return {
        "ok": True,
        "message": "Google OAuth credentials are configured and enabled.",
        "client_id_preview": f"{cfg['client_id'][:12]}...",
        "redirect_uri": cfg["redirect_uri"],
    }