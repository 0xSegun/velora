"""
User dashboard overview endpoints.
"""

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.services import dashboard_service
from app.utils.security import get_current_user

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


class TrackedCountriesUpdate(BaseModel):
    countries: list[str] = Field(default_factory=list, max_length=3)


@router.get("/overview")
async def get_overview(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Personalized economic intelligence overview for the authenticated user."""
    return await dashboard_service.get_overview(db, user)


@router.get("/tracked-countries")
async def get_tracked(
    user: User = Depends(get_current_user),
):
    return {
        "countries": user.tracked_countries or [],
        "max": dashboard_service.MAX_TRACKED,
        "primary_country": user.country.upper(),
    }


@router.put("/tracked-countries")
async def update_tracked(
    payload: TrackedCountriesUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    countries = await dashboard_service.update_tracked_countries(
        db, user, payload.countries
    )
    await db.commit()
    return {
        "countries": countries,
        "max": dashboard_service.MAX_TRACKED,
    }


@router.get("/server-time")
async def server_time(user: User = Depends(get_current_user)):
    tz = dashboard_service._resolve_timezone(user)
    return dashboard_service._server_clock(tz)