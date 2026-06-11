"""
Global search — aggregates countries, reports, predictions, research, and admin entities.
"""

from __future__ import annotations

import asyncio

from sqlalchemy import String, cast, desc, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.api_config import ApiConfiguration
from app.models.country import Country
from app.models.intelligence import ResearchPublication
from app.models.prediction import Prediction
from app.models.report import Report
from app.models.user import User
from app.schemas.search import SearchGroup, SearchResponse, SearchResultItem

GROUP_LABELS: dict[str, str] = {
    "page": "Pages",
    "country": "Countries",
    "report": "Reports",
    "prediction": "Predictions",
    "research": "Research",
    "user": "Users",
    "api_config": "API Configurations",
}


async def _search_countries(
    db: AsyncSession, pattern: str, limit: int
) -> list[SearchResultItem]:
    result = await db.execute(
        select(Country)
        .where(
            or_(Country.name.ilike(pattern), Country.code.ilike(pattern))
        )
        .order_by(Country.name)
        .limit(limit)
    )
    return [
        SearchResultItem(
            id=str(country.id),
            type="country",
            title=country.name,
            subtitle=country.code,
            href=f"/dashboard/countries?country={country.code}",
            meta="Country",
        )
        for country in result.scalars().all()
    ]


async def _search_reports(
    db: AsyncSession, pattern: str, limit: int
) -> list[SearchResultItem]:
    result = await db.execute(
        select(Report)
        .where(
            or_(
                Report.title.ilike(pattern),
                Report.summary.ilike(pattern),
                Report.source.ilike(pattern),
                cast(Report.report_type, String).ilike(pattern),
            )
        )
        .order_by(desc(Report.published_at))
        .limit(limit)
    )
    return [
        SearchResultItem(
            id=str(report.id),
            type="report",
            title=report.title,
            subtitle=report.source,
            href=f"/dashboard/reports/{report.id}",
            meta=report.report_type.value if hasattr(report.report_type, "value") else str(report.report_type),
        )
        for report in result.scalars().all()
    ]


async def _search_predictions(
    db: AsyncSession, user: User, pattern: str, limit: int
) -> list[SearchResultItem]:
    result = await db.execute(
        select(Prediction, Country.name)
        .outerjoin(Country, Country.code == Prediction.country_code)
        .where(
            Prediction.user_id == user.id,
            or_(
                Prediction.country_code.ilike(pattern),
                Country.name.ilike(pattern),
            ),
        )
        .order_by(desc(Prediction.prediction_date))
        .limit(limit)
    )
    items: list[SearchResultItem] = []
    for prediction, country_name in result.all():
        title = f"{country_name or prediction.country_code} Forecast"
        items.append(
            SearchResultItem(
                id=str(prediction.id),
                type="prediction",
                title=title,
                subtitle=f"{prediction.inflation_rate:.2f}% · {prediction.trend_direction}",
                href=f"/dashboard/predictions/{prediction.id}",
                meta="Prediction",
            )
        )
    return items


async def _search_research(
    db: AsyncSession, pattern: str, limit: int
) -> list[SearchResultItem]:
    result = await db.execute(
        select(ResearchPublication)
        .where(
            or_(
                ResearchPublication.title.ilike(pattern),
                ResearchPublication.authors.ilike(pattern),
                ResearchPublication.category.ilike(pattern),
            )
        )
        .order_by(desc(ResearchPublication.published_at))
        .limit(limit)
    )
    return [
        SearchResultItem(
            id=str(pub.id),
            type="research",
            title=pub.title,
            subtitle=pub.authors,
            href="/dashboard/research",
            meta=pub.category,
        )
        for pub in result.scalars().all()
    ]


async def _search_users(
    db: AsyncSession, pattern: str, limit: int
) -> list[SearchResultItem]:
    result = await db.execute(
        select(User)
        .where(
            or_(User.email.ilike(pattern), User.full_name.ilike(pattern))
        )
        .order_by(User.full_name)
        .limit(limit)
    )
    return [
        SearchResultItem(
            id=str(user.id),
            type="user",
            title=user.full_name or user.email,
            subtitle=user.email,
            href="/admin/users",
            meta=user.role.value if hasattr(user.role, "value") else str(user.role),
        )
        for user in result.scalars().all()
    ]


async def _search_api_configs(
    db: AsyncSession, pattern: str, limit: int
) -> list[SearchResultItem]:
    result = await db.execute(
        select(ApiConfiguration)
        .where(
            or_(
                ApiConfiguration.name.ilike(pattern),
                ApiConfiguration.provider.ilike(pattern),
            )
        )
        .order_by(ApiConfiguration.name)
        .limit(limit)
    )
    return [
        SearchResultItem(
            id=str(config.id),
            type="api_config",
            title=config.name,
            subtitle=config.provider,
            href="/admin/api-config",
            meta=config.api_type.value if hasattr(config.api_type, "value") else str(config.api_type),
        )
        for config in result.scalars().all()
    ]


async def global_search(
    db: AsyncSession,
    *,
    user: User,
    query: str,
    admin: bool = False,
    limit_per_type: int = 5,
) -> SearchResponse:
    q = query.strip()
    if len(q) < 2:
        return SearchResponse(query=q, groups=[], total=0)

    pattern = f"%{q}%"

    type_order = (
        ["country", "report", "prediction", "research", "user", "api_config"]
        if admin
        else ["country", "report", "prediction", "research"]
    )

    coroutines = {
        "country": _search_countries(db, pattern, limit_per_type),
        "report": _search_reports(db, pattern, limit_per_type),
        "prediction": _search_predictions(db, user, pattern, limit_per_type),
        "research": _search_research(db, pattern, limit_per_type),
    }
    if admin:
        coroutines["user"] = _search_users(db, pattern, limit_per_type)
        coroutines["api_config"] = _search_api_configs(db, pattern, limit_per_type)

    resolved = await asyncio.gather(*[coroutines[key] for key in type_order])
    results_by_type = dict(zip(type_order, resolved, strict=True))

    groups: list[SearchGroup] = []
    total = 0
    for result_type in type_order:
        items = results_by_type.get(result_type, [])
        if not items:
            continue
        groups.append(
            SearchGroup(
                type=result_type,
                label=GROUP_LABELS.get(result_type, result_type.title()),
                results=items,
            )
        )
        total += len(items)

    return SearchResponse(query=q, groups=groups, total=total)