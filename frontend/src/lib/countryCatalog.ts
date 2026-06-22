/**
 * Full ISO 3166-1 world country catalog (249 territories) with flags and currencies.
 */

import worldCountriesData from '@/data/world_countries.json';

export function countryCodeToFlag(code: string | null | undefined): string {
  if (!code || code.length !== 2) return '🌐';
  const upper = code.toUpperCase();
  if (!/^[A-Z]{2}$/.test(upper)) return '🌐';
  return String.fromCodePoint(
    ...[...upper].map((char) => 0x1f1e6 + char.charCodeAt(0) - 65),
  );
}

export interface WorldCountryEntry {
  code: string;
  name: string;
  currency?: string;
  currency_name?: string;
  currency_symbol?: string;
  continent?: string;
  region?: string;
  flag_url?: string;
}

/** Territories used in FX data but absent from strict ISO lists. */
const SUPPLEMENTAL_COUNTRIES: WorldCountryEntry[] = [
  {
    code: "EU",
    name: "European Union",
    currency: "EUR",
    currency_name: "Euro",
    currency_symbol: "€",
    continent: "Europe",
    region: "Western Europe",
    flag_url: "https://flagcdn.com/w40/eu.png",
  },
  {
    code: "XK",
    name: "Kosovo",
    currency: "EUR",
    currency_name: "Euro",
    currency_symbol: "€",
    continent: "Europe",
    region: "Southern Europe",
    flag_url: "https://flagcdn.com/w40/xk.png",
  },
];

const BASE_CATALOG: WorldCountryEntry[] = [
  ...(worldCountriesData as WorldCountryEntry[]).map((entry) => ({
    ...entry,
    code: entry.code.toUpperCase(),
  })),
  ...SUPPLEMENTAL_COUNTRIES.filter(
    (s) =>
      !(worldCountriesData as WorldCountryEntry[]).some(
        (e) => e.code.toUpperCase() === s.code,
      ),
  ),
];

const byCode = new Map<string, WorldCountryEntry>(
  BASE_CATALOG.map((entry) => [entry.code, entry]),
);

const currencyToCountry = new Map<string, string>();
for (const entry of BASE_CATALOG) {
  const currency = entry.currency?.toUpperCase();
  if (currency && !currencyToCountry.has(currency)) {
    currencyToCountry.set(currency, entry.code);
  }
}

let apiOverlay = new Map<string, WorldCountryEntry>();

/** Merge API country records (names, live metadata) over the static catalog. */
export function mergeCountryCatalogFromApi(
  records: Array<{
    code: string;
    name?: string;
    flag?: string;
    flag_url?: string | null;
    currency?: string | null;
    continent?: string | null;
    region?: string | null;
  }> = [],
): void {
  const next = new Map(apiOverlay);
  for (const record of records) {
    const code = record.code.toUpperCase();
    const base = byCode.get(code) ?? { code, name: code };
    next.set(code, {
      ...base,
      name: record.name || base.name,
      flag_url: record.flag_url ?? base.flag_url,
      currency: record.currency ?? base.currency,
      continent: record.continent ?? base.continent,
      region: record.region ?? base.region,
    });
  }
  apiOverlay = next;
}

export function getAllWorldCountries(): WorldCountryEntry[] {
  return BASE_CATALOG.map(
    (entry) => apiOverlay.get(entry.code) ?? entry,
  );
}

export function getWorldCountry(
  code: string | null | undefined,
): WorldCountryEntry | null {
  const normalized = code?.trim().toUpperCase();
  if (!normalized || !/^[A-Z]{2}$/.test(normalized)) return null;
  return apiOverlay.get(normalized) ?? byCode.get(normalized) ?? null;
}

export function getWorldCountryOrFallback(
  code: string,
  name?: string | null,
): WorldCountryEntry {
  const hit = getWorldCountry(code);
  if (hit) return hit;
  const normalized = code.toUpperCase();
  return {
    code: normalized,
    name: name?.trim() || normalized,
    flag_url: `https://flagcdn.com/w40/${normalized.toLowerCase()}.png`,
  };
}

export function countryCodeForCurrency(
  currencyCode: string | null | undefined,
  preferredCountry?: string | null,
): string | null {
  const cur = currencyCode?.trim().toUpperCase();
  if (!cur) return null;
  if (/^[A-Z]{2}$/.test(cur)) return cur;
  if (preferredCountry) {
    const pref = preferredCountry.toUpperCase();
    const entry = getWorldCountry(pref);
    if (entry?.currency?.toUpperCase() === cur) return pref;
  }
  return currencyToCountry.get(cur) ?? null;
}

/** Normalize any platform code to a flagcdn-compatible ISO2 key. */
export function normalizeFlagCode(
  code: string | null | undefined,
): string | null {
  const normalized = code?.trim().toUpperCase();
  if (!normalized) return null;
  if (/^[A-Z]{2}$/.test(normalized)) return normalized;
  return null;
}

export function worldCountryFlagUrl(code: string): string {
  const normalized = normalizeFlagCode(code);
  if (!normalized) return "";
  return (
    getWorldCountry(normalized)?.flag_url ??
    `https://flagcdn.com/w40/${normalized.toLowerCase()}.png`
  );
}

export function worldCountryEmoji(code: string): string {
  return countryCodeToFlag(code);
}