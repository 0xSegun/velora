"""
Report endpoints.
"""

import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.models.report import Report
from app.models.user import User
from app.schemas.report import ReportCreate, ReportListResponse, ReportResponse
from app.services import pdf_service, report_generator_service, report_service
from app.services.analytics_tracker import track_event
from app.utils.security import get_current_user, require_admin

settings = get_settings()
BACKEND_ROOT = Path(__file__).resolve().parents[2]

router = APIRouter(prefix="/api/reports", tags=["Reports"])


class ReportGenerateRequest(BaseModel):
    country_code: str
    horizon_months: int = Field(default=6, ge=1, le=24)
    report_type: str = "custom"
    indicator_focus: str | None = None


@router.get("", response_model=ReportListResponse)
async def get_reports(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    report_type: str | None = None,
    country_code: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await report_service.list_reports(
        db,
        user=current_user,
        page=page,
        per_page=per_page,
        report_type=report_type,
        country_code=country_code,
    )


@router.get("/{report_id}", response_model=ReportResponse)
async def get_report(
    report_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    report = await report_service.get_report(db, report_id)
    await track_event(
        db,
        event_type="report_view",
        user_id=current_user.id,
        country_code=getattr(report, "country_code", None),
        metadata={"report_id": str(report_id)},
        request=request,
    )
    return report


@router.post("", response_model=ReportResponse, status_code=201)
async def create_report(
    payload: ReportCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await report_service.create_report(db, user=current_user, payload=payload)


@router.post("/generate", response_model=ReportResponse, status_code=201)
async def generate_intelligence_report(
    payload: ReportGenerateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate a research-grade country intelligence report from live data."""
    report = await report_generator_service.generate_country_report(
        db,
        user=current_user,
        country_code=payload.country_code,
        horizon_months=payload.horizon_months,
        report_type=payload.report_type,
        indicator_focus=payload.indicator_focus,
    )
    await db.commit()
    return report


@router.post("/sync", dependencies=[Depends(require_admin)])
async def sync_reports(db: AsyncSession = Depends(get_db)):
    synced = await report_service.sync_reports_from_apis(db)
    return {"synced": synced}


@router.get("/{report_id}/download")
async def download_report_pdf(
    report_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate and download report as PDF."""
    result = await db.execute(select(Report).where(Report.id == report_id))
    report = result.scalar_one_or_none()
    if not report:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="Report not found")

    if not report.pdf_path:
        await pdf_service.generate_report_pdf(db, report)

    pdf_file = BACKEND_ROOT / (report.pdf_path or "")
    if not pdf_file.exists():
        await pdf_service.generate_report_pdf(db, report)
        pdf_file = BACKEND_ROOT / (report.pdf_path or "")

    await track_event(
        db,
        event_type="report_download",
        user_id=current_user.id,
        country_code=getattr(report, "country_code", None),
        metadata={"report_id": str(report_id), "title": report.title[:120]},
        request=request,
    )

    return FileResponse(
        path=str(pdf_file),
        media_type="application/pdf",
        filename=f"{report.title[:80].replace(' ', '_')}.pdf",
    )