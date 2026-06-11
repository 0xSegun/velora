"""
Report service — list, fetch, create, sync from configured external APIs.
"""

import logging
import uuid
from datetime import datetime, timezone

import httpx
from fastapi import HTTPException, status
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.api_config import ApiConfiguration, ApiType
from app.models.report import Report, ReportType
from app.models.user import User
from app.schemas.report import ReportCreate, ReportListResponse, ReportResponse
from app.services.exchange_rate_service import get_rate_for_country

logger = logging.getLogger(__name__)


def _coerce_report_type(value: str) -> ReportType:
    try:
        return ReportType(value)
    except ValueError:
        return ReportType.CUSTOM


def _to_response(report: Report, *, fx_context: dict | None = None) -> ReportResponse:
    meta = dict(report.metadata_extra or {})
    if fx_context:
        meta["exchange_rate_context"] = fx_context
    return ReportResponse(
        id=report.id,
        title=report.title,
        summary=report.summary,
        content=report.content or {},
        report_type=report.report_type.value,
        country_code=report.country_code,
        source=report.source,
        source_url=report.source_url,
        published_at=report.published_at,
        created_at=report.created_at,
        metadata_extra=meta,
    )


async def list_reports(
    db: AsyncSession,
    *,
    user: User,
    page: int = 1,
    per_page: int = 20,
    report_type: str | None = None,
    country_code: str | None = None,
) -> ReportListResponse:
    query = select(Report)
    if report_type:
        query = query.where(Report.report_type == _coerce_report_type(report_type))
    if country_code:
        query = query.where(Report.country_code == country_code.upper())

    count_q = select(func.count()).select_from(query.subquery())
    total = int((await db.execute(count_q)).scalar() or 0)

    offset = (page - 1) * per_page
    result = await db.execute(
        query.order_by(desc(Report.published_at)).offset(offset).limit(per_page)
    )
    reports = [_to_response(r) for r in result.scalars().all()]
    return ReportListResponse(reports=reports, total=total, page=page, per_page=per_page)


async def get_report(db: AsyncSession, report_id: uuid.UUID) -> ReportResponse:
    result = await db.execute(select(Report).where(Report.id == report_id))
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")
    fx_context = None
    if report.country_code:
        fx = await get_rate_for_country(db, report.country_code)
        fx_context = {
            "exchange_rate": fx.exchange_rate,
            "trend": fx.trend,
            "change_7d": fx.change_7d,
            "change_24h": fx.change_24h,
            "last_updated": fx.last_updated.isoformat() if fx.last_updated else None,
            "is_stale": fx.is_stale,
            "stale_message": fx.stale_message,
            "commentary": (
                f"FX trend is {fx.trend} with 7-day change of {fx.change_7d or 0:.2f}."
                if fx.exchange_rate
                else "Exchange rate data unavailable."
            ),
        }
    return _to_response(report, fx_context=fx_context)


async def create_report(
    db: AsyncSession,
    *,
    user: User | None,
    payload: ReportCreate,
) -> ReportResponse:
    report = Report(
        user_id=user.id if user else None,
        title=payload.title,
        summary=payload.summary,
        content=payload.content,
        report_type=_coerce_report_type(payload.report_type),
        country_code=payload.country_code,
        source=payload.source,
        source_url=payload.source_url,
        published_at=payload.published_at or datetime.now(timezone.utc),
        metadata_extra=payload.metadata_extra,
    )
    db.add(report)
    await db.flush()
    await db.refresh(report)
    return _to_response(report)


async def sync_reports_from_apis(db: AsyncSession) -> int:
    """Attempt to pull reports from active report API configurations."""
    result = await db.execute(
        select(ApiConfiguration).where(
            ApiConfiguration.is_active.is_(True),
            ApiConfiguration.api_type == ApiType.REPORT,
        )
    )
    configs = list(result.scalars().all())
    synced = 0

    for config in configs:
        try:
            headers = {}
            if config.api_key:
                headers["Authorization"] = f"Bearer {config.api_key}"
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.get(config.endpoint_url, headers=headers)
                response.raise_for_status()
                payload = response.json()

            items = payload if isinstance(payload, list) else payload.get("reports", [])
            for item in items[:20]:
                if not isinstance(item, dict) or not item.get("title"):
                    continue
                report = Report(
                    title=str(item["title"]),
                    summary=str(item.get("summary", "")),
                    content=item.get("content", item),
                    report_type=_coerce_report_type(str(item.get("report_type", "custom"))),
                    country_code=item.get("country_code"),
                    source=config.provider,
                    source_url=item.get("source_url"),
                    published_at=datetime.now(timezone.utc),
                    metadata_extra={"api_config_id": str(config.id)},
                )
                db.add(report)
                synced += 1

            config.last_sync_at = datetime.now(timezone.utc)
            logs = list(config.logs or [])
            logs.insert(0, {"at": config.last_sync_at.isoformat(), "event": "sync_success", "count": len(items)})
            config.logs = logs[:50]
        except Exception as exc:
            logger.warning("Report sync failed for %s: %s", config.name, exc)
            logs = list(config.logs or [])
            logs.insert(0, {"at": datetime.now(timezone.utc).isoformat(), "event": "sync_failed", "error": str(exc)})
            config.logs = logs[:50]

    await db.flush()
    return synced