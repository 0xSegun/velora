"""
Training Behaviour dashboard — HTML page and JSON API.
"""

from __future__ import annotations

import asyncio
from pathlib import Path

from fastapi import APIRouter, Query
from fastapi.responses import HTMLResponse, JSONResponse

from app.services import training_behaviour_service as behaviour

router = APIRouter(tags=["Training Behaviour"])

_TEMPLATE_PATH = (
    Path(__file__).resolve().parents[1] / "static" / "training_behaviour.html"
)


@router.get("/api/training-behaviour", response_class=JSONResponse)
async def training_behaviour_data(
    country_code: str = Query("NG", min_length=2, max_length=3),
):
    """Chart-ready training and backtest metrics."""
    report = await asyncio.to_thread(
        behaviour.build_training_behaviour_report,
        country_code.upper(),
    )
    return report


@router.get("/training-behaviour", response_class=HTMLResponse, include_in_schema=False)
async def training_behaviour_page():
    """Interactive Training Behaviour dashboard."""
    if not _TEMPLATE_PATH.exists():
        return HTMLResponse(
            "<h1>Training Behaviour</h1><p>Dashboard template not found.</p>",
            status_code=500,
        )
    return HTMLResponse(_TEMPLATE_PATH.read_text(encoding="utf-8"))