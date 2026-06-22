"""
Country intelligence endpoints.
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.country import Country
from app.models.user import User
from app.data.world_countries import load_world_countries
from app.services.country_service import serialize_country
from app.services.exchange_rate_service import get_rate_for_country, get_rates_for_countries_batch
from app.utils.security import get_current_user

router = APIRouter(prefix="/api/countries", tags=["Countries"])


def _serialize(country: Country) -> dict:
    meta = serialize_country(country.code, country.name)
    return {
        "id": str(country.id),
        "name": country.name,
        "code": country.code,
        "flag": meta["flag"],
        "flag_url": meta["flag_url"],
        "region": country.region or meta.get("region"),
        "continent": country.continent or meta.get("continent"),
        "currency": country.currency or meta.get("currency"),
        "inflation_rate": country.inflation_rate,
        "deflation_risk": country.deflation_risk,
        "gdp": country.gdp,
        "interest_rate": country.interest_rate,
        "economic_stability_score": country.economic_stability_score,
        "currency_strength": country.currency_strength,
        "updated_at": country.updated_at.isoformat(),
    }


@router.get("/catalog")
async def country_catalog(
    _: User = Depends(get_current_user),
):
    """Lightweight full world catalog (249 ISO territories) with flags and currencies."""
    items = []
    for entry in load_world_countries():
        meta = serialize_country(entry["code"], entry["name"])
        items.append({
            "code": meta["code"],
            "name": meta["name"],
            "flag": meta["flag"],
            "flag_url": meta["flag_url"],
            "currency": entry.get("currency") or meta.get("currency"),
            "currency_name": entry.get("currency_name") or meta.get("currency_name"),
            "currency_symbol": entry.get("currency_symbol") or meta.get("currency_symbol"),
            "continent": entry.get("continent") or meta.get("continent"),
            "region": entry.get("region") or meta.get("region"),
        })
    return {"countries": items, "total": len(items)}


@router.get("")
async def list_countries(
    search: str | None = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    query = select(Country)
    if search:
        pattern = f"%{search}%"
        query = query.where(
            (Country.name.ilike(pattern)) | (Country.code.ilike(pattern))
        )
    total_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = total_result.scalar() or 0
    offset = (page - 1) * per_page
    result = await db.execute(
        query.order_by(Country.name).offset(offset).limit(per_page)
    )
    countries = result.scalars().all()
    fx_by_code = await get_rates_for_countries_batch(db, [c.code for c in countries])
    serialized: list[dict] = []
    for country in countries:
        data = _serialize(country)
        fx = fx_by_code.get(country.code.upper()) or await get_rate_for_country(
            db, country.code
        )
        data["exchange_rate"] = fx.exchange_rate
        data["exchange_rate_last_updated"] = (
            fx.last_updated.isoformat() if fx.last_updated else None
        )
        data["exchange_rate_trend"] = fx.trend
        data["exchange_rate_change_24h"] = fx.change_24h
        data["exchange_rate_change_7d"] = fx.change_7d
        data["exchange_rate_is_stale"] = fx.is_stale
        data["exchange_rate_stale_message"] = fx.stale_message
        serialized.append(data)
    return {
        "countries": serialized,
        "total": total,
        "page": page,
        "per_page": per_page,
    }


@router.get("/{code}")
async def get_country(
    code: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(select(Country).where(Country.code == code.upper()))
    country = result.scalar_one_or_none()
    if not country:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="Country not found")
    data = _serialize(country)
    fx = await get_rate_for_country(db, country.code)
    data["currency_name"] = fx.currency_name
    data["currency_symbol"] = fx.currency_symbol
    data["exchange_rate"] = fx.exchange_rate
    data["exchange_rate_last_updated"] = (
        fx.last_updated.isoformat() if fx.last_updated else None
    )
    data["exchange_rate_trend"] = fx.trend
    data["exchange_rate_change_24h"] = fx.change_24h
    data["exchange_rate_change_7d"] = fx.change_7d
    data["exchange_rate_is_stale"] = fx.is_stale
    data["exchange_rate_stale_message"] = fx.stale_message
    return data