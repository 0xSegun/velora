"""Generate world_countries.json (249 ISO entries) with currency enrichment."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.data.exchangerate_currencies import COUNTRY_BY_CODE  # noqa: E402

EUROZONE = {
    "AT", "BE", "CY", "DE", "EE", "ES", "FI", "FR", "GR", "HR", "IE", "IT",
    "LT", "LU", "LV", "MT", "NL", "PT", "SI", "SK", "AD", "MC", "SM", "VA", "ME", "XK",
}
XOF_COUNTRIES = {"BJ", "BF", "CI", "GW", "ML", "NE", "SN", "TG"}
XAF_COUNTRIES = {"CM", "CF", "TD", "CG", "GQ", "GA"}
XCD_COUNTRIES = {"AG", "DM", "GD", "KN", "LC", "VC"}
USD_TERRITORIES = {
    "AS", "EC", "SV", "GU", "MH", "FM", "MP", "PW", "PR", "TL", "TC", "VG", "VI", "UM", "BQ", "IO",
}

# Not in ISO 3166-1 alpha-2 but used by FX / platform data
SUPPLEMENTAL_COUNTRIES: list[dict[str, str]] = [
    {
        "code": "EU",
        "name": "European Union",
        "currency": "EUR",
        "currency_name": "Euro",
        "currency_symbol": "€",
        "continent": "Europe",
        "region": "Western Europe",
    },
    {
        "code": "XK",
        "name": "Kosovo",
        "currency": "EUR",
        "currency_name": "Euro",
        "currency_symbol": "€",
        "continent": "Europe",
        "region": "Southern Europe",
    },
]

FALLBACK_CURRENCIES: dict[str, tuple[str, str, str]] = {
    "GB": ("GBP", "Pound Sterling", "£"),
    "CH": ("CHF", "Swiss Franc", "Fr"),
    "CN": ("CNY", "Chinese Renminbi", "¥"),
    "JP": ("JPY", "Japanese Yen", "¥"),
    "NG": ("NGN", "Nigerian Naira", "₦"),
    "EU": ("EUR", "Euro", "€"),
}


def enrich(entry: dict) -> dict:
    code = entry["code"]
    fx = COUNTRY_BY_CODE.get(code, {})
    currency = fx.get("currency", "")
    currency_name = fx.get("currency_name", "")
    currency_symbol = fx.get("currency_symbol", "")
    continent = fx.get("continent", "")
    region = fx.get("region", "")

    if not currency and code in EUROZONE:
        currency, currency_name, currency_symbol = "EUR", "Euro", "€"
        continent = continent or "Europe"
    elif not currency and code in XOF_COUNTRIES:
        currency, currency_name, currency_symbol = "XOF", "West African CFA Franc", "CFA"
        continent = continent or "Africa"
    elif not currency and code in XAF_COUNTRIES:
        currency, currency_name, currency_symbol = "XAF", "Central African CFA Franc", "FCFA"
        continent = continent or "Africa"
    elif not currency and code in XCD_COUNTRIES:
        currency, currency_name, currency_symbol = "XCD", "East Caribbean Dollar", "$"
        continent = continent or "North America"
    elif not currency and code in USD_TERRITORIES:
        currency, currency_name, currency_symbol = "USD", "US Dollar", "$"
    elif not currency and code in FALLBACK_CURRENCIES:
        currency, currency_name, currency_symbol = FALLBACK_CURRENCIES[code]

    return {
        "code": code,
        "name": fx.get("name") or entry["name"],
        "currency": currency,
        "currency_name": currency_name,
        "currency_symbol": currency_symbol,
        "continent": continent,
        "region": region,
        "flag_url": f"https://flagcdn.com/w40/{code.lower()}.png",
    }


def main() -> None:
    iso_path = ROOT / "app" / "data" / "iso3166_countries.json"
    iso_raw = json.loads(iso_path.read_text(encoding="utf-8"))
    seen = {e["code"] for e in iso_raw}
    merged = list(iso_raw)
    for entry in SUPPLEMENTAL_COUNTRIES:
        if entry["code"] not in seen:
            merged.append({"code": entry["code"], "name": entry["name"]})
            seen.add(entry["code"])
    catalog = [enrich(e) for e in merged]

    out_backend = ROOT / "app" / "data" / "world_countries.json"
    out_frontend = ROOT.parent / "frontend" / "src" / "data" / "world_countries.json"
    payload = json.dumps(catalog, indent=2)
    out_backend.write_text(payload, encoding="utf-8")
    out_frontend.parent.mkdir(parents=True, exist_ok=True)
    out_frontend.write_text(payload, encoding="utf-8")

    with_currency = sum(1 for c in catalog if c["currency"])
    print(f"catalog={len(catalog)} with_currency={with_currency}")


if __name__ == "__main__":
    main()