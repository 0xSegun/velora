/**
 * Country currency metadata and exchange rate formatting standards.
 */

import {
  countryCodeForCurrency,
  getAllWorldCountries,
  getWorldCountry,
} from '@/lib/countryCatalog';

export interface CurrencyInfo {
  code: string;
  name: string;
  symbol: string;
}

const USD_INFO: CurrencyInfo = { code: 'USD', name: 'US Dollar', symbol: '$' };

function buildWorldCurrencyMaps(): {
  byCountry: Record<string, CurrencyInfo>;
  byCurrency: Record<string, CurrencyInfo>;
} {
  const byCountry: Record<string, CurrencyInfo> = {};
  const byCurrency: Record<string, CurrencyInfo> = {};
  for (const entry of getAllWorldCountries()) {
    if (!entry.currency) continue;
    const info: CurrencyInfo = {
      code: entry.currency,
      name: entry.currency_name || entry.currency,
      symbol: entry.currency_symbol || '',
    };
    byCountry[entry.code] = info;
    if (!byCurrency[entry.currency]) {
      byCurrency[entry.currency] = info;
    }
  }
  return { byCountry, byCurrency };
}

const WORLD_MAPS = buildWorldCurrencyMaps();

let _catalogCache: Record<string, CurrencyInfo> | null = null;

export function setCurrencyCatalogFromApi(
  items: Array<{ code: string; name: string; symbol?: string; country_code?: string }>,
): void {
  _catalogCache = {};
  for (const item of items) {
    const info: CurrencyInfo = {
      code: item.code,
      name: item.name,
      symbol: item.symbol ?? '',
    };
    _catalogCache[item.code] = info;
    if (item.country_code) {
      _catalogCache[item.country_code] = info;
    }
  }
}

/** @deprecated Use world catalog via getCurrencyInfo — kept for legacy imports. */
export const CURRENCY_DIRECTORY: Record<string, CurrencyInfo> = WORLD_MAPS.byCountry;

export function getCurrencyInfo(
  countryCode: string,
  currencyCode?: string | null,
): CurrencyInfo {
  const normalized = countryCode?.toUpperCase() ?? '';
  if (_catalogCache?.[normalized]) return _catalogCache[normalized];
  if (WORLD_MAPS.byCountry[normalized]) return WORLD_MAPS.byCountry[normalized];

  const world = getWorldCountry(normalized);
  if (world?.currency) {
    return {
      code: world.currency,
      name: world.currency_name || world.currency,
      symbol: world.currency_symbol || '',
    };
  }

  if (currencyCode) {
    const cur = currencyCode.toUpperCase();
    if (_catalogCache?.[cur]) return _catalogCache[cur];
    if (WORLD_MAPS.byCurrency[cur]) return WORLD_MAPS.byCurrency[cur];
    return { code: cur, name: cur, symbol: '' };
  }
  return { code: '—', name: 'Unknown', symbol: '' };
}

function formatRateNumber(rate: number): string {
  if (rate >= 100) return rate.toLocaleString('en-US', { maximumFractionDigits: 0 });
  return rate.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

/** Standard: ₦1,600 NGN /$ */
export function formatExchangeRate(
  rate: number | null | undefined,
  countryCode: string,
  currencyCode?: string | null,
): string {
  if (rate == null || Number.isNaN(rate)) {
    return 'Latest official data not currently available.';
  }
  const info = getCurrencyInfo(countryCode, currencyCode);
  if (info.code === 'USD') {
    return `${info.symbol}${formatRateNumber(rate)} ${info.code}`;
  }
  const prefix = info.symbol ? `${info.symbol}${formatRateNumber(rate)}` : formatRateNumber(rate);
  return `${prefix} ${info.code} /$`;
}

/** Two-line block: base USD line + target rate */
export function formatExchangeRateBlock(
  rate: number | null | undefined,
  countryCode: string,
  currencyCode?: string | null,
): { base: string; rate: string } {
  return {
    base: `1 ${USD_INFO.code} (${USD_INFO.symbol})`,
    rate: formatExchangeRate(rate, countryCode, currencyCode),
  };
}

export function formatCurrencyLabel(countryCode: string, currencyCode?: string | null): string {
  const info = getCurrencyInfo(countryCode, currencyCode);
  return `${info.name} (${info.symbol || info.code})`;
}

/** Resolve an ISO2 country code for flag display from country or currency code. */
export function countryCodeForFlag(
  code: string | null | undefined,
  countryCode?: string | null,
): string | null {
  if (countryCode?.trim()) {
    const cc = countryCode.trim().toUpperCase();
    if (/^[A-Z]{2}$/.test(cc)) return cc;
  }
  const normalized = code?.trim().toUpperCase();
  if (!normalized) return null;
  if (/^[A-Z]{2}$/.test(normalized)) return normalized;
  return countryCodeForCurrency(normalized, countryCode);
}