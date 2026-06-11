'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion, Reorder } from 'framer-motion';
import { Plus, Search, X, GripVertical } from 'lucide-react';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { CountryLabel } from '@/components/ui/CountryFlag';
import TrendIndicator from '@/components/ui/TrendIndicator';
import { countriesAPI, dashboardAPI, type DashboardCountryCard } from '@/lib/api';
import { toast } from '@/lib/feedback';
import { gdpSentiment, inflationSentiment, sentimentClass } from '@/lib/financialColors';

interface TrackedCountriesPanelProps {
  tracked: DashboardCountryCard[];
  primaryCode: string;
  maxTracked: number;
  onUpdate: () => void;
}

export default function TrackedCountriesPanel({
  tracked,
  primaryCode,
  maxTracked,
  onUpdate,
}: TrackedCountriesPanelProps) {
  const [managing, setManaging] = useState(false);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 280);
  const [results, setResults] = useState<{ code: string; name: string }[]>([]);
  const [order, setOrder] = useState(tracked.map((t) => t.code));

  const ordered = useMemo(() => {
    const map = new Map(tracked.map((t) => [t.code, t]));
    return order.map((c) => map.get(c)).filter(Boolean) as DashboardCountryCard[];
  }, [tracked, order]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const q = debouncedSearch.trim();
      if (q.length < 2) {
        setResults([]);
        return;
      }
      const data = await countriesAPI.list({ search: q, per_page: 8 });
      if (cancelled) return;
      setResults(
        data.countries
          .filter((c) => c.code !== primaryCode)
          .map((c) => ({ code: c.code, name: c.name })),
      );
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, primaryCode]);

  const saveOrder = async (codes: string[]) => {
    setOrder(codes);
    await dashboardAPI.updateTrackedCountries(codes);
    onUpdate();
  };

  const addCountry = async (code: string) => {
    if (ordered.length >= maxTracked) {
      toast.error(`Maximum ${maxTracked} tracked countries.`);
      return;
    }
    const codes = [...ordered.map((t) => t.code), code];
    await dashboardAPI.updateTrackedCountries(codes);
    setSearch('');
    setResults([]);
    setManaging(false);
    onUpdate();
    toast.success('Country added to tracked list.');
  };

  const removeCountry = async (code: string) => {
    const codes = ordered.map((t) => t.code).filter((c) => c !== code);
    await dashboardAPI.updateTrackedCountries(codes);
    onUpdate();
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Tracked Countries</h2>
          <p className="text-xs text-[var(--text-muted)]">
            Up to {maxTracked} additional countries · {ordered.length}/{maxTracked}
          </p>
        </div>
        <button
          onClick={() => setManaging((v) => !v)}
          className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-primary)] px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--glass-bg-hover)]"
        >
          <Plus className="h-3.5 w-3.5" />
          Manage
        </button>
      </div>

      {managing && (
        <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--accent-faint)] p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search countries..."
              className="w-full rounded-lg border border-[var(--border-primary)] bg-[var(--glass-bg)] py-2 pl-9 pr-3 text-sm text-[var(--text-primary)]"
            />
          </div>
          {results.length > 0 && (
            <ul className="mt-2 max-h-40 overflow-y-auto space-y-1">
              {results.map((c) => (
                <li key={c.code}>
                  <button
                    onClick={() => void addCountry(c.code)}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-[var(--glass-bg-hover)]"
                  >
                    <CountryLabel code={c.code} name={c.name} flagSize="sm" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {ordered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--border-primary)] p-6 text-center text-sm text-[var(--text-muted)]">
          Add up to {maxTracked} countries to monitor alongside your primary country.
        </p>
      ) : (
        <Reorder.Group
          axis="y"
          values={order}
          onReorder={(codes) => void saveOrder(codes)}
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
        >
          {ordered.map((card) => {
            return (
              <Reorder.Item key={card.code} value={card.code}>
                <Link href={`/dashboard/countries?country=${card.code}`}>
                  <motion.div
                    whileHover={{ y: -2 }}
                    className="glass-card rounded-xl hover:transform-none p-4 transition hover:border-[var(--border-hover)]"
                  >
                    <div className="mb-3 flex items-start justify-between">
                      <CountryLabel code={card.code} name={card.name} flagSize="md" nameClassName="font-semibold" />
                      <div className="flex items-center gap-1">
                        <GripVertical className="h-3.5 w-3.5 text-[var(--text-faint)]" />
                        {managing && (
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              void removeCountry(card.code);
                            }}
                            className="rounded p-1 hover:bg-[var(--accent-faint)]"
                          >
                            <X className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <p className="text-[var(--text-muted)]">Inflation</p>
                        <p
                          className="font-semibold"
                          style={{ color: sentimentClass(inflationSentiment(card.metrics.inflation_rate)) }}
                        >
                          {card.metrics.inflation_rate != null
                            ? `${card.metrics.inflation_rate.toFixed(2)}%`
                            : '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[var(--text-muted)]">Deflation Risk</p>
                        <p
                          className="font-semibold"
                          style={{
                            color: sentimentClass(
                              card.metrics.deflation_risk != null && card.metrics.deflation_risk > 30
                                ? 'negative'
                                : 'positive',
                            ),
                          }}
                        >
                          {card.metrics.deflation_risk != null
                            ? `${card.metrics.deflation_risk.toFixed(1)}%`
                            : '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[var(--text-muted)]">GDP</p>
                        <p
                          className="font-semibold"
                          style={{ color: sentimentClass(gdpSentiment(card.metrics.gdp_growth)) }}
                        >
                          {card.metrics.gdp_growth != null
                            ? `${card.metrics.gdp_growth.toFixed(2)}%`
                            : '—'}
                        </p>
                      </div>
                      <div className="flex items-end">
                        <TrendIndicator
                          direction={card.prediction?.trend_direction}
                          invert
                          size="sm"
                        />
                      </div>
                    </div>
                  </motion.div>
                </Link>
              </Reorder.Item>
            );
          })}
        </Reorder.Group>
      )}
    </section>
  );
}