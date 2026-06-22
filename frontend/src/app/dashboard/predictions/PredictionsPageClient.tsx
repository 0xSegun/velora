"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  Brain,
  TrendingUp,
  TrendingDown,
  Minus,
  Globe,
  ArrowRight,
  Sparkles,
  Loader2,
  AlertCircle,
  BarChart3,
  Search,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { ChartTooltipContent } from "@/components/charts/ChartTooltip";
import { predictionsAPI } from "@/lib/api";
import { handleApiError } from "@/lib/errorHandler";
import { MESSAGES } from "@/lib/feedback";
import CountryFocusBar, { useActiveCountryCode } from "@/components/dashboard/CountryFocusBar";
import CountryIntelligencePanel from "@/components/dashboard/CountryIntelligencePanel";
import GeneratePredictionPanel from "@/components/dashboard/GeneratePredictionPanel";
import type { Prediction } from "@/types/prediction";
import {
  formatDate,
  formatRelative,
  getCurrentMonthLabel,
} from "@/lib/dates";
import { getCountryMeta } from "@/lib/countries";
import { CountryLabel } from "@/components/ui/CountryFlag";
import { formatPercentage, getConfidenceColor, getRiskColor } from "@/lib/utils";
import EmptyState from "@/components/ui/EmptyState";
import {
  CHART_COLORS,
  chartAxisLine,
  chartAxisTick,
  chartGridStroke,
} from "@/lib/chartTheme";

function isActivePrediction(p: Prediction): boolean {
  const now = new Date();
  const created = new Date(p.created_at);
  const daysSince =
    (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
  if (daysSince <= 30) return true;
  return p.forecast_data.some((pt) => new Date(pt.date) >= now);
}

function trendIcon(direction: string) {
  const d = direction.toLowerCase();
  if (d === "up") return TrendingUp;
  if (d === "down") return TrendingDown;
  return Minus;
}

function PredictionRow({ prediction }: { prediction: Prediction }) {
  const TrendIcon = trendIcon(prediction.trend_direction);

  return (
    <tr className="border-b border-[var(--border-primary)] transition hover:bg-[var(--glass-bg-hover)]">
      <td className="py-3 pr-4">
        <CountryLabel
          code={prediction.country_code}
          flagSize="sm"
          nameClassName="text-sm text-[var(--text-primary)]"
        />
      </td>
      <td className="py-3 pr-4">
        <span className="text-sm font-semibold text-[var(--text-primary)]">
          {formatPercentage(prediction.inflation_rate)}
        </span>
      </td>
      <td className="py-3 pr-4">
        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--accent-faint)] px-2 py-0.5 text-xs font-medium text-[var(--text-secondary)]">
          <TrendIcon className="h-3 w-3" />
          {prediction.trend_direction}
        </span>
      </td>
      <td className="py-3 pr-4">
        <span
          className={`text-sm ${getConfidenceColor(prediction.confidence_score)}`}
        >
          {formatPercentage(prediction.confidence_score, 1)}
        </span>
      </td>
      <td className="py-3 pr-4">
        <span
          className={`rounded-full bg-[var(--accent-faint)] px-2 py-0.5 text-xs font-medium capitalize ${getRiskColor(prediction.risk_level)}`}
        >
          {prediction.risk_level}
        </span>
      </td>
      <td className="py-3 pr-4">
        <span className="text-sm text-[var(--text-muted)]">
          {formatDate(prediction.created_at)}
        </span>
      </td>
      <td className="py-3">
        <Link
          href={`/dashboard/predictions/${prediction.id}`}
          className="inline-flex text-[var(--text-muted)] transition hover:text-[var(--text-primary)]"
          aria-label={`View prediction for ${getCountryMeta(prediction.country_code).name}`}
        >
          <ArrowRight className="h-4 w-4" />
        </Link>
      </td>
    </tr>
  );
}

