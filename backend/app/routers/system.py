"""
System health and status endpoints.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.services import health_service

router = APIRouter(tags=["System"])


@router.get("/health")
async def health_check(db: AsyncSession = Depends(get_db)):
    return await health_service.get_health_status(db)


@router.get("/system/status")
async def system_status(db: AsyncSession = Depends(get_db)):
    return await health_service.get_system_status(db)