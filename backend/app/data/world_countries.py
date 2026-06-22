"""Full ISO 3166-1 alpha-2 world country catalog (249 territories)."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

_DATA_PATH = Path(__file__).with_name("world_countries.json")


@lru_cache(maxsize=1)
def load_world_countries() -> list[dict]:
    raw = json.loads(_DATA_PATH.read_text(encoding="utf-8"))
    return [dict(entry) for entry in raw]


@lru_cache(maxsize=1)
def world_countries_by_code() -> dict[str, dict]:
    return {entry["code"].upper(): entry for entry in load_world_countries()}


@lru_cache(maxsize=1)
def world_currency_to_country() -> dict[str, str]:
    mapping: dict[str, str] = {}
    for entry in load_world_countries():
        currency = (entry.get("currency") or "").upper()
        code = entry["code"].upper()
        if currency and currency not in mapping:
            mapping[currency] = code
    return mapping