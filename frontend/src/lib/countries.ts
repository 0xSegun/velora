/** ISO 3166-1 alpha-2 country metadata and flag helpers. */

import { CURRENCY_DIRECTORY, getCurrencyInfo } from '@/lib/currency';

export interface CountryMeta {
  code: string;
  name: string;
  flag: string;
  currency?: string;
  currency_name?: string;
  currency_symbol?: string;
}

export const COUNTRY_DIRECTORY: CountryMeta[] = [
  { code: "NG", name: "Nigeria", flag: countryCodeToFlag("NG") },
  { code: "US", name: "United States", flag: countryCodeToFlag("US") },
  { code: "GB", name: "United Kingdom", flag: countryCodeToFlag("GB") },
  { code: "GH", name: "Ghana", flag: countryCodeToFlag("GH") },
  { code: "ZA", name: "South Africa", flag: countryCodeToFlag("ZA") },
  { code: "KE", name: "Kenya", flag: countryCodeToFlag("KE") },
  { code: "IN", name: "India", flag: countryCodeToFlag("IN") },
  { code: "CN", name: "China", flag: countryCodeToFlag("CN") },
  { code: "DE", name: "Germany", flag: countryCodeToFlag("DE") },
  { code: "FR", name: "France", flag: countryCodeToFlag("FR") },
  { code: "JP", name: "Japan", flag: countryCodeToFlag("JP") },
  { code: "BR", name: "Brazil", flag: countryCodeToFlag("BR") },
  { code: "CA", name: "Canada", flag: countryCodeToFlag("CA") },
  { code: "AU", name: "Australia", flag: countryCodeToFlag("AU") },
];

export function countryCodeToFlag(code: string | null | undefined): string {
  if (!code || code.length !== 2) return "🌐";
  const upper = code.toUpperCase();
  if (!/^[A-Z]{2}$/.test(upper)) return "🌐";
  return String.fromCodePoint(
    ...[...upper].map((char) => 0x1f1e6 + char.charCodeAt(0) - 65),
  );
}

export function getCountryMeta(
  code: string,
  name?: string | null,
): CountryMeta {
  const normalized = code.toUpperCase();
  const match = COUNTRY_DIRECTORY.find((c) => c.code === normalized);
  const currency = getCurrencyInfo(normalized);
  return {
    code: normalized,
    name: name?.trim() || match?.name || normalized,
    flag: countryCodeToFlag(normalized),
    currency: currency.code,
    currency_name: currency.name,
    currency_symbol: currency.symbol,
  };
}

export { CURRENCY_DIRECTORY, getCurrencyInfo };

export function formatCountryLabel(
  code: string,
  name?: string | null,
  options?: { showCode?: boolean },
): string {
  const meta = getCountryMeta(code, name);
  if (options?.showCode) return `${meta.flag} ${meta.name} (${meta.code})`;
  return `${meta.flag} ${meta.name}`;
}