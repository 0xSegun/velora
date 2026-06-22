"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Brain,
  TrendingUp,
  TrendingDown,
  Minus,
  Loader2,
  AlertCircle,
  Printer,
  Sparkles,
  BarChart3,
  Activity,
} from "lucide-react";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { ChartTooltipContent } from "@/components/charts/ChartTooltip";
import { predictionsAPI } from "@/lib/api";
import type { Prediction } from "@/types/prediction";
import { useAuthStore } from "@/store/authStore";
import { isAnalystRole } from "@/lib/roles";
import OrdinaryPredictionDetail from "@/components/dashboard/OrdinaryPredictionDetail";
import { formatDate, formatDateTime } from "@/lib/dates";
import { getCountryMeta } from "@/lib/countries";
import { CountryLabel } from "@/components/ui/CountryFlag";
import { formatPercentage, getConfidenceColorValue, getRiskColorValue } from "@/lib/utils";
import EmptyState from "@/components/ui/EmptyState";
import {
  CHART_COLORS,
  chartAxisLine,
  chartAxisTick,
  chartGridStroke,
  chartLegendStyle,
} from "@/lib/chartTheme";
import PrintDocumentHeader from "@/components/print/PrintDocumentHeader";
import { printPage } from "@/lib/print";

function trendIcon(direction: string) {
  const d = direction.toLowerCase();
  if (d === "up") return TrendingUp;
  if (d === "down") return TrendingDown;
  return Minus;
}

const INDICATOR_LABELS: Record<string, string> = {
  cpi: "CPI",
  gdp: "GDP",
  gdp_growth: "GDP Growth",
  interest_rate: "Interest Rate",
  exchange_rate: "Exchange Rate",
  oil_price: "Oil Price",
  gov_spending: "Gov. Spending",
  employment_rate: "Employment Rate",
  unemployment_rate: "Unemployment Rate",
  money_supply: "Money Supply",
  trade_balance: "Trade Balance",
};



