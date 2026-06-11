"""
Admin endpoints — dashboard, settings, AI models, system health, analytics.
"""

import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.api_config import ApiConfiguration, ApiType
from app.models.economic_data import DataSource, EconomicData
from app.models.prediction import Prediction
from app.models.site_settings import AIModel, ModelStatus, Notification, NotificationType, SiteSettings
from app.models.user import User, UserRole
from app.services import analytics_service, auth_config_service, site_settings_service
from app.utils.security import get_current_user, require_admin

router = APIRouter(prefix="/api/admin", tags=["Admin"])


# ── Dashboard ─────────────────────────────────────────────────────────────────


@router.get("/dashboard")
async def admin_dashboard(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Admin dashboard stats — user counts, prediction counts, model status."""
    now = datetime.now(timezone.utc)
    thirty_days_ago = now - timedelta(days=30)

    # User stats
    total_users = (await db.execute(select(func.count(User.id)))).scalar() or 0
    active_users = (
        await db.execute(select(func.count(User.id)).where(User.is_active.is_(True)))
    ).scalar() or 0
    new_users_30d = (
        await db.execute(
            select(func.count(User.id)).where(User.created_at >= thirty_days_ago)
        )
    ).scalar() or 0

    # Prediction stats
    total_predictions = (await db.execute(select(func.count(Prediction.id)))).scalar() or 0
    predictions_30d = (
        await db.execute(
            select(func.count(Prediction.id)).where(
                Prediction.created_at >= thirty_days_ago
            )
        )
    ).scalar() or 0

    # Data stats
    total_data_points = (
        await db.execute(select(func.count(EconomicData.id)))
    ).scalar() or 0

    # Model stats
    active_models = (
        await db.execute(
            select(func.count(AIModel.id)).where(AIModel.status == ModelStatus.READY)
        )
    ).scalar() or 0

    from app.services.exchange_rate_service import get_config, get_health

    fx_config = await get_config(db)
    fx_health = await get_health(db)

    return {
        "users": {
            "total": total_users,
            "active": active_users,
            "new_last_30_days": new_users_30d,
        },
        "predictions": {
            "total": total_predictions,
            "last_30_days": predictions_30d,
        },
        "data": {
            "total_data_points": total_data_points,
        },
        "models": {
            "active": active_models,
        },
        "exchange_rate_status": {
            "provider": fx_config.provider_name,
            "is_active": fx_config.is_active,
            "status": fx_health.status,
            "sync_status": fx_config.sync_status.value,
            "last_sync": fx_config.last_sync.isoformat() if fx_config.last_sync else None,
            "next_sync": fx_config.next_sync.isoformat() if fx_config.next_sync else None,
            "success_rate": fx_health.success_rate,
            "error_count": fx_config.error_count,
            "api_key_set": bool(fx_config.api_key),
        },
        "generated_at": now.isoformat(),
    }


# ── Site settings ─────────────────────────────────────────────────────────────


@router.get("/settings")
async def get_settings(
    category: str | None = None,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Retrieve all site settings, optionally filtered by category."""
    query = select(SiteSettings)
    if category:
        query = query.where(SiteSettings.category == category)
    result = await db.execute(query.order_by(SiteSettings.key))
    settings = result.scalars().all()
    return [
        {
            "id": str(s.id),
            "key": s.key,
            "value": s.value,
            "category": s.category,
            "updated_at": s.updated_at.isoformat(),
        }
        for s in settings
    ]


@router.put("/settings")
async def update_settings(
    updates: dict[str, dict],
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Update site settings (key → value mapping).

    Body example::

        { "site_name": {"value": "Velora Pro"}, "maintenance": {"value": false} }
    """
    updated_keys: list[str] = []
    for key, payload in updates.items():
        result = await db.execute(select(SiteSettings).where(SiteSettings.key == key))
        setting = result.scalar_one_or_none()
        if setting:
            setting.value = payload
            setting.updated_by = admin.id
        else:
            setting = SiteSettings(
                key=key,
                value=payload,
                category=payload.get("category", "general") if isinstance(payload, dict) else "general",
                updated_by=admin.id,
            )
            db.add(setting)
        updated_keys.append(key)

    await db.flush()
    return {"updated": updated_keys}


@router.get("/settings/bundle")
async def get_settings_bundle(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Merged CMS, SEO, branding, general, dashboard, and legal settings."""
    bundle = await site_settings_service.get_public_settings(db)

    cred_keys = ["credential_FRED_API_KEY", "credential_RESEND_API_KEY", "credential_RESEND_FROM"]
    cred_result = await db.execute(
        select(SiteSettings).where(SiteSettings.key.in_(cred_keys))
    )
    cred_rows = {row.key: row.value for row in cred_result.scalars().all()}

    def _secret(key: str) -> str:
        val = cred_rows.get(key)
        if isinstance(val, dict):
            return str(val.get("secret", ""))
        return ""

    bundle["credentials"] = {
        "fredKey": _secret("credential_FRED_API_KEY"),
        "resendKey": _secret("credential_RESEND_API_KEY"),
        "resendFrom": _secret("credential_RESEND_FROM") or "noreply@velora.io",
    }
    return bundle


@router.put("/settings/bundle")
async def update_settings_bundle(
    payload: dict[str, dict],
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Update one or more settings sections (cms, seo, branding, general, dashboard, legal)."""
    updated = await site_settings_service.update_settings_bundle(db, payload, admin.id)
    await db.commit()
    return {"updated": updated}


# ── API credentials ──────────────────────────────────────────────────────────


@router.put("/credentials")
async def update_credentials(
    credentials: dict[str, str],
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Store/update API keys (FRED, Resend, etc.) as site settings.

    Body example::

        { "FRED_API_KEY": "abc123", "RESEND_API_KEY": "re_xyz" }
    """
    for key, value in credentials.items():
        result = await db.execute(
            select(SiteSettings).where(SiteSettings.key == f"credential_{key}")
        )
        setting = result.scalar_one_or_none()
        if setting:
            setting.value = {"secret": value}
            setting.updated_by = admin.id
        else:
            setting = SiteSettings(
                key=f"credential_{key}",
                value={"secret": value},
                category="credentials",
                updated_by=admin.id,
            )
            db.add(setting)

    await db.flush()
    return {"message": "Credentials updated", "keys": list(credentials.keys())}


# ── AI models ─────────────────────────────────────────────────────────────────


@router.get("/models")
async def list_models(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """List all registered AI models."""
    result = await db.execute(select(AIModel).order_by(AIModel.created_at.desc()))
    models = result.scalars().all()
    return [
        {
            "id": str(m.id),
            "name": m.name,
            "version": m.version,
            "accuracy": m.accuracy,
            "precision": m.precision_score,
            "recall": m.recall_score,
            "f1_score": m.f1_score,
            "mae": m.mae,
            "rmse": m.rmse,
            "status": m.status.value,
            "model_path": m.model_path,
            "hyperparams": m.hyperparams,
            "trained_at": m.trained_at.isoformat() if m.trained_at else None,
            "created_at": m.created_at.isoformat(),
        }
        for m in models
    ]


@router.post("/models/train", status_code=202)
async def trigger_training(
    config: dict | None = None,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Trigger model training (creates a training record; actual training
    would be dispatched to a background worker in production)."""
    hyperparams = config or {
        "learning_rate": 0.001,
        "epochs": 100,
        "batch_size": 32,
        "hidden_dim": 64,
        "dropout": 0.2,
    }

    model_record = AIModel(
        name="InflationNet",
        version=f"v{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}",
        status=ModelStatus.TRAINING,
        hyperparams=hyperparams,
    )
    db.add(model_record)
    await db.flush()
    await db.refresh(model_record)

    # In production: dispatch to Celery / ARQ / RQ worker
    # For now, simulate completion
    model_record.status = ModelStatus.READY
    model_record.accuracy = 0.89
    model_record.precision_score = 0.87
    model_record.recall_score = 0.91
    model_record.f1_score = 0.89
    model_record.mae = 1.23
    model_record.rmse = 1.67
    model_record.trained_at = datetime.now(timezone.utc)
    model_record.model_path = f"models/inflation_net_{model_record.version}.pt"
    await db.flush()

    return {
        "message": "Model training initiated",
        "model_id": str(model_record.id),
        "version": model_record.version,
        "status": model_record.status.value,
    }


# ── System health ─────────────────────────────────────────────────────────────


@router.get("/system-health")
async def system_health(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """System health check — database connectivity, model availability."""
    health: dict = {"status": "healthy", "checks": {}}

    # Database
    try:
        await db.execute(select(func.now()))
        health["checks"]["database"] = {"status": "up"}
    except Exception as exc:
        health["status"] = "degraded"
        health["checks"]["database"] = {"status": "down", "error": str(exc)}

    # AI model
    try:
        result = await db.execute(
            select(AIModel).where(AIModel.status == ModelStatus.READY).limit(1)
        )
        model = result.scalar_one_or_none()
        health["checks"]["ai_model"] = {
            "status": "available" if model else "no_model",
            "latest_version": model.version if model else None,
        }
    except Exception:
        health["checks"]["ai_model"] = {"status": "error"}

    health["timestamp"] = datetime.now(timezone.utc).isoformat()
    return health


# ── Analytics ─────────────────────────────────────────────────────────────────


@router.get("/analytics")
async def platform_analytics(
    days: int = 30,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Platform analytics — usage trends, popular countries, user growth."""
    now = datetime.now(timezone.utc)
    since = now - timedelta(days=days)

    # Predictions per country
    country_q = (
        select(
            Prediction.country_code,
            func.count(Prediction.id).label("count"),
        )
        .where(Prediction.created_at >= since)
        .group_by(Prediction.country_code)
        .order_by(func.count(Prediction.id).desc())
        .limit(10)
    )
    country_result = await db.execute(country_q)
    top_countries = [
        {"country_code": row.country_code, "predictions": row.count}
        for row in country_result.all()
    ]

    # User registrations per day (last N days)
    reg_day = func.date(User.created_at)
    reg_q = (
        select(reg_day.label("day"), func.count(User.id).label("count"))
        .where(User.created_at >= since)
        .group_by(reg_day)
        .order_by(reg_day)
    )
    reg_result = await db.execute(reg_q)
    registrations = [
        {"date": row.day.isoformat(), "count": row.count}
        for row in reg_result.all()
    ]

    # Average confidence and risk distribution
    avg_confidence = (
        await db.execute(
            select(func.avg(Prediction.confidence_score)).where(
                Prediction.created_at >= since
            )
        )
    ).scalar()

    risk_q = (
        select(
            Prediction.risk_level,
            func.count(Prediction.id).label("count"),
        )
        .where(Prediction.created_at >= since)
        .group_by(Prediction.risk_level)
    )
    risk_result = await db.execute(risk_q)
    risk_distribution = {row.risk_level: row.count for row in risk_result.all()}

    return {
        "period_days": days,
        "top_countries": top_countries,
        "user_registrations": registrations,
        "average_confidence": round(avg_confidence, 4) if avg_confidence else None,
        "risk_distribution": risk_distribution,
        "generated_at": now.isoformat(),
    }


# ── Google OAuth (admin-managed) ──────────────────────────────────────────────


@router.get("/auth/google")
async def get_google_oauth_settings(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    cfg = await auth_config_service.get_google_oauth_config(db)
    return {
        "client_id": cfg["client_id"],
        "client_secret": "***" if cfg["client_secret"] else "",
        "has_secret": bool(cfg["client_secret"]),
        "enabled": cfg["enabled"],
        "redirect_uri": cfg["redirect_uri"],
        "status": cfg["status"],
    }


@router.put("/auth/google")
async def update_google_oauth_settings(
    payload: dict,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    secret = payload.get("client_secret", "")
    if secret == "***":
        existing = await auth_config_service.get_google_oauth_config(db)
        secret = existing["client_secret"]
    return await auth_config_service.save_google_oauth_config(
        db,
        client_id=payload.get("client_id", ""),
        client_secret=secret,
        enabled=bool(payload.get("enabled", True)),
        redirect_uri=payload.get("redirect_uri"),
        admin_id=admin.id,
    )


@router.post("/auth/google/test")
async def test_google_oauth(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    return await auth_config_service.test_google_connection(db)


# ── Economic Data Management ──────────────────────────────────────────────────


@router.get("/economic-data")
async def economic_data_management(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Active sources, sync status, and refresh schedules for economic data."""
    configs_q = await db.execute(
        select(ApiConfiguration).where(ApiConfiguration.api_type == ApiType.ECONOMIC)
    )
    configs = configs_q.scalars().all()

    source_stats: list[dict] = []
    for source in DataSource:
        latest_q = await db.execute(
            select(func.max(EconomicData.data_date), func.max(EconomicData.created_at))
            .where(EconomicData.source == source)
        )
        row = latest_q.one()
        count_q = await db.execute(
            select(func.count(EconomicData.id)).where(EconomicData.source == source)
        )
        source_stats.append({
            "source": source.value,
            "records": count_q.scalar() or 0,
            "last_data_date": row[0].isoformat() if row[0] else None,
            "last_sync_at": row[1].isoformat() if row[1] else None,
        })

    from app.services.exchange_rate_service import get_config as get_fx_config

    fx_config = await get_fx_config(db)
    fx_interval = fx_config.refresh_interval.value.capitalize()

    refresh_schedules = {
        "inflation": "Daily",
        "exchange_rates": fx_interval,
        "gdp": "On official release",
        "interest_rates": "Daily",
        "indicators": "Source availability",
    }

    return {
        "sources": source_stats,
        "api_connections": [
            {
                "id": str(c.id),
                "name": c.name,
                "provider": c.provider,
                "endpoint_url": c.endpoint_url,
                "is_active": c.is_active,
                "health_status": c.health_status.value,
                "refresh_frequency_hours": c.refresh_frequency_hours,
                "last_sync_at": c.last_sync_at.isoformat() if c.last_sync_at else None,
                "last_tested_at": c.last_tested_at.isoformat() if c.last_tested_at else None,
            }
            for c in configs
        ],
        "refresh_schedules": refresh_schedules,
        "approved_providers": [
            "World Bank", "IMF", "FRED", "OECD", "Trading Economics", "CBN", "NBS",
        ],
    }


@router.post("/economic-data/sync")
async def trigger_economic_sync(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    from app.services import data_service

    result = await data_service.sync_indicators(db)
    await db.commit()
    return {"message": "Economic data sync completed", **result}
