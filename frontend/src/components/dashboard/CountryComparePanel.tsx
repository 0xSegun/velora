'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  GitCompare,
  Loader2,
  X,
  Search,
  CheckSquare,
  Square,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { CountryFlag, CountryLabel } from '@/components/ui/CountryFlag';
import { predictionsAPI } from '@/lib/api';
import { toast } from '@/lib/feedback';
import {
  CHART_COLORS,
  chartAxisLine,
  chartAxisTick,
  chartGridStroke,
  inflationChartColor,
} from '@/lib/chartTheme';
import {
  currencySentiment,
  gdpSentiment,
  inflationSentiment,
  sentimentClass,
} from '@/lib/financialColors';
import { formatPercentage } from '@/lib/utils';
import type { Prediction } from '@/types/prediction';

export const MAX_COMPARE_COUNTRIES = 10;

export interface CompareCountryOption {
  code: string;
  name: string;
  flag?: string;
  inflation_rate?: number | null;
  gdp_growth?: number | null;
  interest_rate?: number | null;
}

interface CountryComparePanelProps {
  countries: CompareCountryOption[];
  /** Controlled selection — when provided, parent owns selection state */
  selection?: string[];
  initialSelection?: string[];
  onSelectionChange?: (codes: string[]) => void;
  showCountryPicker?: boolean;
  className?: string;
}

const METRICS = [
  { key: 'inflation_rate', label: 'Inflation', suffix: '%' },
  { key: 'gdp_growth', label: 'GDP Growth', suffix: '%' },
  { key: 'interest_rate', label: 'Interest Rate', suffix: '%' },
] as const;

function cellColor(metric: string, value: number | null | undefined): string {
  if (value == null) return 'var(--text-primary)';
  if (metric === 'inflation_rate') return sentimentClass(inflationSentiment(value));
  if (metric === 'gdp_growth') return sentimentClass(gdpSentiment(value));
  return 'var(--text-primary)';
}

const ChartTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) => {
  if (!active || !payload) return null;
  return (
    <div className="glass-card rounded-xl p-3 shadow-xl hover:transform-none">
      <p className="mb-1 text-xs font-medium text-[var(--text-primary)]">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="text-xs" style={{ color: entry.color }}>
          {entry.name}: {typeof entry.value === 'number' ? entry.value.toFixed(2) : entry.value}%
        </p>
      ))}
    </div>
  );
};

