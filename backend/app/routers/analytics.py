"""
Analytics API — real data, WebSocket live updates, admin controls.
"""

from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect
from fastapi.responses import PlainTextResponse, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.services import analytics_service
from app.services.analytics_ws import analytics_ws_manager
from app.utils.security import require_admin

router = APIRouter(prefix="/api/analytics", tags=["Analytics"])


@router.get("/comprehensive")
async def comprehensive_analytics(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    return await analytics_service.get_comprehensive_analytics(db, days)


@router.get("/export/csv")
async def export_csv(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    csv_data = await analytics_service.export_analytics_csv(db, days)
    return PlainTextResponse(
        csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=analytics_{days}d.csv"},
    )


@router.get("/export/json")
async def export_json(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    import json

    data = await analytics_service.get_comprehensive_analytics(db, days)
    return Response(
        content=json.dumps(data, indent=2),
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename=analytics_{days}d.json"},
    )


@router.post("/reset")
async def reset_analytics(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    return await analytics_service.reset_analytics(db)


@router.get("/config")
async def get_config(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    return await analytics_service.get_analytics_config(db)


@router.put("/config")
async def update_config(
    config: dict,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    return await analytics_service.save_analytics_config(db, config, admin.id)


@router.websocket("/ws")
async def analytics_websocket(websocket: WebSocket):
    await analytics_ws_manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        analytics_ws_manager.disconnect(websocket)