"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  BarChart3,
  TrendingUp,
  Globe,
  Activity,
  DollarSign,
  Briefcase,
  Loader2,
  Brain,
} from "lucide-react";
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { ChartTooltipContent } from "@/components/charts/ChartTooltip";
import {
  CHART_COLORS,
  barFillForMetric,
  chartAxisLine,
  chartAxisTick,
  chartAxisTickSm,
  chartGridStroke,
  inflationChartColor,
} from "@/lib/chartTheme";
import { economicDataAPI, exchangeRatesAPI, predictionsAPI } from "@/lib/api";
import { formatPercentage } from "@/lib/utils";
import FinancialKpiCard from "@/components/ui/FinancialKpiCard";
import CurrencyDisplay from "@/components/ui/CurrencyDisplay";
import CountryFocusBar, { useActiveCountryCode } from "@/components/dashboard/CountryFocusBar";
import { CountryLabel, CurrencyBadge } from "@/components/ui/CountryFlag";
import { getCountryMeta } from "@/lib/countries";
import {
  confidenceSentiment,
  gdpSentiment,
  inflationSentiment,
  sentimentClass,
} from "@/lib/financialColors";
import { formatDate } from "@/lib/dates";
import { formatExchangeRate } from "@/lib/currency";
import EmptyState from "@/components/ui/EmptyState";
import type { Prediction } from "@/types/prediction";

interface EconomicRecord {
  country_code: string;
  country_name: string;
  cpi: number | null;
  gdp_growth: number | null;
  interest_rate: number | null;
  exchange_rate: number | null;
  inflation_rate: number | null;
  data_date: string;
}

type TimeRange = "1M" | "3M" | "6M" | "1Y" | "5Y" | "All";

const RANGE_MONTHS: Record<TimeRange, number | null> = {
  "1M": 1,
  "3M": 3,
  "6M": 6,
  "1Y": 12,
  "5Y": 60,
  All: null,
};

const analyticsValueFormatter = (value: number | string, name: string) => {
  const formatted =
    typeof value === "number" ? value.toFixed(2) : String(value);
  return name.includes("Rate") || name.includes("GDP")
    ? `${formatted}%`
    : formatted;
};

function filterByRange<T extends { data_date?: string; created_at?: string }>(
  items: T[],
  range: TimeRange,
): T[] {
  const months = RANGE_MONTHS[range];
  if (months === null) return items;
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);
  return items.filter((item) => {
    const dateStr = item.data_date ?? item.created_at;
    if (!dateStr) return false;
    return new Date(dateStr) >= cutoff;
  });
}

