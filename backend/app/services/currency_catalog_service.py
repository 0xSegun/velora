"""
ExchangeRate-API currency and country catalog — seeding and lookups.
"""

from __future__ import annotations

import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.data.exchangerate_currencies import (
    ADDITIONAL_CURRENCY_COUNTRIES,
    COUNTRY_BY_CODE,
    CURRENCY_BY_CODE,
    CURRENCY_TO_COUNTRY,
    EXCHANGERATE_CURRENCIES,
    SUPPORTED_CURRENCY_CODES,
)
from app.data.world_countries import (
    load_world_countries,
    world_countries_by_code,
    world_currency_to_country,
)
from app.models.country import Country

logger = logging.getLogger(__name__)


def get_country_reference() -> dict[str, dict]:
    """Build country reference dict — all 249 ISO territories plus FX catalog overlays."""
    ref: dict[str, dict] = {}
    for entry in load_world_countries():
        code = entry["code"].upper()
        ref[code] = {
            "name": entry["name"],
            "region": entry.get("region"),
            "continent": entry.get("continent"),
            "currency": entry.get("currency"),
            "currency_name": entry.get("currency_name"),
            "currency_symbol": entry.get("currency_symbol"),
        }
    for code, meta in COUNTRY_BY_CODE.items():
        if code in ref:
            for key in ("name", "region", "continent", "currency", "currency_name", "currency_symbol"):
                if meta.get(key):
                    ref[code][key] = meta[key]
        else:
            ref[code] = {
                "name": meta["name"],
                "region": meta.get("region"),
                "continent": meta.get("continent"),
                "currency": meta.get("currency"),
                "currency_name": meta.get("currency_name"),
                "currency_symbol": meta.get("currency_symbol"),
            }
    return ref


def get_currency_metadata(currency_code: str) -> dict | None:
    return CURRENCY_BY_CODE.get(currency_code.upper())


def country_code_for_currency(currency_code: str, preferred_country: str | None = None) -> str | None:
    cur = currency_code.upper()
    if preferred_country:
        pref = preferred_country.upper()
        world = world_countries_by_code().get(pref)
        if world and (world.get("currency") or "").upper() == cur:
            return pref
        if pref in COUNTRY_BY_CODE:
            ref = COUNTRY_BY_CODE[pref]
            if (ref.get("currency") or "").upper() == cur:
                return pref
    return CURRENCY_TO_COUNTRY.get(cur) or world_currency_to_country().get(cur)


def list_catalog_currencies() -> list[dict]:
    return [
        {
            "code": c["code"],
            "name": c["name"],
            "country": c["country"],
            "country_code": c["country_code"],
            "continent": c["continent"],
            "region": c["region"],
            "symbol": c.get("symbol", ""),
        }
        for c in EXCHANGERATE_CURRENCIES
    ]


def list_catalog_countries() -> list[dict]:
    return list(get_country_reference().values())


async def seed_world_countries(db: AsyncSession) -> int:
    """Seed all ISO 3166-1 alpha-2 countries (249); preserve existing economic profiles."""
    result = await db.execute(select(Country))
    existing = {row.code.upper(): row for row in result.scalars().all()}
    created = 0
    updated = 0

    for entry in load_world_countries():
        code = entry["code"].upper()
        row = existing.get(code)
        if row:
            changed = False
            if entry.get("name") and row.name != entry["name"] and row.name == code:
                row.name = entry["name"]
                changed = True
            if not row.region and entry.get("region"):
                row.region = entry["region"]
                changed = True
            if not row.continent and entry.get("continent"):
                row.continent = entry["continent"]
                changed = True
            if not row.currency and entry.get("currency"):
                row.currency = entry["currency"]
                changed = True
            if changed:
                updated += 1
            continue

        db.add(
            Country(
                name=entry["name"],
                code=code,
                region=entry.get("region"),
                continent=entry.get("continent"),
                currency=entry.get("currency"),
                inflation_rate=None,
                deflation_risk=None,
                gdp=None,
                interest_rate=None,
                economic_stability_score=None,
                currency_strength=None,
            )
        )
        created += 1

    if created or updated:
        await db.flush()
        logger.info(
            "World countries: %d created, %d metadata updates (%d ISO entries)",
            created,
            updated,
            len(load_world_countries()),
        )
    return created


async def seed_exchangerate_countries(db: AsyncSession) -> int:
    """Seed all ExchangeRate-API countries; preserve existing economic profiles."""
    result = await db.execute(select(Country))
    existing = {row.code.upper(): row for row in result.scalars().all()}
    created = 0
    updated = 0

    for code, meta in COUNTRY_BY_CODE.items():
        row = existing.get(code)
        if row:
            changed = False
            if not row.region and meta.get("region"):
                row.region = meta["region"]
                changed = True
            if not row.continent and meta.get("continent"):
                row.continent = meta["continent"]
                changed = True
            if not row.currency and meta.get("currency"):
                row.currency = meta["currency"]
                changed = True
            if changed:
                updated += 1
            continue

        db.add(
            Country(
                name=meta["name"],
                code=code,
                region=meta.get("region"),
                continent=meta.get("continent"),
                currency=meta.get("currency"),
                inflation_rate=None,
                deflation_risk=None,
                gdp=None,
                interest_rate=None,
                economic_stability_score=None,
                currency_strength=None,
            )
        )
        created += 1

    if created or updated:
        await db.flush()
        logger.info(
            "ExchangeRate-API countries: %d created, %d metadata updates (%d total in catalog)",
            created,
            updated,
            len(COUNTRY_BY_CODE),
        )
    return created


__all__ = [
    "ADDITIONAL_CURRENCY_COUNTRIES",
    "COUNTRY_BY_CODE",
    "CURRENCY_BY_CODE",
    "CURRENCY_TO_COUNTRY",
    "EXCHANGERATE_CURRENCIES",
    "SUPPORTED_CURRENCY_CODES",
    "country_code_for_currency",
    "get_country_reference",
    "get_currency_metadata",
    "list_catalog_countries",
    "list_catalog_currencies",
    "seed_exchangerate_countries",
    "seed_world_countries",
    "world_countries_by_code",
]