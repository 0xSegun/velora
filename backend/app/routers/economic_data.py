"""
Economic data endpoints — indicators, country data, historical, upload.
"""

from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.schemas.economic_data import (
    CountryDataResponse,
    EconomicDataCreate,
    EconomicDataResponse,
    EconomicDataUploadResponse,
)
from app.services import data_service
from app.utils.security import get_current_user, require_admin

router = APIRouter(prefix="/api/economic-data", tags=["Economic Data"])


@router.get("/latest", response_model=list[EconomicDataResponse])
async def get_latest(
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Get the latest economic indicators per country."""
    return await data_service.get_latest_data(db, limit)


@router.post("/sync", status_code=200)
async def sync_indicators(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Sync country snapshots into economic_data and ingest FRED when configured."""
    result = await data_service.sync_indicators(db)
    await db.commit()
    return {
        "message": "Economic indicators synced successfully",
        **result,
    }


@router.get("/countries/{country_code}", response_model=CountryDataResponse)
async def get_country_data(
    country_code: str,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Get economic data for a specific country."""
    return await data_service.get_country_data(db, country_code)


@router.get("/historical", response_model=list[EconomicDataResponse])
async def get_historical(
    country_code: str | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Get historical economic data with optional date-range filtering."""
    return await data_service.get_historical_data(db, country_code, start_date, end_date, limit)


@router.post("/upload", response_model=EconomicDataUploadResponse, status_code=201)
async def upload_data(
    records: list[EconomicDataCreate],
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Bulk upload economic data records (admin only)."""
    return await data_service.bulk_upload(db, records)


@router.get("/nigeria", response_model=CountryDataResponse)
async def get_nigeria_data(
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Get Nigeria-specific economic data from CBN/NBS sources."""
    return await data_service.get_nigeria_data(db)


@router.post("/ingest-fred", status_code=200)
async def ingest_fred(
    country_code: str = Query("US"),
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Trigger FRED data ingestion for a country (admin only)."""
    created = await data_service.ingest_fred_data(db, country_code)
    return {"message": f"Ingested {created} new records from FRED", "created": created}
