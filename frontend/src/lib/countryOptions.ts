import {
  countryCodeToFlag,
  getAllWorldCountries,
  mergeCountryCatalogFromApi,
} from "@/lib/countryCatalog";
import { getCountryMeta } from "@/lib/countries";
import type { CountryRecord } from "@/lib/api";

export interface CountryOption {
  code: string;
  name: string;
  flag: string;
  flagUrl?: string | null;
  currency?: string | null;
}

/** Full world catalog (249 ISO territories) with optional API overlay. */
export function buildCountryOptions(
  apiCountries: CountryRecord[] = [],
): CountryOption[] {
  if (apiCountries.length) {
    mergeCountryCatalogFromApi(apiCountries);
  }

  return getAllWorldCountries().map((entry) => {
    const meta = getCountryMeta(entry.code, entry.name);
    return {
      code: entry.code,
      name: entry.name || meta.name,
      flag: entry.flag_url ? countryCodeToFlag(entry.code) : meta.flag,
      flagUrl: entry.flag_url ?? `https://flagcdn.com/w40/${entry.code.toLowerCase()}.png`,
      currency: entry.currency ?? null,
    };
  });
}

export function filterCountryOptions(
  options: CountryOption[],
  query: string,
): CountryOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return options;
  return options.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      c.code.toLowerCase().includes(q) ||
      (c.currency?.toLowerCase().includes(q) ?? false),
  );
}