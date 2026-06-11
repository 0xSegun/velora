'use client';

import { CountryLabel } from '@/components/ui/CountryFlag';
import GlowCard from '@/components/ui/GlowCard';
import type { ComparisonData } from '@/lib/api';
import {
  currencySentiment,
  gdpSentiment,
  inflationSentiment,
  sentimentClass,
} from '@/lib/financialColors';

function cellColor(metric: string, value: number | null | undefined): string {
  if (value == null) return 'var(--text-primary)';
  if (metric === 'inflation_rate') return sentimentClass(inflationSentiment(value));
  if (metric === 'gdp_growth') return sentimentClass(gdpSentiment(value));
  if (metric === 'currency_strength') return sentimentClass(currencySentiment(value));
  if (metric === 'stability_score') {
    return sentimentClass(value >= 70 ? 'positive' : value < 50 ? 'negative' : 'caution');
  }
  return 'var(--text-primary)';
}

function cell(v: number | null | undefined, suffix = '%') {
  if (v == null) return '—';
  return `${v.toFixed(2)}${suffix}`;
}

const METRICS = [
  { key: 'inflation_rate', label: 'Inflation', suffix: '%' },
  { key: 'gdp_growth', label: 'GDP Growth', suffix: '%' },
  { key: 'interest_rate', label: 'Interest Rate', suffix: '%' },
  { key: 'currency_strength', label: 'Currency Strength', suffix: '' },
  { key: 'stability_score', label: 'Stability', suffix: '' },
] as const;

export default function CountryComparisonWidget({ data }: { data: ComparisonData }) {
  if (!data.countries.length) {
    return (
      <GlowCard id="country-comparison" className="p-5">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">Country Comparison</h2>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Select multiple countries below to compare inflation, GDP, rates, and stability side by side.
        </p>
      </GlowCard>
    );
  }

  const primaryValues: Record<string, number | null | undefined> = {
    inflation_rate: data.countries[0]?.primary_inflation,
    gdp_growth: data.countries[0]?.primary_gdp,
    interest_rate: data.countries[0]?.primary_interest,
    currency_strength: data.countries[0]?.primary_currency,
    stability_score: data.countries[0]?.primary_stability,
  };

  return (
    <GlowCard id="country-comparison" className="overflow-hidden p-0">
      <div className="border-b border-[var(--border-primary)] px-5 py-4">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">Country Comparison</h2>
        <p className="text-xs text-[var(--text-muted)]">
          Primary: <CountryLabel code={data.primary.code} name={data.primary.name} flagSize="xs" />
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--border-primary)] bg-[var(--accent-faint)]/40">
              <th className="px-4 py-3 text-xs font-medium text-[var(--text-muted)]">Metric</th>
              <th className="px-4 py-3 text-xs font-medium text-[var(--text-muted)]">
                <CountryLabel code={data.primary.code} name={data.primary.name} flagSize="xs" />
              </th>
              {data.countries.map((c) => (
                <th key={c.code} className="px-4 py-3 text-xs font-medium text-[var(--text-muted)]">
                  <CountryLabel code={c.code} name={c.name} flagSize="xs" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {METRICS.map((m) => (
              <tr key={m.key} className="border-b border-[var(--border-primary)] last:border-0">
                <td className="px-4 py-3 text-[var(--text-secondary)]">{m.label}</td>
                <td
                  className="px-4 py-3 font-medium"
                  style={{ color: cellColor(m.key, primaryValues[m.key]) }}
                >
                  {cell(primaryValues[m.key], m.suffix)}
                </td>
                {data.countries.map((c) => {
                  const val = c[m.key as keyof typeof c] as number | null;
                  return (
                    <td
                      key={`${c.code}-${m.key}`}
                      className="px-4 py-3 font-medium"
                      style={{ color: cellColor(m.key, val) }}
                    >
                      {cell(val, m.suffix)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </GlowCard>
  );
}