/**
 * Country currency metadata and exchange rate formatting standards.
 */

export interface CurrencyInfo {
  code: string;
  name: string;
  symbol: string;
}

export const CURRENCY_DIRECTORY: Record<string, CurrencyInfo> = {
  NG: { code: 'NGN', name: 'Nigerian Naira', symbol: '₦' },
  US: { code: 'USD', name: 'US Dollar', symbol: '$' },
  GB: { code: 'GBP', name: 'British Pound', symbol: '£' },
  DE: { code: 'EUR', name: 'Euro', symbol: '€' },
  FR: { code: 'EUR', name: 'Euro', symbol: '€' },
  JP: { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  IN: { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
  CN: { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
  BR: { code: 'BRL', name: 'Brazilian Real', symbol: 'R$' },
  ZA: { code: 'ZAR', name: 'South African Rand', symbol: 'R' },
  GH: { code: 'GHS', name: 'Ghanaian Cedi', symbol: '₵' },
  KE: { code: 'KES', name: 'Kenyan Shilling', symbol: 'KSh' },
  CA: { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
  AU: { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  PK: { code: 'PKR', name: 'Pakistani Rupee', symbol: '₨' },
};

const USD_INFO: CurrencyInfo = { code: 'USD', name: 'US Dollar', symbol: '$' };

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

export function getCurrencyInfo(
  countryCode: string,
  currencyCode?: string | null,
): CurrencyInfo {
  const normalized = countryCode?.toUpperCase() ?? '';
  if (_catalogCache?.[normalized]) return _catalogCache[normalized];
  const byCountry = CURRENCY_DIRECTORY[normalized];
  if (byCountry) return byCountry;
  if (currencyCode) {
    const cur = currencyCode.toUpperCase();
    if (_catalogCache?.[cur]) return _catalogCache[cur];
    const entry = Object.values(CURRENCY_DIRECTORY).find((c) => c.code === cur);
    if (entry) return entry;
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
  const info = getCurrencyInfo(countryCode, currencyCode);
  return {
    base: `1 ${USD_INFO.code} (${USD_INFO.symbol})`,
    rate: formatExchangeRate(rate, countryCode, currencyCode),
  };
}

export function formatCurrencyLabel(countryCode: string, currencyCode?: string | null): string {
  const info = getCurrencyInfo(countryCode, currencyCode);
  return `${info.name} (${info.symbol})`;
}