/** ISO 3166-1 alpha-2 country metadata and flag helpers. */

import {
  countryCodeToFlag,
  getWorldCountryOrFallback,
  getAllWorldCountries,
  type WorldCountryEntry,
} from '@/lib/countryCatalog';

export { countryCodeToFlag };

export interface CountryMeta {
  code: string;
  name: string;
  flag: string;
  currency?: string;
  currency_name?: string;
  currency_symbol?: string;
}

function entryToMeta(entry: WorldCountryEntry): CountryMeta {
  return {
    code: entry.code,
    name: entry.name,
    flag: countryCodeToFlag(entry.code),
    currency: entry.currency,
    currency_name: entry.currency_name,
    currency_symbol: entry.currency_symbol,
  };
}

/** All 249 ISO territories — use for selects and lookups. */
export const COUNTRY_DIRECTORY: CountryMeta[] = getAllWorldCountries().map(
  entryToMeta,
);

export function getCountryMeta(
  code: string,
  name?: string | null,
): CountryMeta {
  const entry = getWorldCountryOrFallback(code, name);
  const meta = entryToMeta(entry);
  if (name?.trim()) {
    meta.name = name.trim();
  }
  return meta;
}

export function formatCountryLabel(
  code: string,
  name?: string | null,
): string {
  const meta = getCountryMeta(code, name);
  return `${meta.flag} ${meta.name}`;
}

// Re-export currency helpers via country catalog consumers
export { getCurrencyInfo, countryCodeForFlag } from '@/lib/currency';