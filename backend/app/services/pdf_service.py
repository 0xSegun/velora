"""
Report PDF generation service.
"""

import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.report import Report

settings = get_settings()
BACKEND_ROOT = Path(__file__).resolve().parents[2]


def _pdf_dir() -> Path:
    path = BACKEND_ROOT / settings.PDF_DIR
    path.mkdir(parents=True, exist_ok=True)
    return path


def _format_content(content: dict) -> str:
    if not content:
        return "No additional content."
    sections = []
    for key, value in content.items():
        if isinstance(value, (dict, list)):
            sections.append(f"{key}: {value}")
        else:
            sections.append(f"{key}: {value}")
    return "\n".join(sections) if sections else "No additional content."


async def generate_report_pdf(db: AsyncSession, report: Report) -> str:
    """Generate PDF for a report and persist path on the model."""
    try:
        from reportlab.lib.pagesizes import letter
        from reportlab.lib.styles import getSampleStyleSheet
        from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer
    except ImportError as exc:
        raise HTTPException(
            status_code=500,
            detail="PDF library not installed. Run: pip install reportlab",
        ) from exc

    filename = f"report_{report.id}.pdf"
    output_path = _pdf_dir() / filename
    styles = getSampleStyleSheet()

    doc = SimpleDocTemplate(str(output_path), pagesize=letter)
    story = [
        Paragraph(settings.APP_NAME, styles["Title"]),
        Spacer(1, 12),
        Paragraph(report.title, styles["Heading1"]),
        Spacer(1, 8),
        Paragraph(f"<b>Source:</b> {report.source}", styles["Normal"]),
        Paragraph(
            f"<b>Published:</b> {report.published_at.strftime('%Y-%m-%d %H:%M UTC')}",
            styles["Normal"],
        ),
        Paragraph(
            f"<b>Category:</b> {report.category or report.report_type.value}",
            styles["Normal"],
        ),
        Spacer(1, 12),
        Paragraph("<b>Summary</b>", styles["Heading2"]),
        Paragraph(report.summary or "—", styles["Normal"]),
        Spacer(1, 12),
        Paragraph("<b>Report Content</b>", styles["Heading2"]),
        Paragraph(_format_content(report.content).replace("\n", "<br/>"), styles["Normal"]),
        Spacer(1, 12),
        Paragraph(
            f"<i>Generated {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}</i>",
            styles["Italic"],
        ),
    ]
    doc.build(story)

    rel_path = str(output_path.relative_to(BACKEND_ROOT))
    report.pdf_path = rel_path
    await db.flush()
    return rel_path