"""
Economic data service — ingest from FRED, CBN/NBS, and manual uploads.
"""

import logging
from datetime import date, datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.economic_data import DataSource, EconomicData
from app.schemas.economic_data import (
    CountryDataResponse,
    EconomicDataCreate,
    EconomicDataResponse,
    EconomicDataUploadResponse,
)

logger = logging.getLogger(__name__)
settings = get_settings()

# ── FRED API integration (delegates to fred_service) ─────────────────────────


async def ingest_fred_data(db: AsyncSession, country_code: str = "US") -> int:
    """Pull latest FRED data via the configured FRED API center."""
    from app.services.fred_service import get_config, sync_data

    config = await get_config(db)
    if not config.is_active and not config.api_key:
        return 0
    result = await sync_data(db, force=True)
    return int(result.get("records", 0))


# ── CBN / NBS data parsing ───────────────────────────────────────────────────


async def parse_cbn_data(raw_data: list[dict]) -> list[EconomicDataCreate]:
    """Parse data formatted like CBN statistical bulletins.

    Expects a list of dicts with keys matching EconomicDataCreate fields plus
    ``data_date`` as an ISO string.
    """
    records: list[EconomicDataCreate] = []
    for row in raw_data:
        try:
            records.append(
                EconomicDataCreate(
                    country_code=row.get("country_code", "NG"),
                    country_name=row.get("country_name", "Nigeria"),
                    cpi=row.get("cpi"),
                    gdp=row.get("gdp"),
                    gdp_growth=row.get("gdp_growth"),
                    interest_rate=row.get("interest_rate"),
                    exchange_rate=row.get("exchange_rate"),
                    oil_price=row.get("oil_price"),
                    gov_spending=row.get("gov_spending"),
                    employment_rate=row.get("employment_rate"),
                    unemployment_rate=row.get("unemployment_rate"),
                    inflation_rate=row.get("inflation_rate"),
                    money_supply=row.get("money_supply"),
                    trade_balance=row.get("trade_balance"),
                    data_date=date.fromisoformat(row["data_date"]),
                    source=row.get("source", "CBN"),
                )
            )
        except Exception:
            logger.warning("Skipping malformed CBN row: %s", row)
    return records


# ── CRUD operations ──────────────────────────────────────────────────────────


async def create_economic_data(
    db: AsyncSession, payload: EconomicDataCreate
) -> EconomicDataResponse:
    """Insert a single economic data record."""
    record = EconomicData(
        country_code=payload.country_code,
        country_name=payload.country_name,
        cpi=payload.cpi,
        gdp=payload.gdp,
        gdp_growth=payload.gdp_growth,
        interest_rate=payload.interest_rate,
        exchange_rate=payload.exchange_rate,
        oil_price=payload.oil_price,
        gov_spending=payload.gov_spending,
        employment_rate=payload.employment_rate,
        unemployment_rate=payload.unemployment_rate,
        inflation_rate=payload.inflation_rate,
        money_supply=payload.money_supply,
        trade_balance=payload.trade_balance,
        data_date=payload.data_date,
        source=DataSource(payload.source),
    )
    db.add(record)
    await db.flush()
    await db.refresh(record)
    return EconomicDataResponse.model_validate(record)


async def bulk_upload(
    db: AsyncSession, records: list[EconomicDataCreate]
) -> EconomicDataUploadResponse:
    """Bulk insert economic data records."""
    created = 0
    errors: list[str] = []
    for i, rec in enumerate(records):
        try:
            await create_economic_data(db, rec)
            created += 1
        except Exception as exc:
            errors.append(f"Row {i}: {exc}")
    return EconomicDataUploadResponse(created=created, errors=errors)


async def get_latest_data(
    db: AsyncSession, limit: int = 50
) -> list[EconomicDataResponse]:
    """Get the most recent economic record for each country."""
    query = (
        select(EconomicData)
        .distinct(EconomicData.country_code)
        .order_by(
            EconomicData.country_code,
            desc(EconomicData.data_date),
            desc(EconomicData.created_at),
        )
        .limit(limit)
    )
    result = await db.execute(query)
    records = sorted(
        result.scalars().all(),
        key=lambda row: row.country_name,
    )
    return [EconomicDataResponse.model_validate(r) for r in records]


async def sync_indicators(db: AsyncSession) -> dict[str, int]:
    """Sync country intelligence into economic_data and optionally ingest FRED."""
    from app.services.seed_service import sync_countries_to_economic_data

    synced = await sync_countries_to_economic_data(db)
    fred_created = 0
    try:
        from app.services.fred_service import get_config

        fred_cfg = await get_config(db)
        if fred_cfg.is_active or fred_cfg.api_key or settings.FRED_API_KEY:
            fred_created = await ingest_fred_data(db, "US")
    except Exception:
        logger.exception("FRED sync during indicator sync failed")
    return {"synced": synced, "fred_ingested": fred_created}


async def get_country_data(
    db: AsyncSession, country_code: str
) -> CountryDataResponse:
    """Get latest + historical data for a specific country."""
    query = (
        select(EconomicData)
        .where(EconomicData.country_code == country_code)
        .order_by(desc(EconomicData.data_date))
    )
    result = await db.execute(query)
    records = result.scalars().all()

    if not records:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No data found for country: {country_code}",
        )

    items = [EconomicDataResponse.model_validate(r) for r in records]
    return CountryDataResponse(
        country_code=country_code,
        country_name=records[0].country_name,
        latest=items[0] if items else None,
        historical=items,
        total_records=len(items),
    )


async def get_historical_data(
    db: AsyncSession,
    country_code: str | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    limit: int = 100,
) -> list[EconomicDataResponse]:
    """Get historical data with optional date-range filtering."""
    query = select(EconomicData)

    if country_code:
        query = query.where(EconomicData.country_code == country_code)
    if start_date:
        query = query.where(EconomicData.data_date >= start_date)
    if end_date:
        query = query.where(EconomicData.data_date <= end_date)

    query = query.order_by(desc(EconomicData.data_date)).limit(limit)
    result = await db.execute(query)
    return [EconomicDataResponse.model_validate(r) for r in result.scalars().all()]


async def get_nigeria_data(db: AsyncSession) -> CountryDataResponse:
    """Convenience accessor for Nigeria-specific data (CBN/NBS sources)."""
    query = (
        select(EconomicData)
        .where(
            EconomicData.country_code == "NG",
            EconomicData.source.in_([DataSource.CBN, DataSource.NBS, DataSource.MANUAL]),
        )
        .order_by(desc(EconomicData.data_date))
    )
    result = await db.execute(query)
    records = result.scalars().all()

    items = [EconomicDataResponse.model_validate(r) for r in records]
    return CountryDataResponse(
        country_code="NG",
        country_name="Nigeria",
        latest=items[0] if items else None,
        historical=items,
        total_records=len(items),
    )