export default function CountryComparePanel({
  countries,
  selection: controlledSelection,
  initialSelection = [],
  onSelectionChange,
  showCountryPicker = true,
  className = '',
}: CountryComparePanelProps) {
  const [internalSelection, setInternalSelection] = useState<string[]>(initialSelection);
  const selection = controlledSelection ?? internalSelection;
  const [pickerSearch, setPickerSearch] = useState('');
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareData, setCompareData] = useState<Record<string, Prediction> | null>(null);
  const [compareError, setCompareError] = useState<string | null>(null);

  const countryMap = useMemo(
    () => new Map(countries.map((c) => [c.code, c])),
    [countries],
  );

  useEffect(() => {
    if (controlledSelection == null && initialSelection.length > 0) {
      setInternalSelection(initialSelection.filter((c) => countryMap.has(c)));
    }
  }, [controlledSelection, initialSelection.join(','), countryMap]);

  const setSelection = useCallback(
    (updater: string[] | ((prev: string[]) => string[])) => {
      const prev = selection;
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (controlledSelection == null) setInternalSelection(next);
      onSelectionChange?.(next);
      setCompareData(null);
      setCompareError(null);
    },
    [controlledSelection, onSelectionChange, selection],
  );

  const updateSelection = useCallback(
    (codes: string[]) => setSelection(codes),
    [setSelection],
  );

  const toggleCountry = (code: string) => {
    if (selection.includes(code)) {
      updateSelection(selection.filter((c) => c !== code));
      return;
    }
    if (selection.length >= MAX_COMPARE_COUNTRIES) {
      toast.error(`Maximum ${MAX_COMPARE_COUNTRIES} countries for comparison.`);
      return;
    }
    updateSelection([...selection, code]);
  };

  const removeCountry = (code: string) => {
    updateSelection(selection.filter((c) => c !== code));
  };

  const clearSelection = () => updateSelection([]);

  const pickerResults = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase();
    if (q.length < 1) return countries.slice(0, 12);
    return countries
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.code.toLowerCase().includes(q),
      )
      .slice(0, 12);
  }, [countries, pickerSearch]);

  const runComparison = async () => {
    if (selection.length < 2) return;
    setCompareLoading(true);
    setCompareError(null);
    try {
      const { data } = await predictionsAPI.compare(selection, 6);
      const result = data as { comparisons?: Record<string, Prediction> };
      setCompareData(result.comparisons ?? null);
      if (!result.comparisons || Object.keys(result.comparisons).length < 2) {
        setCompareError('Not enough prediction data returned. Try other countries.');
      }
    } catch {
      setCompareError('Comparison failed. Select at least two countries with economic data.');
      setCompareData(null);
    } finally {
      setCompareLoading(false);
    }
  };

  const comparisonChartData = useMemo(() => {
    if (!compareData) return [];
    const months = new Set<number>();
    Object.values(compareData).forEach((pred) => {
      pred.forecast_data?.forEach((fp) => months.add(fp.month));
    });
    return Array.from(months)
      .sort((a, b) => a - b)
      .map((month) => {
        const point: Record<string, string | number> = { month: `M${month}` };
        Object.entries(compareData).forEach(([code, pred]) => {
          const fp = pred.forecast_data?.find((f) => f.month === month);
          if (fp) point[code] = fp.predicted_rate;
        });
        return point;
      });
  }, [compareData]);

  const economicTable = useMemo(() => {
    return selection.map((code) => {
      const c = countryMap.get(code);
      const pred = compareData?.[code];
      return {
        code,
        name: c?.name ?? code,
        inflation_rate: pred?.inflation_rate ?? c?.inflation_rate ?? null,
        gdp_growth: (pred?.input_params?.gdp_growth as number | undefined) ?? c?.gdp_growth ?? null,
        interest_rate: (pred?.input_params?.interest_rate as number | undefined) ?? c?.interest_rate ?? null,
        confidence: pred?.confidence_score ?? null,
      };
    });
  }, [selection, countryMap, compareData]);

  return (
    <div className={`glass-card rounded-xl hover:transform-none p-4 ${className}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <GitCompare className="h-4 w-4 text-[var(--text-muted)]" />
          <span className="text-sm font-medium text-[var(--text-primary)]">Compare Countries</span>
          <span className="text-xs text-[var(--text-muted)]">
            Select 2–{MAX_COMPARE_COUNTRIES} countries
          </span>
        </div>
        <div className="flex items-center gap-2">
          {selection.length > 0 && (
            <button
              type="button"
              onClick={clearSelection}
              className="px-2 py-1 text-[10px] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              Clear all
            </button>
          )}
          <button
            type="button"
            id="run-country-comparison"
            onClick={() => void runComparison()}
            disabled={selection.length < 2 || compareLoading}
            className="flex items-center justify-center gap-2 rounded-xl border border-[var(--border-hover)] bg-[var(--accent-faint)] px-4 py-2 text-xs font-medium text-[var(--text-primary)] transition hover:bg-[var(--glass-bg-hover)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {compareLoading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <GitCompare className="h-3 w-3" />
            )}
            Run Comparison ({selection.length})
          </button>
        </div>
      </div>

      {/* Selected chips */}
      {selection.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {selection.map((code) => {
            const c = countryMap.get(code);
            return (
              <span
                key={code}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-active)] bg-[var(--accent-faint)] px-2.5 py-1 text-xs text-[var(--text-primary)]"
              >
                <CountryFlag code={code} size="xs" title={c?.name} />
                {c?.name ?? code}
                <button
                  type="button"
                  onClick={() => removeCountry(code)}
                  className="rounded p-0.5 hover:bg-[var(--glass-bg-hover)]"
                  aria-label={`Remove ${c?.name ?? code}`}
                >
                  <X className="h-3 w-3 text-[var(--text-muted)]" />
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* Country picker */}
      {showCountryPicker && (
        <div className="mt-4 rounded-lg border border-[var(--border-primary)] bg-[var(--accent-faint)]/40 p-3">
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              value={pickerSearch}
              onChange={(e) => setPickerSearch(e.target.value)}
              placeholder="Search and add countries to comparison..."
              className="w-full rounded-lg border border-[var(--border-primary)] bg-[var(--glass-bg)] py-2 pl-9 pr-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-faint)]"
            />
          </div>
          <div className="grid gap-1 sm:grid-cols-2">
            {pickerResults.map((c) => {
              const selected = selection.includes(c.code);
              const atMax = !selected && selection.length >= MAX_COMPARE_COUNTRIES;
              return (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => toggleCountry(c.code)}
                  disabled={atMax}
                  className={`flex items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition ${
                    selected
                      ? 'bg-[var(--accent-faint)] border border-[var(--border-active)]'
                      : 'hover:bg-[var(--glass-bg-hover)] border border-transparent'
                  } ${atMax ? 'opacity-40 cursor-not-allowed' : ''}`}
                >
                  {selected ? (
                    <CheckSquare className="h-4 w-4 shrink-0 text-[var(--text-primary)]" />
                  ) : (
                    <Square className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
                  )}
                  <CountryFlag code={c.code} size="sm" title={c.name} />
                  <span className="truncate text-[var(--text-secondary)]">{c.name}</span>
                  {c.inflation_rate != null && (
                    <span
                      className="ml-auto text-xs font-medium"
                      style={{ color: sentimentClass(inflationSentiment(c.inflation_rate)) }}
                    >
                      {formatPercentage(c.inflation_rate)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {compareError && (
        <p className="mt-3 text-xs text-[var(--text-muted)]">{compareError}</p>
      )}

      {/* Economic metrics table for selected countries */}
      {selection.length >= 2 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-xs">
            <thead>
              <tr className="border-b border-[var(--border-primary)] text-[var(--text-muted)]">
                <th className="py-2 pr-4 font-medium">Country</th>
                {METRICS.map((m) => (
                  <th key={m.key} className="py-2 pr-4 font-medium">{m.label}</th>
                ))}
                <th className="py-2 font-medium">Confidence</th>
              </tr>
            </thead>
            <tbody>
              {economicTable.map((row) => (
                <tr key={row.code} className="border-b border-[var(--border-primary)] last:border-0">
                  <td className="py-2 pr-4">
                    <CountryLabel code={row.code} name={row.name} flagSize="xs" />
                  </td>
                  {METRICS.map((m) => {
                    const val = row[m.key as keyof typeof row] as number | null;
                    return (
                      <td
                        key={m.key}
                        className="py-2 pr-4 font-medium"
                        style={{ color: cellColor(m.key, val) }}
                      >
                        {val != null ? `${val.toFixed(2)}${m.suffix}` : '—'}
                      </td>
                    );
                  })}
                  <td
                    className="py-2 font-medium"
                    style={{
                      color: sentimentClass(
                        row.confidence != null && row.confidence >= 0.9
                          ? 'positive'
                          : row.confidence != null && row.confidence >= 0.7
                            ? 'caution'
                            : 'neutral',
                      ),
                    }}
                  >
                    {row.confidence != null
                      ? formatPercentage(row.confidence <= 1 ? row.confidence * 100 : row.confidence, 0)
                      : compareData ? '—' : 'Run compare'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Forecast chart */}
      {compareData && comparisonChartData.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-medium text-[var(--text-muted)]">Inflation Forecast Comparison</p>
          <ResponsiveContainer width="100%" height={240} minWidth={0} minHeight={240}>
            <LineChart data={comparisonChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} />
              <XAxis dataKey="month" tick={chartAxisTick} axisLine={chartAxisLine} />
              <YAxis tick={chartAxisTick} axisLine={chartAxisLine} />
              <Tooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {Object.keys(compareData).map((code, i) => {
                const lastPoint = comparisonChartData[comparisonChartData.length - 1]?.[code] as number | undefined;
                const stroke = lastPoint != null
                  ? inflationChartColor(lastPoint)
                  : CHART_COLORS.series[i % CHART_COLORS.series.length];
                return (
                  <Line
                    key={code}
                    type="monotone"
                    dataKey={code}
                    stroke={stroke}
                    strokeWidth={2}
                    dot={{ r: 2, fill: stroke }}
                    name={countryMap.get(code)?.name ?? code}
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}