function PredictionTable({
  items,
  emptyTitle,
  emptyDescription,
}: {
  items: Prediction[];
  emptyTitle: string;
  emptyDescription: string;
}) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={Brain}
        title={emptyTitle}
        description={emptyDescription}
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-[var(--border-primary)]">
            {["Country", "Rate", "Trend", "Confidence", "Risk", "Date", ""].map(
              (h) => (
                <th
                  key={h}
                  className="pb-3 pr-4 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]"
                >
                  {h}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {items.map((p) => (
            <PredictionRow key={p.id} prediction={p} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function PredictionsPageClient({
  showIntelligencePanel = false,
}: {
  showIntelligencePanel?: boolean;
}) {
  const searchParams = useSearchParams();
  const activeCountry = useActiveCountryCode();
  const queryCountry = searchParams.get("country")?.toUpperCase();
  const focusCountry = queryCountry || activeCountry;
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showAllCountries, setShowAllCountries] = useState(false);

  const countryFiltered = useMemo(() => {
    if (showAllCountries) return predictions;
    return predictions.filter(
      (p) => p.country_code.toUpperCase() === focusCountry.toUpperCase(),
    );
  }, [predictions, focusCountry, showAllCountries]);

  const searchedPredictions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return countryFiltered;
    return countryFiltered.filter((p) => {
      const country = getCountryMeta(p.country_code);
      return (
        p.country_code.toLowerCase().includes(q) ||
        country.name.toLowerCase().includes(q) ||
        p.trend_direction.toLowerCase().includes(q) ||
        p.risk_level.toLowerCase().includes(q) ||
        p.ai_summary?.toLowerCase().includes(q)
      );
    });
  }, [countryFiltered, search]);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await predictionsAPI.getHistory({ per_page: 100 });
      setPredictions(data.predictions ?? []);
    } catch (err) {
      const message = handleApiError(
        err,
        "Predictions",
        MESSAGES.network.database,
        false,
      );
      setError(message);
      setPredictions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchHistory();
  }, [fetchHistory]);

  const { active, historical } = useMemo(() => {
    const activeItems: Prediction[] = [];
    const historicalItems: Prediction[] = [];
    for (const p of searchedPredictions) {
      if (isActivePrediction(p)) activeItems.push(p);
      else historicalItems.push(p);
    }
    return { active: activeItems, historical: historicalItems };
  }, [searchedPredictions]);

  const latestActive = active[0] ?? searchedPredictions[0] ?? null;

  const confidenceTrend = useMemo(() => {
    return [...searchedPredictions]
      .sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      )
      .map((p) => ({
        date: formatDate(p.created_at, "MMM d"),
        confidence: p.confidence_score,
        country: p.country_code,
      }));
  }, [searchedPredictions]);

  const countryForecasts = useMemo(() => {
    const map = new Map<string, Prediction>();
    for (const p of searchedPredictions) {
      const existing = map.get(p.country_code);
      if (
        !existing ||
        new Date(p.created_at) > new Date(existing.created_at)
      ) {
        map.set(p.country_code, p);
      }
    }
    return Array.from(map.values()).sort(
      (a, b) => b.inflation_rate - a.inflation_rate,
    );
  }, [searchedPredictions]);

  const commentaryItems = useMemo(() => {
    return searchedPredictions.filter((p) => p.ai_summary?.trim()).slice(0, 3);
  }, [searchedPredictions]);

  const forecastTimeline = latestActive?.forecast_data ?? [];

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--text-muted)]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <EmptyState
          icon={AlertCircle}
          title="Failed to load predictions"
          description={error}
          action={
            <button
              onClick={() => void fetchHistory()}
              className="rounded-xl border border-[var(--border-active)] bg-[var(--accent-faint)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition hover:bg-[var(--glass-bg-hover)]"
            >
              Retry
            </button>
          }
        />
      </div>
    );
  }

  if (predictions.length === 0) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">
            AI Predictions
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Forecast timeline for {getCurrentMonthLabel()}
          </p>
        </motion.div>
        <CountryFocusBar label="Forecast country" />
        {showIntelligencePanel && <CountryIntelligencePanel />}
        <GeneratePredictionPanel key={focusCountry} initialCountry={focusCountry} />
        <EmptyState
          variant="warning"
          title="No predictions yet"
          description="Select a country above and press Generate Prediction to create your first forecast."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">
          AI Predictions
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Forecast timeline for {getCurrentMonthLabel()} · {searchedPredictions.length}{" "}
          {showAllCountries ? "total" : `for ${getCountryMeta(focusCountry).name}`} · {active.length} active
        </p>
      </motion.div>

      <CountryFocusBar label="Forecast country" />

      {showIntelligencePanel && <CountryIntelligencePanel />}

      <GeneratePredictionPanel
        key={focusCountry}
        initialCountry={focusCountry}
        onGenerated={() => void fetchHistory()}
      />

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setShowAllCountries((v) => !v)}
          className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
            showAllCountries
              ? "border-[var(--border-active)] bg-[var(--accent-faint)] text-[var(--text-primary)]"
              : "border-[var(--border-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          }`}
        >
          {showAllCountries ? "Showing all countries" : `Focused on ${getCountryMeta(focusCountry).name}`}
        </button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search predictions by country, trend, risk..."
          className="app-input w-full rounded-xl py-2 pl-10 pr-4 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-faint)]"
        />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          {
            label: "Active Predictions",
            value: String(active.length),
            icon: Brain,
          },
          {
            label: "Countries Covered",
            value: String(countryForecasts.length),
            icon: Globe,
          },
          {
            label: "Avg Confidence",
            value: formatPercentage(
              predictions.reduce((s, p) => s + p.confidence_score, 0) /
                predictions.length,
              1,
            ),
            icon: BarChart3,
          },
          {
            label: "Latest Update",
            value: formatRelative(predictions[0]?.created_at),
            icon: TrendingUp,
          },
        ].map((m, i) => (
          <motion.div
            key={m.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="glass-card rounded-xl hover:transform-none p-4"
          >
            <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent-faint)]">
              <m.icon className="h-4 w-4 text-[var(--text-primary)]" />
            </div>
            <p className="text-xs text-[var(--text-muted)]">{m.label}</p>
            <p className="mt-0.5 text-xl font-bold text-[var(--text-primary)]">
              {m.value}
            </p>
          </motion.div>
        ))}
      </div>

      {forecastTimeline.length > 0 && latestActive && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-xl hover:transform-none p-6"
        >
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                Forecast Timeline
              </h2>
              <p className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-[var(--text-muted)]">
                <CountryLabel code={latestActive.country_code} flagSize="xs" />
                <span>· Generated {formatDate(latestActive.created_at)}</span>
              </p>
            </div>
            <Link
              href={`/dashboard/predictions/${latestActive.id}`}
              className="flex items-center gap-1 text-xs text-[var(--text-muted)] transition hover:text-[var(--text-primary)]"
            >
              View detail <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            {forecastTimeline.map((f, i) => {
              const prev = i > 0 ? forecastTimeline[i - 1] : null;
              const delta = prev ? f.predicted_rate - prev.predicted_rate : null;
              return (
                <div
                  key={`${f.month}-${f.date}`}
                  className="rounded-lg border border-[var(--border-primary)] bg-[var(--accent-faint)] p-3 text-center"
                >
                  <p className="text-xs text-[var(--text-muted)]">
                    {formatDate(f.date, "MMM yyyy")}
                  </p>
                  <p className="mt-1 text-lg font-bold text-[var(--text-primary)]">
                    {formatPercentage(f.predicted_rate, 1)}
                  </p>
                  {delta !== null && (
                    <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                      {delta < 0 ? "↓" : delta > 0 ? "↑" : "→"}{" "}
                      {Math.abs(delta).toFixed(1)}%
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {confidenceTrend.length > 1 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-xl hover:transform-none p-6"
        >
          <h2 className="mb-4 text-lg font-semibold text-[var(--text-primary)]">
            Confidence Trends
          </h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={confidenceTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} />
                <XAxis dataKey="date" tick={chartAxisTick} axisLine={chartAxisLine} />
                <YAxis
                  tick={chartAxisTick}
                  axisLine={chartAxisLine}
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  content={
                    <ChartTooltipContent
                      valueFormatter={(value) =>
                        typeof value === "number"
                          ? `${value.toFixed(1)}%`
                          : String(value)
                      }
                    />
                  }
                />
                <Line
                  type="monotone"
                  dataKey="confidence"
                  name="Confidence"
                  stroke={CHART_COLORS.primary}
                  strokeWidth={2}
                  dot={{ fill: CHART_COLORS.primary, r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      )}

      {countryForecasts.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-xl hover:transform-none p-6"
        >
          <h2 className="mb-4 text-lg font-semibold text-[var(--text-primary)]">
            Country Forecasts
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {countryForecasts.map((p) => {
              const TrendIcon = trendIcon(p.trend_direction);
              return (
                <Link
                  key={p.id}
                  href={`/dashboard/predictions/${p.id}`}
                  className="group rounded-xl border border-[var(--border-primary)] bg-[var(--accent-faint)] p-4 transition hover:border-[var(--border-active)] hover:bg-[var(--glass-bg-hover)]"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <CountryLabel
                        code={p.country_code}
                        flagSize="sm"
                        nameClassName="text-sm font-semibold text-[var(--text-primary)]"
                      />
                      <p className="mt-1 text-2xl font-bold text-[var(--text-primary)]">
                        {formatPercentage(p.inflation_rate)}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-[var(--text-faint)] transition group-hover:text-[var(--text-primary)]" />
                  </div>
                  <div className="mt-3 flex items-center gap-3 text-xs text-[var(--text-muted)]">
                    <span className="inline-flex items-center gap-1">
                      <TrendIcon className="h-3 w-3" />
                      {p.trend_direction}
                    </span>
                    <span>{formatPercentage(p.confidence_score, 1)} conf.</span>
                    <span>{formatRelative(p.created_at)}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </motion.div>
      )}

      {commentaryItems.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-3"
        >
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[var(--text-primary)]" />
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              AI Commentary
            </h2>
          </div>
          {commentaryItems.map((p) => (
            <div
              key={p.id}
              className="rounded-xl border border-[var(--border-primary)] bg-[var(--accent-faint)] p-5"
            >
              <div className="mb-2 flex items-center justify-between">
                <p className="flex flex-wrap items-center gap-1 text-xs font-medium text-[var(--text-muted)]">
                  <CountryLabel code={p.country_code} flagSize="xs" />
                  <span>· {formatDate(p.created_at)}</span>
                </p>
                <Link
                  href={`/dashboard/predictions/${p.id}`}
                  className="text-xs text-[var(--text-muted)] transition hover:text-[var(--text-primary)]"
                >
                  Read more
                </Link>
              </div>
              <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
                {p.ai_summary}
              </p>
            </div>
          ))}
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card rounded-xl hover:transform-none p-6"
      >
        <h2 className="mb-4 text-lg font-semibold text-[var(--text-primary)]">
          Active Predictions
        </h2>
        <PredictionTable
          items={active}
          emptyTitle="No active predictions"
          emptyDescription="Active forecasts appear here when generated within the last 30 days or with future forecast points."
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card rounded-xl hover:transform-none p-6"
      >
        <h2 className="mb-4 text-lg font-semibold text-[var(--text-primary)]">
          Historical Predictions
        </h2>
        <PredictionTable
          items={historical}
          emptyTitle="No historical predictions"
          emptyDescription="Older forecasts will be archived here once they are no longer active."
        />
      </motion.div>
    </div>
  );
}