export default function PredictionDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const role = useAuthStore((s) => s.user?.role);
  const analystView = isAnalystRole(role);

  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPrediction = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await predictionsAPI.getById(id);
      setPrediction(data);
    } catch {
      setError("Prediction not found or could not be loaded.");
      setPrediction(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void fetchPrediction();
  }, [fetchPrediction]);

  const forecastChartData = useMemo(() => {
    if (!prediction?.forecast_data?.length) return [];
    return prediction.forecast_data.map((pt) => ({
      label: formatDate(pt.date, "MMM yyyy"),
      predicted: pt.predicted_rate,
      lower: pt.lower_bound,
      upper: pt.upper_bound,
    }));
  }, [prediction]);

  const historicalChartData = useMemo(() => {
    if (!prediction?.historical_comparison) return [];
    return Object.entries(prediction.historical_comparison).map(
      ([period, value]) => ({
        period,
        value,
      }),
    );
  }, [prediction]);

  const inputIndicators = useMemo(() => {
    if (!prediction?.input_params) return [];
    return Object.entries(prediction.input_params)
      .filter(([, v]) => v !== null && v !== undefined && v !== "")
      .map(([key, value]) => ({
        key,
        label: INDICATOR_LABELS[key] ?? key.replace(/_/g, " "),
        value: Number(value),
      }))
      .filter((item) => !Number.isNaN(item.value));
  }, [prediction]);

  const confidenceInterval = prediction?.confidence_interval ?? {};

  if (!analystView) {
    return (
      <OrdinaryPredictionDetail
        prediction={prediction}
        loading={loading}
        error={error}
        onRetry={() => void fetchPrediction()}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--text-muted)]" />
      </div>
    );
  }

  if (error || !prediction) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <Link
          href="/analyst/predictions"
          className="inline-flex items-center gap-2 text-sm text-[var(--text-muted)] transition hover:text-[var(--text-primary)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to predictions
        </Link>
        <EmptyState
          icon={AlertCircle}
          title="Prediction unavailable"
          description={error ?? "This prediction could not be found."}
          action={
            <button
              onClick={() => void fetchPrediction()}
              className="rounded-xl border border-[var(--border-active)] bg-[var(--accent-faint)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition hover:bg-[var(--glass-bg-hover)]"
            >
              Retry
            </button>
          }
        />
      </div>
    );
  }

  const country = getCountryMeta(prediction.country_code);
  const TrendIcon = trendIcon(prediction.trend_direction);

  return (
    <div className="print-document mx-auto max-w-6xl space-y-6 print:space-y-4">
      <PrintDocumentHeader
        title={`${country.name} Inflation Forecast`}
        subtitle={
          prediction.model_version
            ? `Model ${prediction.model_version} · ${prediction.forecast_horizon ?? "—"}-month horizon`
            : undefined
        }
      />
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
      >
        <div>
          <Link
            href="/analyst/predictions"
            className="mb-3 inline-flex items-center gap-2 text-sm text-[var(--text-muted)] transition hover:text-[var(--text-primary)] print:hidden"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to predictions
          </Link>
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold text-[var(--text-primary)]">
            <CountryLabel
              code={prediction.country_code}
              name={country.name}
              flagSize="lg"
              nameClassName="text-2xl font-bold text-[var(--text-primary)]"
            />
            <span>Inflation Forecast</span>
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Generated {formatDateTime(prediction.created_at)}
            {prediction.model_version && ` · Model ${prediction.model_version}`}
            {prediction.forecast_horizon &&
              ` · ${prediction.forecast_horizon}-month horizon`}
          </p>
        </div>
        <button
          onClick={printPage}
          className="inline-flex items-center gap-2 self-start rounded-xl border border-[var(--border-active)] bg-[var(--accent-faint)] px-4 py-2.5 text-sm font-medium text-[var(--text-primary)] transition hover:bg-[var(--glass-bg-hover)] print:hidden"
        >
          <Printer className="h-4 w-4" />
          Export
        </button>
      </motion.div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {[
          {
            label: "Predicted Rate",
            value: formatPercentage(prediction.inflation_rate),
            icon: TrendingUp,
          },
          {
            label: "Deflation Prob.",
            value: formatPercentage(prediction.deflation_probability * 100, 1),
            icon: TrendingDown,
          },
          {
            label: "Trend",
            value:
              prediction.trend_direction.charAt(0).toUpperCase() +
              prediction.trend_direction.slice(1),
            icon: TrendIcon,
          },
          {
            label: "Confidence",
            value: formatPercentage(prediction.confidence_score, 1),
            icon: Brain,
            color: getConfidenceColorValue(prediction.confidence_score),
          },
          {
            label: "Risk Level",
            value:
              prediction.risk_level.charAt(0).toUpperCase() +
              prediction.risk_level.slice(1),
            icon: Activity,
            color: getRiskColorValue(prediction.risk_level),
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
            <p
              className={`mt-0.5 text-xl font-bold ${m.color ?? "text-[var(--text-primary)]"}`}
            >
              {m.value}
            </p>
          </motion.div>
        ))}
      </div>

      {/* Forecast chart with confidence interval */}
      {forecastChartData.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-xl hover:transform-none p-6"
        >
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                Full Forecast
              </h2>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                Predicted inflation with confidence bounds
              </p>
            </div>
            {prediction.prediction_period && (
              <span className="rounded-full bg-[var(--accent-faint)] px-2 py-1 text-[10px] font-medium text-[var(--text-muted)]">
                {prediction.prediction_period}
              </span>
            )}
          </div>
          <div className="chart-shell h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={forecastChartData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={chartGridStroke}
                />
                <XAxis
                  dataKey="label"
                  tick={chartAxisTick}
                  axisLine={chartAxisLine}
                />
                <YAxis
                  tick={chartAxisTick}
                  axisLine={chartAxisLine}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  content={
                    <ChartTooltipContent
                      valueFormatter={(value) =>
                        typeof value === "number"
                          ? `${value.toFixed(2)}%`
                          : String(value)
                      }
                    />
                  }
                />
                <Legend wrapperStyle={chartLegendStyle} />
                <Area
                  type="monotone"
                  dataKey="upper"
                  stroke="none"
                  fill="var(--accent-faint)"
                  name="Upper Bound"
                />
                <Area
                  type="monotone"
                  dataKey="lower"
                  stroke="none"
                  fill="var(--bg-primary)"
                  name="Lower Bound"
                />
                <Line
                  type="monotone"
                  dataKey="predicted"
                  stroke={CHART_COLORS.primary}
                  strokeWidth={2.5}
                  dot={{ fill: CHART_COLORS.primary, r: 4 }}
                  name="Predicted"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Monthly timeline */}
          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            {prediction.forecast_data.map((f, i) => {
              const prev = i > 0 ? prediction.forecast_data[i - 1] : null;
              const delta = prev
                ? f.predicted_rate - prev.predicted_rate
                : null;
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
                  <p className="mt-0.5 text-[10px] text-[var(--text-faint)]">
                    {formatPercentage(f.lower_bound, 1)} –{" "}
                    {formatPercentage(f.upper_bound, 1)}
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Trend analysis */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-xl hover:transform-none p-6"
        >
          <h2 className="mb-4 text-lg font-semibold text-[var(--text-primary)]">
            Trend Analysis
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg bg-[var(--accent-faint)] p-3">
              <span className="text-sm text-[var(--text-muted)]">Direction</span>
              <span className="inline-flex items-center gap-1 text-sm font-medium text-[var(--text-primary)]">
                <TrendIcon className="h-4 w-4" />
                {prediction.trend_direction}
              </span>
            </div>
            {prediction.key_influencing_factors &&
              prediction.key_influencing_factors.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                    Key Influencing Factors
                  </p>
                  <ul className="space-y-1.5">
                    {prediction.key_influencing_factors.map((factor, i) => (
                      <li
                        key={i}
                        className="rounded-lg bg-[var(--accent-faint)] px-3 py-2 text-sm text-[var(--text-secondary)]"
                      >
                        {factor}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            {prediction.recommended_actions &&
              prediction.recommended_actions.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                    Recommended Actions
                  </p>
                  <ul className="space-y-1.5">
                    {prediction.recommended_actions.map((action, i) => (
                      <li
                        key={i}
                        className="rounded-lg border border-[var(--border-primary)] px-3 py-2 text-sm text-[var(--text-secondary)]"
                      >
                        {action}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
          </div>
        </motion.div>

        {/* Confidence intervals */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-xl hover:transform-none p-6"
        >
          <h2 className="mb-4 text-lg font-semibold text-[var(--text-primary)]">
            Confidence Intervals
          </h2>
          {Object.keys(confidenceInterval).length > 0 ? (
            <div className="space-y-2">
              {Object.entries(confidenceInterval).map(([key, value]) => (
                <div
                  key={key}
                  className="flex items-center justify-between rounded-lg bg-[var(--accent-faint)] p-3"
                >
                  <span className="text-sm capitalize text-[var(--text-muted)]">
                    {key.replace(/_/g, " ")}
                  </span>
                  <span className="text-sm font-semibold text-[var(--text-primary)]">
                    {typeof value === "number"
                      ? formatPercentage(value, 2)
                      : String(value)}
                  </span>
                </div>
              ))}
            </div>
          ) : forecastChartData.length > 0 ? (
            <div className="space-y-2">
              {prediction.forecast_data.map((pt) => (
                <div
                  key={pt.month}
                  className="flex items-center justify-between rounded-lg bg-[var(--accent-faint)] p-3"
                >
                  <span className="text-sm text-[var(--text-muted)]">
                    {formatDate(pt.date, "MMM yyyy")}
                  </span>
                  <span className="text-sm font-medium text-[var(--text-primary)]">
                    {formatPercentage(pt.lower_bound, 1)} –{" "}
                    {formatPercentage(pt.upper_bound, 1)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--text-muted)]">
              No confidence interval data available.
            </p>
          )}
        </motion.div>
      </div>

      {/* Best / Expected / Worst case bands */}
      {prediction.confidence_bands &&
        Object.keys(prediction.confidence_bands).length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-3 gap-4"
        >
          {[
            ["best_case", "Best Case", "positive"],
            ["expected", "Expected", "neutral"],
            ["worst_case", "Worst Case", "negative"],
          ].map(([key, label, sent]) => (
            <div
              key={key}
              className="glass-card rounded-xl hover:transform-none p-4 text-center"
            >
              <p className="text-xs text-[var(--text-muted)]">{label}</p>
              <p className="mt-1 text-2xl font-bold text-[var(--text-primary)]">
                {prediction.confidence_bands?.[key] != null
                  ? formatPercentage(prediction.confidence_bands[key] as number)
                  : "—"}
              </p>
            </div>
          ))}
        </motion.div>
      )}

      {/* Explainability summary */}
      {Boolean(prediction.explainability?.prediction_explanation) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-xl hover:transform-none p-6"
        >
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              TS-Transformer Explanation
            </h2>
          </div>
          <p className="text-sm text-[var(--text-secondary)]">
            {String(prediction.explainability?.prediction_explanation ?? "")}
          </p>
          <Link
            href="/analyst/explainability"
            className="mt-3 inline-block text-sm text-[var(--text-primary)] hover:underline print:hidden"
          >
            View full explainability center →
          </Link>
        </motion.div>
      )}

      {/* Economic indicators */}
      {inputIndicators.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-xl hover:transform-none p-6"
        >
          <div className="mb-4 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-[var(--text-primary)]" />
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              Economic Indicators (Input Parameters)
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {inputIndicators.map((ind) => (
              <div
                key={ind.key}
                className="rounded-lg border border-[var(--border-primary)] bg-[var(--accent-faint)] p-3"
              >
                <p className="text-xs capitalize text-[var(--text-muted)]">
                  {ind.label}
                </p>
                <p className="mt-1 text-lg font-bold text-[var(--text-primary)]">
                  {ind.value.toLocaleString(undefined, {
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Historical comparison */}
      {historicalChartData.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-xl hover:transform-none p-6"
        >
          <h2 className="mb-4 text-lg font-semibold text-[var(--text-primary)]">
            Historical Comparison
          </h2>
          <div className="chart-shell h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={historicalChartData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={chartGridStroke}
                />
                <XAxis
                  dataKey="period"
                  tick={chartAxisTick}
                  axisLine={chartAxisLine}
                />
                <YAxis
                  tick={chartAxisTick}
                  axisLine={chartAxisLine}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  content={
                    <ChartTooltipContent
                      valueFormatter={(value) =>
                        typeof value === "number"
                          ? `${value.toFixed(2)}%`
                          : String(value)
                      }
                    />
                  }
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  name="Inflation"
                  stroke={CHART_COLORS.secondary}
                  strokeWidth={2}
                  dot={{ fill: CHART_COLORS.secondary, r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      )}

      {/* AI explanation */}
      {prediction.ai_summary && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-[var(--border-primary)] bg-[var(--accent-faint)] p-6"
        >
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[var(--text-primary)]" />
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              AI Explanation
            </h2>
          </div>
          <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
            {prediction.ai_summary}
          </p>
          {prediction.data_sources_used &&
            prediction.data_sources_used.length > 0 && (
              <div className="mt-4 border-t border-[var(--border-primary)] pt-4">
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                  Data Sources
                </p>
                <div className="flex flex-wrap gap-2">
                  {prediction.data_sources_used.map((src, i) => (
                    <span
                      key={i}
                      className="rounded-full bg-[var(--glass-bg)] px-2 py-0.5 text-xs text-[var(--text-muted)]"
                    >
                      {src}
                    </span>
                  ))}
                </div>
              </div>
            )}
        </motion.div>
      )}
    </div>
  );
}