"""
Country priority tiers for personalized news, reports, and intelligence.

Priority order:
1. User's registered / active country
2. User's tracked (favorite) countries
3. Regional peers
4. Continental context
5. Global economic news (limited)
"""

from __future__ import annotations

from app.services.country_service import COUNTRY_REFERENCE, serialize_country

# Regional peer groups for news relevance
REGION_PEERS: dict[str, list[str]] = {
    "NG": ["GH", "CI", "SN", "CM", "KE"],
    "GH": ["NG", "CI", "SN", "KE"],
    "KE": ["TZ", "UG", "ET", "NG", "ZA"],
    "ZA": ["NG", "KE", "EG"],
    "EG": ["MA", "TN", "ZA"],
    "US": ["CA", "MX", "GB", "DE"],
    "GB": ["DE", "FR", "US", "IE"],
    "DE": ["FR", "IT", "GB", "NL"],
    "FR": ["DE", "IT", "GB", "ES"],
    "IN": ["CN", "PK", "BD"],
    "CN": ["JP", "IN", "KR"],
    "JP": ["CN", "KR", "US"],
    "BR": ["AR", "MX", "US"],
    "MX": ["US", "BR", "CA"],
    "CA": ["US", "MX"],
    "AU": ["NZ", "JP", "US"],
}

CONTINENT_PEERS: dict[str, list[str]] = {
    "Africa": ["NG", "ZA", "KE", "EG", "GH"],
    "Europe": ["DE", "GB", "FR", "IT", "ES"],
    "North America": ["US", "CA", "MX"],
    "South America": ["BR", "AR", "CL"],
    "Asia": ["CN", "IN", "JP", "KR"],
    "Oceania": ["AU", "NZ"],
}


def _continent_for(code: str) -> str | None:
    ref = COUNTRY_REFERENCE.get(code.upper(), {})
    return ref.get("continent")


def build_priority_tiers(
    primary_country: str,
    tracked_countries: list[str] | None = None,
) -> list[dict]:
    """Return ordered tiers: primary → tracked → regional → continental → global."""
    primary = (primary_country or "NG").upper()
    tracked = [c.upper() for c in (tracked_countries or []) if c and c.upper() != primary]
    tiers: list[dict] = []

    primary_meta = serialize_country(primary)
    tiers.append({
        "tier": "primary",
        "label": primary_meta["name"],
        "codes": [primary],
        "keywords": _country_keywords(primary),
    })

    if tracked:
        tiers.append({
            "tier": "tracked",
            "label": "Tracked countries",
            "codes": tracked[:8],
            "keywords": [_country_keywords(c) for c in tracked[:8]],
        })

    regional = [c for c in REGION_PEERS.get(primary, []) if c != primary and c not in tracked]
    if regional:
        tiers.append({
            "tier": "regional",
            "label": f"{primary_meta.get('region') or 'Regional'} peers",
            "codes": regional[:6],
            "keywords": [_country_keywords(c) for c in regional[:6]],
        })

    continent = _continent_for(primary)
    if continent:
        continental = [
            c for c in CONTINENT_PEERS.get(continent, [])
            if c != primary and c not in tracked and c not in regional
        ]
        if continental:
            tiers.append({
                "tier": "continental",
                "label": continent,
                "codes": continental[:5],
                "keywords": [_country_keywords(c) for c in continental[:5]],
            })

    tiers.append({
        "tier": "global",
        "label": "Global economics",
        "codes": [],
        "keywords": ["global economy", "world bank", "imf outlook", "oil prices", "fed interest rate"],
    })
    return tiers


def _country_keywords(code: str) -> list[str]:
    ref = COUNTRY_REFERENCE.get(code.upper(), {})
    name = ref.get("name", code)
    currency = ref.get("currency", "")
    keywords = [
        name,
        f"{name} inflation",
        f"{name} central bank",
        f"{name} economy",
        f"{name} GDP",
        f"{name} interest rate",
    ]
    if currency:
        keywords.append(f"{currency} exchange rate")
    # Country-specific institutions
    extras = {
        "NG": ["CBN", "naira", "Nigeria fuel subsidy", "Nigeria monetary policy"],
        "GH": ["Bank of Ghana", "cedi"],
        "KE": ["Central Bank of Kenya", "shilling"],
        "US": ["Federal Reserve", "FOMC", "US CPI"],
        "GB": ["Bank of England", "UK inflation"],
    }
    keywords.extend(extras.get(code.upper(), []))
    return keywords[:10]


def flatten_priority_codes(tiers: list[dict]) -> list[str]:
    seen: set[str] = set()
    ordered: list[str] = []
    for tier in tiers:
        for code in tier.get("codes", []):
            c = code.upper()
            if c not in seen:
                seen.add(c)
                ordered.append(c)
    return ordered