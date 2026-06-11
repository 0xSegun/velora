"""
Economic Events Intelligence — CRUD, import, timeline, impact scoring.
"""

import csv
import io
import uuid
from datetime import date, datetime, timedelta, timezone

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.intelligence import EconomicEvent
from app.schemas.intelligence import EconomicEventCreate, EconomicEventUpdate

VALID_CATEGORIES = {
    "interest_rate_decision", "monetary_policy", "exchange_rate_policy",
    "fuel_subsidy", "tax_reform", "budget_release", "public_spending",
    "trade_restriction", "oil_price_shock", "commodity_shock",
    "geopolitical_conflict", "election", "recession", "pandemic", "natural_disaster",
}


async def list_events(
    db: AsyncSession,
    *,
    country: str | None = None,
    category: str | None = None,
    search: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    page: int = 1,
    per_page: int = 20,
) -> dict:
    query = select(EconomicEvent)
    if country:
        query = query.where(EconomicEvent.country == country.upper())
    if category:
        query = query.where(EconomicEvent.category == category)
    if search:
        query = query.where(EconomicEvent.title.ilike(f"%{search}%"))
    if date_from:
        query = query.where(EconomicEvent.event_date >= date_from)
    if date_to:
        query = query.where(EconomicEvent.event_date <= date_to)

    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    offset = (page - 1) * per_page
    result = await db.execute(
        query.order_by(desc(EconomicEvent.event_date)).offset(offset).limit(per_page)
    )
    return {"events": result.scalars().all(), "total": total, "page": page, "per_page": per_page}


async def get_event(db: AsyncSession, event_id: uuid.UUID) -> EconomicEvent:
    result = await db.execute(select(EconomicEvent).where(EconomicEvent.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event


async def create_event(db: AsyncSession, payload: EconomicEventCreate) -> EconomicEvent:
    if payload.category not in VALID_CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Invalid category. Valid: {sorted(VALID_CATEGORIES)}")
    event = EconomicEvent(
        title=payload.title,
        country=payload.country.upper(),
        category=payload.category,
        event_date=payload.event_date,
        severity_score=payload.severity_score,
        economic_impact_score=payload.economic_impact_score,
        description=payload.description,
    )
    db.add(event)
    await db.flush()
    await db.refresh(event)
    return event


async def update_event(
    db: AsyncSession, event_id: uuid.UUID, payload: EconomicEventUpdate
) -> EconomicEvent:
    event = await get_event(db, event_id)
    data = payload.model_dump(exclude_unset=True)
    if "category" in data and data["category"] not in VALID_CATEGORIES:
        raise HTTPException(status_code=400, detail="Invalid category")
    for k, v in data.items():
        setattr(event, k, v)
    await db.flush()
    return event


async def delete_event(db: AsyncSession, event_id: uuid.UUID) -> None:
    event = await get_event(db, event_id)
    await db.delete(event)


async def import_events_csv(db: AsyncSession, file: UploadFile) -> dict:
    content = await file.read()
    text = content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))
    required = {"title", "country", "category", "event_date"}
    if not reader.fieldnames or not required.issubset(set(reader.fieldnames)):
        raise HTTPException(
            status_code=400,
            detail=f"CSV must include columns: {', '.join(sorted(required))}",
        )

    created = 0
    errors: list[str] = []
    for i, row in enumerate(reader, start=2):
        try:
            cat = row["category"].strip()
            if cat not in VALID_CATEGORIES:
                errors.append(f"Row {i}: invalid category '{cat}'")
                continue
            ed = datetime.strptime(row["event_date"].strip()[:10], "%Y-%m-%d").date()
            event = EconomicEvent(
                title=row["title"].strip(),
                country=row["country"].strip().upper(),
                category=cat,
                event_date=ed,
                severity_score=float(row.get("severity_score") or 5),
                economic_impact_score=float(row.get("economic_impact_score") or 5),
                description=row.get("description", "").strip(),
            )
            db.add(event)
            created += 1
        except Exception as exc:
            errors.append(f"Row {i}: {exc}")

    await db.flush()
    return {"imported": created, "errors": errors}


async def get_timeline(db: AsyncSession, country: str, months: int = 24) -> list[dict]:
    cutoff = date.today() - timedelta(days=months * 30)
    result = await db.execute(
        select(EconomicEvent)
        .where(EconomicEvent.country == country.upper())
        .where(EconomicEvent.event_date >= cutoff)
        .order_by(EconomicEvent.event_date)
    )
    events = result.scalars().all()
    return [
        {
            "id": str(e.id),
            "title": e.title,
            "category": e.category,
            "event_date": e.event_date.isoformat(),
            "severity_score": e.severity_score,
            "economic_impact_score": e.economic_impact_score,
            "description": e.description,
        }
        for e in events
    ]


async def get_events_for_prediction(
    db: AsyncSession, country_code: str, lookback_months: int = 24
) -> list[dict]:
    cutoff = date.today() - timedelta(days=lookback_months * 30)
    result = await db.execute(
        select(EconomicEvent)
        .where(EconomicEvent.country == country_code.upper())
        .where(EconomicEvent.event_date >= cutoff)
        .order_by(desc(EconomicEvent.event_date))
    )
    return [
        {
            "title": e.title,
            "category": e.category,
            "event_date": e.event_date.isoformat(),
            "severity_score": e.severity_score,
            "economic_impact_score": e.economic_impact_score,
        }
        for e in result.scalars().all()
    ]