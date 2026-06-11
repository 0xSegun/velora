'use client';

import type { LucideIcon } from 'lucide-react';
import {
  type FinancialSentiment,
  sentimentClass,
} from '@/lib/financialColors';
import TrendIndicator from '@/components/ui/TrendIndicator';
import { cn } from '@/lib/utils';

interface FinancialKpiCardProps {
  label: string;
  value: string;
  icon?: LucideIcon;
  trendDirection?: string | null;
  trendChange?: number | null;
  trendSuffix?: string;
  status?: string;
  sentiment?: FinancialSentiment;
  invertTrend?: boolean;
  meta?: string;
  source?: string | null;
  lastUpdated?: string | null;
  className?: string;
}

export default function FinancialKpiCard({
  label,
  value,
  icon: Icon,
  trendDirection,
  trendChange,
  trendSuffix = '%',
  status,
  sentiment = 'neutral',
  invertTrend = false,
  meta,
  source,
  lastUpdated,
  className,
}: FinancialKpiCardProps) {
  return (
    <div
      className={cn(
        'glass-card rounded-xl p-4 hover:transform-none',
        className,
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs text-[var(--text-muted)]">{label}</p>
        {Icon && (
          <div
            className="flex h-7 w-7 items-center justify-center rounded-lg"
            style={{ backgroundColor: sentimentClass(sentiment, 'bg') }}
          >
            <Icon className="h-3.5 w-3.5" style={{ color: sentimentClass(sentiment) }} />
          </div>
        )}
      </div>
      <p
        className="text-xl font-bold"
        style={{ color: sentimentClass(sentiment) }}
      >
        {value}
      </p>
      {(trendDirection || trendChange != null) && (
        <div className="mt-2">
          <TrendIndicator
            direction={trendDirection}
            change={trendChange}
            suffix={trendSuffix}
            invert={invertTrend}
          />
        </div>
      )}
      {status && (
        <p className="mt-1.5 text-[10px] text-[var(--text-muted)]">
          Status:{' '}
          <span style={{ color: sentimentClass(sentiment) }}>{status}</span>
        </p>
      )}
      {meta && <p className="mt-1 text-[10px] text-[var(--text-faint)]">{meta}</p>}
      {(source || lastUpdated) && (
        <p className="mt-1.5 text-[10px]" style={{ color: sentimentClass('info') }}>
          {source && <>Source: {source}</>}
          {source && lastUpdated && ' · '}
          {lastUpdated && <>Updated: {lastUpdated}</>}
        </p>
      )}
    </div>
  );
}