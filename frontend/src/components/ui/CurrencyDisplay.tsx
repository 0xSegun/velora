'use client';

import {
  formatCurrencyLabel,
  formatExchangeRate,
  formatExchangeRateBlock,
  getCurrencyInfo,
} from '@/lib/currency';
import { sentimentClass } from '@/lib/financialColors';
import { cn } from '@/lib/utils';
import { getCountryMeta } from '@/lib/countries';
import { CountryFlag, CurrencyBadge } from '@/components/ui/CountryFlag';

interface CurrencyDisplayProps {
  countryCode: string;
  countryName?: string;
  rate?: number | null;
  currencyCode?: string | null;
  variant?: 'inline' | 'block' | 'profile';
  className?: string;
  isStale?: boolean;
  staleMessage?: string | null;
  change24h?: number | null;
  change7d?: number | null;
  trend?: string;
}

const STALE_BANNER = 'Latest exchange rate data is temporarily unavailable.';

function TrendBadge({ trend, change7d }: { trend?: string; change7d?: number | null }) {
  if (!trend || trend === 'stable') return null;
  const color = trend === 'up' ? 'negative' : trend === 'down' ? 'positive' : 'caution';
  return (
    <span className="text-[10px]" style={{ color: sentimentClass(color) }}>
      {trend === 'up' ? '▲' : '▼'} 7d {change7d != null ? change7d.toFixed(2) : ''}
    </span>
  );
}

export default function CurrencyDisplay({
  countryCode,
  countryName,
  rate,
  currencyCode,
  variant = 'inline',
  className,
  isStale,
  staleMessage,
  change24h,
  change7d,
  trend,
}: CurrencyDisplayProps) {
  const info = getCurrencyInfo(countryCode, currencyCode);
  const staleBanner = isStale ? (staleMessage || STALE_BANNER) : null;

  if (variant === 'profile') {
    return (
      <div className={cn('space-y-2 text-sm', className)}>
        <div className="flex items-center gap-2">
          <CountryFlag code={countryCode} size="md" />
          {countryName && (
            <p className="font-semibold text-[var(--text-primary)]">{countryName}</p>
          )}
        </div>
        <div className="grid gap-1 text-xs">
          <p className="flex flex-wrap items-center gap-2 text-[var(--text-muted)]">
            Currency:{' '}
            <CurrencyBadge
              currencyCode={info.code}
              countryCode={countryCode}
            />
            <span className="text-[var(--text-secondary)]">
              {formatCurrencyLabel(countryCode, currencyCode)}
            </span>
          </p>
          <p className="text-[var(--text-muted)]">
            Symbol:{' '}
            <span className="font-medium text-[var(--text-primary)]">{info.symbol || '—'}</span>
          </p>
          <p className="flex items-center gap-2 text-[var(--text-muted)]">
            Code:{' '}
            <CurrencyBadge
              currencyCode={info.code}
              countryCode={countryCode}
              className="text-[var(--text-secondary)]"
            />
          </p>
          <p className="text-[var(--text-muted)]">
            Exchange Rate:{' '}
            <span className="font-semibold" style={{ color: sentimentClass('info') }}>
              {formatExchangeRate(rate ?? null, countryCode, currencyCode)}
            </span>
          </p>
          {(change24h != null || change7d != null) && (
            <p className="text-[var(--text-faint)]">
              24h: {change24h != null ? change24h.toFixed(2) : '—'} · 7d: {change7d != null ? change7d.toFixed(2) : '—'}
            </p>
          )}
          <TrendBadge trend={trend} change7d={change7d} />
          {staleBanner && (
            <p className="text-[10px]" style={{ color: sentimentClass('caution') }}>{staleBanner}</p>
          )}
        </div>
      </div>
    );
  }

  if (variant === 'block') {
    const block = formatExchangeRateBlock(rate ?? null, countryCode, currencyCode);
    return (
      <div className={cn('space-y-0.5', className)}>
        <div className="flex items-center gap-1.5">
          <CountryFlag code={countryCode} size="xs" />
          <p className="text-[10px] text-[var(--text-faint)]">{block.base}</p>
        </div>
        <p className="font-semibold text-[var(--text-primary)]">{block.rate}</p>
        <TrendBadge trend={trend} change7d={change7d} />
        {staleBanner && (
          <p className="text-[10px]" style={{ color: sentimentClass('caution') }}>{staleBanner}</p>
        )}
      </div>
    );
  }

  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <CountryFlag code={countryCode} size="xs" />
      <span className="font-semibold" style={{ color: sentimentClass('info') }}>
        {formatExchangeRate(rate ?? null, countryCode, currencyCode)}
      </span>
      {staleBanner && (
        <span className="text-[10px]" style={{ color: sentimentClass('caution') }}>
          {staleBanner}
        </span>
      )}
    </span>
  );
}