export default function AnalyticsPage() {
  const countryCode = useActiveCountryCode();
  const [timeRange, setTimeRange] = useState<TimeRange>("1Y");
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [economicData, setEconomicData] = useState<EconomicRecord[]>([]);
  const [fxAnalytics, setFxAnalytics] = useState<{
    strongest?: Array<Record<string, unknown>>;
    weakest?: Array<Record<string, unknown>>;
    most_volatile?: Array<Record<string, unknown>>;
    trends?: Array<Record<string, unknown>>;
    summary?: {
      last_sync?: string | null;
      supported_countries?: number;
      supported_currencies?: number;
    };
  } | null>(null);
  const [liveFx, setLiveFx] = useState<{
    country_code: string;
    exchange_rate: number | null;
    trend: string;
    change_24h?: number | null;
    change_7d?: number | null;
    is_stale: boolean;
    stale_message?: string | null;
    currency_code?: string;
  } | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [predRes, econRes, fxRes] = await Promise.allSettled([
        predictionsAPI.getHistory({ per_page: 200, country_code: countryCode }),
        economicDataAPI.getHistorical({ limit: 500, country_code: countryCode }),
        exchangeRatesAPI.getAnalytics(),
      ]);

      if (predRes.status === "fulfilled") {
        const data = predRes.value.data as { predictions?: Prediction[] };
        setPredictions(data.predictions ?? []);
      } else {
        setPredictions([]);
      }

      if (econRes.status === "fulfilled") {
        const data = econRes.value.data;
        setEconomicData(Array.isArray(data) ? (data as EconomicRecord[]) : []);
      } else {
        setEconomicData([]);
      }

      if (fxRes.status === "fulfilled") {
        setFxAnalytics(fxRes.value.data as typeof fxAnalytics);
      } else {
        setFxAnalytics(null);
      }

      try {
        const fxCountryRes = await exchangeRatesAPI.getByCountry(countryCode);
        setLiveFx(fxCountryRes.data);
      } catch {
        setLiveFx(null);
      }
    } catch {
      setPredictions([]);
      setEconomicData([]);
      setFxAnalytics(null);
      setLiveFx(null);
    } finally {
      setLoading(false);
    }
  }, [countryCode]);

  useEffect(() => {
    setMounted(true);
    loadData();
  }, [loadData]);

  const filteredPredictions = useMemo(
    () => filterByRange(predictions, timeRange),
    [predictions, timeRange],
  );

  const filteredEconomic = useMemo(
    () => filterByRange(economicData, timeRange),
    [economicData, timeRange],
  );

  const avgConfidence = useMemo(() => {
    if (filteredPredictions.length === 0) return null;
    const sum = filteredPredictions.reduce((acc, p) => acc + p.confidence_score, 0);
    return sum / filteredPredictions.length;
  }, [filteredPredictions]);

  const latestEconomic = useMemo(() => {
    if (filteredEconomic.length === 0) return null;
    return [...filteredEconomic].sort(
      (a, b) => new Date(b.data_date).getTime() - new Date(a.data_date).getTime(),
    )[0];
  }, [filteredEconomic]);

  const metrics = useMemo(() => {
    const items = [];
    if (latestEconomic?.inflation_rate != null) {
      items.push({
        icon: TrendingUp,
        label: "Latest Inflation",
        value: formatPercentage(latestEconomic.inflation_rate),
        sub: latestEconomic.country_name,
        sentiment: inflationSentiment(latestEconomic.inflation_rate),
        kind: "inflation" as const,
      });
    }
    if (latestEconomic?.cpi != null) {
      items.push({
        icon: Activity,
        label: "CPI Index",
        value: latestEconomic.cpi.toFixed(1),
        sub: formatDate(latestEconomic.data_date),
        sentiment: "info" as const,
        kind: "cpi" as const,
      });
    }
    const fxRate = liveFx?.exchange_rate ?? latestEconomic?.exchange_rate;
    const fxCountry = liveFx?.country_code ?? latestEconomic?.country_code;
    if (fxRate != null && fxCountry) {
      items.push({
        icon: DollarSign,
        label: "Exchange Rate",
        value: String(fxRate),
        sentiment: liveFx?.is_stale ? ("caution" as const) : ("info" as const),
        kind: "exchange" as const,
        countryCode: fxCountry,
        rate: fxRate,
        isStale: liveFx?.is_stale,
        staleMessage: liveFx?.stale_message,
        change24h: liveFx?.change_24h,
        change7d: liveFx?.change_7d,
        trend: liveFx?.trend,
        currencyCode: liveFx?.currency_code,
      });
    }
    if (latestEconomic?.gdp_growth != null) {
      items.push({
        icon: Briefcase,
        label: "GDP Growth",
        value: formatPercentage(latestEconomic.gdp_growth),
        sub: latestEconomic.country_name,
        sentiment: gdpSentiment(latestEconomic.gdp_growth),
        kind: "gdp" as const,
      });
    }
    if (avgConfidence != null) {
      items.push({
        icon: Brain,
        label: "Forecast Accuracy",
        value: formatPercentage(avgConfidence, 1),
        sub: `Avg of ${filteredPredictions.length} predictions`,
        sentiment: confidenceSentiment(avgConfidence),
        kind: "confidence" as const,
      });
    }
    return items;
  }, [latestEconomic, liveFx, avgConfidence, filteredPredictions.length]);

  const inflationTrendData = useMemo(() => {
    if (filteredPredictions.length === 0) return [];
    const byDate = new Map<string, Record<string, number>>();
    const countries = new Set<string>();

    for (const pred of filteredPredictions) {
      const dateKey = formatDate(pred.created_at);
      countries.add(pred.country_code);
      const existing = byDate.get(dateKey) ?? { date: dateKey } as Record<string, number | string>;
      existing[pred.country_code] = pred.inflation_rate;
      byDate.set(dateKey, existing as Record<string, number>);
    }

    return Array.from(byDate.values()).sort((a, b) =>
      String(a.date).localeCompare(String(b.date)),
    );
  }, [filteredPredictions]);

  const countryCodes = useMemo(() => {
    const codes = new Set<string>();
    filteredPredictions.forEach((p) => codes.add(p.country_code));
    return Array.from(codes).slice(0, 5);
  }, [filteredPredictions]);

  const primaryCountry = countryCode;

  const economicIndicators = useMemo(() => {
    if (!primaryCountry) return [];
    const rows = filteredEconomic
      .filter((e) => e.country_code === primaryCountry)
      .sort((a, b) => new Date(a.data_date).getTime() - new Date(b.data_date).getTime())
      .map((e, idx, arr) => ({
        month: formatDate(e.data_date, "MMM d"),
        cpi: e.cpi,
        gdp: e.gdp_growth,
        interest: e.interest_rate,
        exchange:
          idx === arr.length - 1 &&
          liveFx?.exchange_rate != null &&
          liveFx.country_code === primaryCountry
            ? liveFx.exchange_rate
            : e.exchange_rate,
        inflation: e.inflation_rate,
      }));

    if (
      liveFx?.exchange_rate != null &&
      liveFx.country_code === primaryCountry &&
      rows.length > 0
    ) {
      const last = rows[rows.length - 1];
      last.exchange = liveFx.exchange_rate;
    }

    return rows;
  }, [filteredEconomic, primaryCountry, liveFx]);

  const hasAnyData = predictions.length > 0 || economicData.length > 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--text-muted)]" />
      </div>
    );
  }

  if (!hasAnyData) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Analytics</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Economic analytics for <CountryLabel code={countryCode} />
          </p>
        </motion.div>
        <CountryFocusBar label="Analytics focus" />
        <EmptyState
          icon={BarChart3}
          title="No analytics data available"
          description="Predictions and economic indicators will appear here once data has been collected and forecasts have been run."
          action={
            <button
              onClick={loadData}
              className="px-4 py-2 text-sm rounded-xl bg-[var(--accent-faint)] border border-[var(--border-hover)] text-[var(--text-primary)] hover:bg-[var(--glass-bg-hover)] transition"
            >
              Retry
            </button>
          }
        />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Analytics</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Economic analytics for <CountryLabel code={countryCode} />
        </p>
      </motion.div>

      <CountryFocusBar label="Analytics focus" />

      {/* Time Range Selector */}
      <div className="flex gap-2 flex-wrap">
        {(["1M", "3M", "6M", "1Y", "5Y", "All"] as TimeRange[]).map((r) => (
          <button
            key={r}
            id={`range-${r}`}
            onClick={() => setTimeRange(r)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${
              timeRange === r
                ? "bg-[var(--accent-faint)] text-[var(--text-primary)] border border-[var(--border-active)]"
                : "bg-[var(--accent-faint)] text-[var(--text-muted)] border border-[var(--border-hover)] hover:bg-[var(--glass-bg-hover)]"
            }`}
          >
            {r}
          </button>
        ))}
      </div>

      {/* Metrics Row */}
      {metrics.length > 0 ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {metrics.slice(0, 4).map((m, i) => (
            <motion.div
              key={m.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              {m.kind === "exchange" && m.countryCode && m.rate != null ? (
                <div className="rounded-xl bg-[var(--glass-bg)] border border-[var(--border-primary)] p-5">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3" style={{ backgroundColor: sentimentClass("info", "bg") }}>
                    <m.icon className="w-4 h-4" style={{ color: sentimentClass("info") }} />
                  </div>
                  <p className="text-xs text-[var(--text-muted)]">{m.label}</p>
                  <div className="mt-1">
                    <CurrencyDisplay
                      countryCode={m.countryCode}
                      rate={m.rate}
                      currencyCode={m.currencyCode}
                      variant="block"
                      isStale={m.isStale}
                      staleMessage={m.staleMessage}
                      change24h={m.change24h}
                      change7d={m.change7d}
                      trend={m.trend}
                    />
                  </div>
                </div>
              ) : (
                <FinancialKpiCard
                  label={m.label}
                  value={m.value}
                  icon={m.icon}
                  sentiment={m.sentiment}
                  meta={m.sub}
                />
              )}
            </motion.div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Activity}
          title="No metrics for selected period"
          description="Adjust the time range or wait for new data to be collected."
        />
      )}

      {/* Inflation Trends from Predictions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-xl bg-[var(--glass-bg)] border border-[var(--border-primary)] p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              Inflation Trends
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              From prediction history
            </p>
          </div>
          <Globe className="w-5 h-5 text-[var(--text-muted)]" />
        </div>
        {inflationTrendData.length > 0 && mounted ? (
          <ResponsiveContainer width="100%" height={350} minWidth={0} minHeight={350}>
            <LineChart data={inflationTrendData}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} />
              <XAxis dataKey="date" tick={chartAxisTick} axisLine={chartAxisLine} />
              <YAxis tick={chartAxisTick} axisLine={chartAxisLine} />
              <Tooltip
                content={
                  <ChartTooltipContent valueFormatter={analyticsValueFormatter} />
                }
              />
              <Legend
                wrapperStyle={{ fontSize: 11 }}
                formatter={(value: string) => (
                  <CountryLabel
                    code={value}
                    name={getCountryMeta(value).name}
                    flagSize="xs"
                    className="text-[var(--text-muted)]"
                  />
                )}
              />
              {countryCodes.map((code, i) => {
                const lastVal = inflationTrendData[inflationTrendData.length - 1]?.[code] as number | undefined;
                const stroke = lastVal != null ? inflationChartColor(lastVal) : CHART_COLORS.series[i % CHART_COLORS.series.length];
                return (
                  <Line
                    key={code}
                    type="monotone"
                    dataKey={code}
                    stroke={stroke}
                    strokeWidth={2}
                    dot={{ r: 3, fill: stroke }}
                    name={code}
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState
            icon={TrendingUp}
            title="No inflation trend data"
            description="Run predictions to populate inflation trend charts for this period."
          />
        )}
      </motion.div>

      {/* FX Analytics Section */}
      {fxAnalytics && (fxAnalytics.trends?.length ?? 0) > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="rounded-xl bg-[var(--glass-bg)] border border-[var(--border-primary)] p-6"
        >
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            FX Analytics
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { title: "Strongest Currencies", items: fxAnalytics.strongest ?? [] },
              { title: "Weakest Currencies", items: fxAnalytics.weakest ?? [] },
              { title: "Most Volatile", items: fxAnalytics.most_volatile ?? [] },
            ].map((section) => (
              <div key={section.title} className="rounded-lg border border-[var(--border-primary)] p-3">
                <p className="text-xs font-medium text-[var(--text-muted)] mb-2">{section.title}</p>
                <div className="space-y-1 text-xs">
                  {section.items.slice(0, 5).map((item, i) => (
                    <div key={i} className="flex justify-between text-[var(--text-primary)]">
                      <CurrencyBadge
                        currencyCode={String(
                          item.target_currency ?? item.country_code ?? "—",
                        )}
                        countryCode={
                          item.country_code != null
                            ? String(item.country_code)
                            : undefined
                        }
                      />
                      <span style={{ color: sentimentClass("info") }}>
                        {item.exchange_rate != null
                          ? formatExchangeRate(
                              Number(item.exchange_rate),
                              String(item.country_code ?? ""),
                            )
                          : "—"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {fxAnalytics.summary?.last_sync && (
            <p className="mt-3 text-[10px] text-[var(--text-faint)]">
              Last FX sync: {formatDate(String(fxAnalytics.summary.last_sync))}
            </p>
          )}
        </motion.div>
      )}

      {/* Economic Indicators Grid */}
      {economicIndicators.length > 0 && mounted ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* CPI Trend */}
          {economicIndicators.some((e) => e.cpi != null) && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="rounded-xl bg-[var(--glass-bg)] border border-[var(--border-primary)] p-6"
            >
              <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">
                CPI Index — <CountryLabel code={primaryCountry} />
              </h3>
              <ResponsiveContainer width="100%" height={250} minWidth={0} minHeight={250}>
                <AreaChart data={economicIndicators}>
                  <defs>
                    <linearGradient id="cpiGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--chart-primary)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--chart-primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} />
                  <XAxis dataKey="month" tick={chartAxisTickSm} axisLine={chartAxisLine} />
                  <YAxis tick={chartAxisTickSm} axisLine={chartAxisLine} />
                  <Tooltip
                content={
                  <ChartTooltipContent valueFormatter={analyticsValueFormatter} />
                }
              />
                  <Area
                    type="monotone"
                    dataKey="cpi"
                    stroke={CHART_COLORS.primary}
                    fill="url(#cpiGradient)"
                    strokeWidth={2}
                    name="CPI"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </motion.div>
          )}

          {/* Exchange Rate */}
          {economicIndicators.some((e) => e.exchange != null) && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="rounded-xl bg-[var(--glass-bg)] border border-[var(--border-primary)] p-6"
            >
              <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">
                Exchange Rate — <CountryLabel code={primaryCountry} />
              </h3>
              <ResponsiveContainer width="100%" height={250} minWidth={0} minHeight={250}>
                <AreaChart data={economicIndicators}>
                  <defs>
                    <linearGradient id="exGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--chart-secondary)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--chart-secondary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} />
                  <XAxis dataKey="month" tick={chartAxisTickSm} axisLine={chartAxisLine} />
                  <YAxis tick={chartAxisTickSm} axisLine={chartAxisLine} />
                  <Tooltip
                content={
                  <ChartTooltipContent valueFormatter={analyticsValueFormatter} />
                }
              />
                  <Area
                    type="monotone"
                    dataKey="exchange"
                    stroke={CHART_COLORS.secondary}
                    fill="url(#exGradient)"
                    strokeWidth={2}
                    name="Exchange Rate"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </motion.div>
          )}

          {/* Interest Rate */}
          {economicIndicators.some((e) => e.interest != null) && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="rounded-xl bg-[var(--glass-bg)] border border-[var(--border-primary)] p-6"
            >
              <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">
                Interest Rate — <CountryLabel code={primaryCountry} />
              </h3>
              <ResponsiveContainer width="100%" height={250} minWidth={0} minHeight={250}>
                <BarChart data={economicIndicators}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} />
                  <XAxis dataKey="month" tick={chartAxisTickSm} axisLine={chartAxisLine} />
                  <YAxis tick={chartAxisTickSm} axisLine={chartAxisLine} />
                  <Tooltip
                content={
                  <ChartTooltipContent valueFormatter={analyticsValueFormatter} />
                }
              />
                  <Bar
                    dataKey="interest"
                    fill={CHART_COLORS.info}
                    radius={[4, 4, 0, 0]}
                    name="Interest Rate"
                  />
                </BarChart>
              </ResponsiveContainer>
            </motion.div>
          )}

          {/* GDP Growth */}
          {economicIndicators.some((e) => e.gdp != null) && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="rounded-xl bg-[var(--glass-bg)] border border-[var(--border-primary)] p-6"
            >
              <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">
                GDP Growth Rate — <CountryLabel code={primaryCountry} />
              </h3>
              <ResponsiveContainer width="100%" height={250} minWidth={0} minHeight={250}>
                <AreaChart data={economicIndicators}>
                  <defs>
                    <linearGradient id="gdpGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--chart-tertiary)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--chart-tertiary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} />
                  <XAxis dataKey="month" tick={chartAxisTickSm} axisLine={chartAxisLine} />
                  <YAxis tick={chartAxisTickSm} axisLine={chartAxisLine} />
                  <Tooltip
                content={
                  <ChartTooltipContent valueFormatter={analyticsValueFormatter} />
                }
              />
                  <Area
                    type="monotone"
                    dataKey="gdp"
                    stroke={economicIndicators[economicIndicators.length - 1]?.gdp != null
                      ? barFillForMetric("gdp", economicIndicators[economicIndicators.length - 1].gdp!)
                      : CHART_COLORS.positive}
                    fill="url(#gdpGradient)"
                    strokeWidth={2}
                    name="GDP Growth"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </motion.div>
          )}
        </div>
      ) : (
        <EmptyState
          icon={BarChart3}
          title="No economic indicator data"
          description="Historical economic data will populate indicator charts once available for the selected period."
        />
      )}
    </div>
  );
}