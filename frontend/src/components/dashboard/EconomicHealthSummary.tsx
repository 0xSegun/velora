'use client';

import GlowCard from '@/components/ui/GlowCard';
import TrendIndicator from '@/components/ui/TrendIndicator';
import type { EconomicHealthItem } from '@/lib/api';
import {
  currencySentiment,
  gdpSentiment,
  inflationSentiment,
  sentimentClass,
} from '@/lib/financialColors';

function itemSentiment(label: string, value: number | null): ReturnType<typeof inflationSentiment> {
  if (value == null) return 'neutral';
  if (label.includes('Inflation')) return inflationSentiment(value);
  if (label.includes('Deflation')) return value > 30 ? 'negative' : 'positive';
  if (label.includes('GDP')) return gdpSentiment(value);
  if (label.includes('Currency')) return currencySentiment(value);
  if (label.includes('Stability') || label.includes('Confidence')) {
    return value >= 70 ? 'positive' : value < 50 ? 'negative' : 'caution';
  }
  return 'info';
}

export default function EconomicHealthSummary({ items }: { items: EconomicHealthItem[] }) {
  return (
    <GlowCard id="economic-health-summary" className="p-5">
      <h2 className="mb-4 text-lg font-semibold text-[var(--text-primary)]">
        Economic Health Summary
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((item) => {
          const sentiment = itemSentiment(item.label, item.value);
          return (
            <div
              key={item.label}
              className="rounded-xl border border-[var(--border-primary)] p-4"
              style={{ backgroundColor: sentimentClass(sentiment, 'bg') }}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs text-[var(--text-muted)]">{item.label}</p>
                  <p
                    className="text-xl font-bold"
                    style={{ color: sentimentClass(sentiment) }}
                  >
                    {item.value != null ? `${item.value}${item.suffix ?? ''}` : '—'}
                  </p>
                </div>
                <TrendIndicator
                  direction={item.trend_direction}
                  label={item.trend_label}
                  invert={item.label.includes('Inflation') || item.label.includes('Deflation')}
                />
              </div>
              <p className="mt-2 text-xs leading-relaxed text-[var(--text-muted)]">
                {item.explanation}
              </p>
            </div>
          );
        })}
      </div>
    </GlowCard>
  );
}