"""
Centralized country reference — flag + name everywhere.
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.country import Country
from app.services.currency_catalog_service import get_country_reference
from app.utils.country_flags import country_code_to_flag

# Full ExchangeRate-API catalog (165 currencies / 190+ countries)
COUNTRY_REFERENCE: dict[str, dict] = get_country_reference()


def serialize_country(code: str, name: str | None = None) -> dict:
    normalized = (code or "").upper().strip()
    ref = COUNTRY_REFERENCE.get(normalized, {})
    display_name = name or ref.get("name") or normalized
    return {
        "code": normalized,
        "name": display_name,
        "flag": country_code_to_flag(normalized),
        "flag_url": (
            f"https://flagcdn.com/w40/{normalized.lower()}.png"
            if len(normalized) == 2 and normalized.isalpha()
            else ""
        ),
        "region": ref.get("region"),
        "continent": ref.get("continent"),
        "currency": ref.get("currency"),
        "currency_name": ref.get("currency_name"),
        "currency_symbol": ref.get("currency_symbol"),
    }


async def load_countries_map(db: AsyncSession) -> dict[str, dict]:
    result = await db.execute(select(Country))
    mapping: dict[str, dict] = {}
    for row in result.scalars().all():
        mapping[row.code.upper()] = serialize_country(
            row.code,
            row.name,
        )
        mapping[row.code.upper()]["region"] = row.region or mapping[row.code.upper()]["region"]
        mapping[row.code.upper()]["continent"] = row.continent or mapping[row.code.upper()]["continent"]
        mapping[row.code.upper()]["currency"] = row.currency or mapping[row.code.upper()]["currency"]
    for code, ref in COUNTRY_REFERENCE.items():
        mapping.setdefault(code, serialize_country(code, ref["name"]))
    return mapping


def enrich_with_country(data: dict, code: str | None, countries_map: dict[str, dict] | None = None) -> dict:
    if not code:
        return data
    meta = (countries_map or {}).get(code.upper()) or serialize_country(code)
    return {**data, "country_code": meta["code"], "country_name": meta["name"], "country_flag": meta["flag"]}