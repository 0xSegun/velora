"""
Real analytics aggregation — no mock or seeded demo metrics.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.analytics_event import AnalyticsEvent
from app.models.country import Country
from app.models.dataset import Dataset
from app.models.economic_data import EconomicData
from app.models.model_training import ModelTraining
from app.models.prediction import Prediction
from app.models.report import Report
from app.models.site_settings import AIModel, SiteSettings
from app.models.system_log import LogLevel, SystemLog
from app.models.user import User
from app.models.user_session import UserSession
from app.services.country_service import load_countries_map, serialize_country

ANALYTICS_CONFIG_KEY = "analytics_config"


async def get_analytics_config(db: AsyncSession) -> dict:
    result = await db.execute(
        select(SiteSettings).where(SiteSettings.key == ANALYTICS_CONFIG_KEY)
    )
    row = result.scalar_one_or_none()
    if row and isinstance(row.value, dict):
        return row.value
    return {
        "tracking_enabled": True,
        "retention_days": 90,
        "modules": {
            "users": True,
            "predictions": True,
            "models": True,
            "reports": True,
            "system": True,
            "countries": True,
        },
    }


async def save_analytics_config(db: AsyncSession, config: dict, admin_id) -> dict:
    result = await db.execute(
        select(SiteSettings).where(SiteSettings.key == ANALYTICS_CONFIG_KEY)
    )
    row = result.scalar_one_or_none()
    if row:
        row.value = config
        row.updated_by = admin_id
    else:
        db.add(
            SiteSettings(
                key=ANALYTICS_CONFIG_KEY,
                value=config,
                category="analytics",
                updated_by=admin_id,
            )
        )
    await db.flush()
    return config


async def reset_analytics(db: AsyncSession) -> dict:
    """Clear analytics events only — retain users, predictions, reports, datasets."""
    result = await db.execute(delete(AnalyticsEvent))
    deleted = result.rowcount or 0
    await db.flush()
    return {"deleted_events": deleted, "message": "Analytics events cleared."}


async def get_comprehensive_analytics(db: AsyncSession, days: int = 30) -> dict:
    now = datetime.now(timezone.utc)
    since = now - timedelta(days=days)
    countries_map = await load_countries_map(db)

    # ── Users ─────────────────────────────────────────────────────────────
    total_users = (await db.execute(select(func.count(User.id)))).scalar() or 0
    active_users = (
        await db.execute(select(func.count(User.id)).where(User.is_active.is_(True)))
    ).scalar() or 0
    new_registrations = (
        await db.execute(
            select(func.count(User.id)).where(User.created_at >= since)
        )
    ).scalar() or 0

    reg_day = func.date(User.created_at)
    reg_q = (
        select(reg_day.label("day"), func.count(User.id).label("count"))
        .where(User.created_at >= since)
        .group_by(reg_day)
        .order_by(reg_day)
    )
    user_growth = [
        {"date": row.day.isoformat(), "count": row.count}
        for row in (await db.execute(reg_q)).all()
    ]

    country_users_q = (
        select(User.country, func.count(User.id).label("count"))
        .group_by(User.country)
        .order_by(func.count(User.id).desc())
    )
    user_by_country = []
    for row in (await db.execute(country_users_q)).all():
        meta = serialize_country(row.country)
        user_by_country.append({**meta, "users": row.count})

    login_events = (
        await db.execute(
            select(func.count(AnalyticsEvent.id)).where(
                AnalyticsEvent.event_type == "login",
                AnalyticsEvent.created_at >= since,
            )
        )
    ).scalar() or 0

    active_sessions = (
        await db.execute(select(func.count(UserSession.id)))
    ).scalar() or 0

    # ── Predictions ───────────────────────────────────────────────────────
    total_predictions = (await db.execute(select(func.count(Prediction.id)))).scalar() or 0
    predictions_period = (
        await db.execute(
            select(func.count(Prediction.id)).where(Prediction.created_at >= since)
        )
    ).scalar() or 0

    pred_country_q = (
        select(Prediction.country_code, func.count(Prediction.id).label("count"))
        .where(Prediction.created_at >= since)
        .group_by(Prediction.country_code)
        .order_by(func.count(Prediction.id).desc())
    )
    predictions_by_country = []
    for row in (await db.execute(pred_country_q)).all():
        meta = serialize_country(row.country_code)
        predictions_by_country.append({**meta, "predictions": row.count})

    avg_confidence = (
        await db.execute(
            select(func.avg(Prediction.confidence_score)).where(
                Prediction.created_at >= since
            )
        )
    ).scalar()

    conf_day = func.date(Prediction.created_at)
    conf_trend_q = (
        select(
            conf_day.label("day"),
            func.avg(Prediction.confidence_score).label("confidence"),
        )
        .where(Prediction.created_at >= since)
        .group_by(conf_day)
        .order_by(conf_day)
    )
    confidence_trend = [
        {"date": row.day.isoformat(), "confidence": round(float(row.confidence or 0) * 100, 2)}
        for row in (await db.execute(conf_trend_q)).all()
    ]

    risk_q = (
        select(Prediction.risk_level, func.count(Prediction.id))
        .where(Prediction.created_at >= since)
        .group_by(Prediction.risk_level)
    )
    risk_distribution = {row[0]: row[1] for row in (await db.execute(risk_q)).all()}

    # ── AI Models ─────────────────────────────────────────────────────────
    models = (await db.execute(select(AIModel).order_by(AIModel.created_at.desc()))).scalars().all()
    model_analytics = [
        {
            "name": m.name,
            "version": m.version,
            "accuracy": m.accuracy,
            "rmse": m.rmse,
            "mae": m.mae,
            "status": m.status.value,
            "trained_at": m.trained_at.isoformat() if m.trained_at else None,
        }
        for m in models
    ]
    training_sessions = (
        await db.execute(select(func.count(ModelTraining.id)))
    ).scalar() or 0
    datasets_count = (
        await db.execute(select(func.count(Dataset.id)))
    ).scalar() or 0

    # ── Reports ───────────────────────────────────────────────────────────
    total_reports = (await db.execute(select(func.count(Report.id)))).scalar() or 0
    report_views = (
        await db.execute(
            select(func.count(AnalyticsEvent.id)).where(
                AnalyticsEvent.event_type == "report_view",
                AnalyticsEvent.created_at >= since,
            )
        )
    ).scalar() or 0
    report_downloads = (
        await db.execute(
            select(func.count(AnalyticsEvent.id)).where(
                AnalyticsEvent.event_type == "report_download",
                AnalyticsEvent.created_at >= since,
            )
        )
    ).scalar() or 0

    report_type_q = (
        select(Report.report_type, func.count(Report.id))
        .group_by(Report.report_type)
    )
    report_categories = {str(row[0].value if hasattr(row[0], "value") else row[0]): row[1] for row in (await db.execute(report_type_q)).all()}

    # ── System ────────────────────────────────────────────────────────────
    api_requests = (
        await db.execute(
            select(func.count(AnalyticsEvent.id)).where(
                AnalyticsEvent.event_type == "api_request",
                AnalyticsEvent.created_at >= since,
            )
        )
    ).scalar() or 0
    api_failures = (
        await db.execute(
            select(func.count(SystemLog.id)).where(
                SystemLog.level.in_([LogLevel.ERROR, LogLevel.CRITICAL]),
                SystemLog.created_at >= since,
            )
        )
    ).scalar() or 0
    api_success_rate = (
        round((1 - api_failures / max(api_requests, 1)) * 100, 2) if api_requests else 100.0
    )

    data_points = (
        await db.execute(select(func.count(EconomicData.id)))
    ).scalar() or 0

    countries_tracked = (
        await db.execute(select(func.count(Country.id)))
    ).scalar() or 0

    # ── Country analytics ─────────────────────────────────────────────────
    country_coverage = []
    for code, meta in countries_map.items():
        pred_count = (
            await db.execute(
                select(func.count(Prediction.id)).where(Prediction.country_code == code)
            )
        ).scalar() or 0
        user_count = (
            await db.execute(select(func.count(User.id)).where(User.country == code))
        ).scalar() or 0
        country_coverage.append({**meta, "predictions": pred_count, "users": user_count})

    # ── Engagement & events ─────────────────────────────────────────────────
    event_type_q = (
        select(AnalyticsEvent.event_type, func.count(AnalyticsEvent.id))
        .where(AnalyticsEvent.created_at >= since)
        .group_by(AnalyticsEvent.event_type)
        .order_by(func.count(AnalyticsEvent.id).desc())
    )
    events_by_type = [
        {"event_type": row[0], "count": row[1]}
        for row in (await db.execute(event_type_q)).all()
    ]

    page_view_rows = (
        await db.execute(
            select(AnalyticsEvent.event_metadata).where(
                AnalyticsEvent.event_type == "page_view",
                AnalyticsEvent.created_at >= since,
            )
        )
    ).scalars().all()
    page_counts: dict[str, int] = {}
    for meta in page_view_rows:
        if isinstance(meta, dict):
            path = str(meta.get("path") or "/")
            page_counts[path] = page_counts.get(path, 0) + 1
    top_pages = [
        {"path": path, "views": count}
        for path, count in sorted(page_counts.items(), key=lambda x: x[1], reverse=True)[:15]
    ]

    page_views_total = (
        await db.execute(
            select(func.count(AnalyticsEvent.id)).where(
                AnalyticsEvent.event_type == "page_view",
                AnalyticsEvent.created_at >= since,
            )
        )
    ).scalar() or 0

    google_logins = (
        await db.execute(
            select(func.count(AnalyticsEvent.id)).where(
                AnalyticsEvent.event_type.in_(["google_login", "google_register"]),
                AnalyticsEvent.created_at >= since,
            )
        )
    ).scalar() or 0

    registrations = (
        await db.execute(
            select(func.count(AnalyticsEvent.id)).where(
                AnalyticsEvent.event_type == "register",
                AnalyticsEvent.created_at >= since,
            )
        )
    ).scalar() or 0

    conversion_rate = (
        round((registrations / max(page_views_total, 1)) * 100, 2)
        if page_views_total
        else 0.0
    )

    event_day = func.date(AnalyticsEvent.created_at)
    activity_q = (
        select(event_day.label("day"), func.count(AnalyticsEvent.id).label("count"))
        .where(AnalyticsEvent.created_at >= since)
        .group_by(event_day)
        .order_by(event_day)
    )
    activity_trend = [
        {"date": row.day.isoformat(), "events": row.count}
        for row in (await db.execute(activity_q)).all()
    ]

    has_data = any([
        total_users,
        total_predictions,
        total_reports,
        user_growth,
        predictions_by_country,
        events_by_type,
    ])

    return {
        "period_days": days,
        "has_data": has_data,
        "generated_at": now.isoformat(),
        "users": {
            "total": total_users,
            "active": active_users,
            "new_registrations": new_registrations,
            "login_activity": login_events,
            "active_sessions": active_sessions,
            "growth_trend": user_growth,
            "by_country": user_by_country,
        },
        "predictions": {
            "total": total_predictions,
            "period": predictions_period,
            "by_country": predictions_by_country,
            "average_confidence": round(float(avg_confidence or 0) * 100, 2) if avg_confidence else None,
            "confidence_trend": confidence_trend,
            "risk_distribution": risk_distribution,
        },
        "models": {
            "deployments": model_analytics,
            "training_sessions": training_sessions,
            "datasets": datasets_count,
        },
        "reports": {
            "total": total_reports,
            "views": report_views,
            "downloads": report_downloads,
            "categories": report_categories,
        },
        "system": {
            "api_requests": api_requests,
            "api_failures": api_failures,
            "api_success_rate": api_success_rate,
            "data_points": data_points,
            "countries_tracked": countries_tracked,
        },
        "countries": {
            "coverage": sorted(country_coverage, key=lambda x: x.get("predictions", 0), reverse=True),
        },
        "engagement": {
            "page_views": page_views_total,
            "top_pages": top_pages,
            "events_by_type": events_by_type,
            "activity_trend": activity_trend,
            "registrations": registrations,
            "google_auth": google_logins,
            "conversion_rate": conversion_rate,
        },
        "exchange_rates": await _exchange_rate_analytics_section(db),
    }


async def _exchange_rate_analytics_section(db: AsyncSession) -> dict:
    from app.services.exchange_rate_service import get_analytics

    analytics = await get_analytics(db)
    return {
        "summary": analytics.summary,
        "strongest": analytics.strongest,
        "weakest": analytics.weakest,
        "most_volatile": analytics.most_volatile,
        "trends": analytics.trends,
    }


async def export_analytics_csv(db: AsyncSession, days: int = 30) -> str:
    data = await get_comprehensive_analytics(db, days)
    lines = ["section,key,value"]
    for section, payload in data.items():
        if isinstance(payload, dict):
            for key, value in payload.items():
                if not isinstance(value, (list, dict)):
                    lines.append(f"{section},{key},{value}")
    return "\n".join(lines)