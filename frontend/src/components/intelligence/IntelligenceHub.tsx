"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Brain,
  FileText,
  Globe,
  Loader2,
  MessageCircle,
  Shield,
  Sparkles,
  TrendingUp,
  Zap,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { chartTooltipProps } from "@/components/charts/ChartTooltip";
import CountryFocusBar, { useActiveCountryCode } from "@/components/dashboard/CountryFocusBar";
import { CountryLabel } from "@/components/ui/CountryFlag";
import PageLoadError from "@/components/ui/PageLoadError";
import { intelligenceAPI } from "@/lib/api";
import { chartAxisLine, chartAxisTick, chartGridStroke } from "@/lib/chartTheme";
import { sentimentTextClass } from "@/lib/financialColors";
import { getCountryMeta } from "@/lib/countries";

type Tab =
  | "overview"
  | "changes"
  | "warnings"
  | "backtest"
  | "map"
  | "similarity"
  | "archive"
  | "nlq";

const SEVERITY_CLASS: Record<string, string> = {
  green: "bg-[var(--text-muted)]/10 text-[var(--text-secondary)] border-[var(--border-primary)]",
  yellow: "bg-amber-500/10 text-amber-200 border-amber-500/30",
  red: "bg-red-500/10 text-red-200 border-red-500/30",
};

const RELIABILITY_CLASS: Record<string, string> = {
  Excellent: "text-emerald-300",
  Good: "text-[var(--text-primary)]",
  Moderate: "text-amber-200",
  Low: "text-red-300",
};

interface HubProps {
  analystMode?: boolean;
}

export default function IntelligenceHub({ analystMode = false }: HubProps) {
  const countryCode = useActiveCountryCode();
  const [tab, setTab] = useState<Tab>("overview");
  const [hub, setHub] = useState<Record<string, unknown> | null>(null);
  const [mapData, setMapData] = useState<Record<string, unknown> | null>(null);
  const [backtest, setBacktest] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [nlqQuestion, setNlqQuestion] = useState("");
  const [nlqAnswer, setNlqAnswer] = useState<Record<string, unknown> | null>(null);
  const [nlqLoading, setNlqLoading] = useState(false);
  const [mapIndicator, setMapIndicator] = useState("inflation_level");
  const [mapContinent, setMapContinent] = useState("");
  const [mapLoading, setMapLoading] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [backtestLoading, setBacktestLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const hasLoadedRef = useRef(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setLoadError(false);
    try {
      const { data } = await intelligenceAPI.getHub(countryCode);
      setHub(data);
    } catch {
      if (!isRefresh) setHub(null);
      setLoadError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [countryCode]);

  useEffect(() => {
    void load(hasLoadedRef.current);
    hasLoadedRef.current = true;
  }, [load]);

  const loadMap = useCallback(async () => {
    setMapLoading(true);
    setMapError(false);
    try {
      const params: Record<string, string> = { indicator: mapIndicator };
      if (mapContinent) params.continent = mapContinent;
      const { data } = await intelligenceAPI.getInflationMap(params);
      setMapData(data);
    } catch {
      setMapData(null);
      setMapError(true);
    } finally {
      setMapLoading(false);
    }
  }, [mapIndicator, mapContinent]);

  const loadBacktest = useCallback(async () => {
    setBacktestLoading(true);
    try {
      const { data } = await intelligenceAPI.getBacktest(countryCode);
      setBacktest(data);
    } catch {
      setBacktest(null);
    } finally {
      setBacktestLoading(false);
    }
  }, [countryCode]);

  useEffect(() => {
    if (tab === "map") void loadMap();
    if (tab === "backtest" && analystMode) void loadBacktest();
  }, [tab, loadMap, loadBacktest, analystMode]);

  const askNlq = async () => {
    if (!nlqQuestion.trim()) return;
    setNlqLoading(true);
    try {
      const { data } = await intelligenceAPI.naturalLanguageQuery({
        question: nlqQuestion,
        country_code: countryCode,
      });
      setNlqAnswer(data);
    } finally {
      setNlqLoading(false);
    }
  };

  const tabs: { id: Tab; label: string; icon: React.ElementType; analystOnly?: boolean }[] = [
    { id: "overview", label: "Overview", icon: Sparkles },
    { id: "changes", label: "What Changed", icon: TrendingUp },
    { id: "warnings", label: "Early Warnings", icon: AlertTriangle },
    { id: "similarity", label: "Similar Countries", icon: Globe },
    { id: "archive", label: "Forecast Archive", icon: Activity },
    { id: "map", label: "Global Map", icon: BarChart3 },
    { id: "backtest", label: "Backtesting", icon: Brain, analystOnly: true },
    { id: "nlq", label: "Ask AI", icon: MessageCircle },
  ];

  if (loading && !hub) {
    return (
      <div className="space-y-6">
        <CountryFocusBar />
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--text-muted)]" />
        </div>
      </div>
    );
  }

  if (loadError && !hub) {
    return (
      <div className="space-y-6">
        <CountryFocusBar />
        <PageLoadError title="Failed to load Intelligence Hub" onRetry={() => void load()} />
      </div>
    );
  }

  if (!hub) return null;

  const insights = hub.insights as Record<string, unknown> | undefined;
  const regime = hub.regime as Record<string, unknown> | undefined;
  const latest = hub.latest_forecast as Record<string, unknown> | undefined;
  const changes = hub.forecast_changes as Record<string, unknown> | undefined;
  const warnings = hub.early_warnings as { warnings?: Array<Record<string, unknown>>; summary?: Record<string, number> } | undefined;
  const similar = hub.similar_countries as { similar?: Array<Record<string, unknown>> } | undefined;
  const archive = hub.forecast_archive as Record<string, unknown> | undefined;
  const recommendations = hub.recommendations as Array<Record<string, unknown>> | undefined;
  const resilience = hub.resilience as Record<string, unknown> | undefined;
  const health = hub.economic_health as Record<string, unknown> | undefined;
  const cpiSelection = hub.cpi_selection as Record<string, unknown> | undefined;
  const dataSelection = hub.data_selection as Record<string, unknown> | undefined;
  const indicatorSelections = (
    (dataSelection?.selections as Record<string, Record<string, unknown>>) ?? {}
  );
  const resolvedIndicators = Object.entries(indicatorSelections).filter(
    ([, sel]) => sel?.value != null,
  );

  const archiveTrend = (archive?.trend_analysis as Array<Record<string, unknown>>) ?? [];

  return (
    <div className="space-y-6">
      <CountryFocusBar />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
              Intelligence Hub
            </h1>
            {refreshing && <Loader2 className="h-4 w-4 animate-spin text-[var(--text-muted)]" />}
          </div>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Explainable forecasts, risk monitoring, and economic intelligence for{" "}
            <CountryLabel code={countryCode} />
          </p>
        </div>
        {Boolean(resilience?.using_cached_data) && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Using cached data — predictions continue with warnings
          </div>
        )}
      </div>

      {/* Auto insights strip */}
      {insights && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            { label: "Key Insight", value: insights.key_insight, icon: Sparkles },
            { label: "Biggest Risk", value: insights.biggest_risk, icon: Shield },
            { label: "Opportunity", value: insights.biggest_opportunity, icon: Zap },
            { label: "Trend", value: insights.trend_direction, icon: TrendingUp },
            { label: "Confidence", value: insights.confidence_level, icon: Activity },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-4"
            >
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-[var(--text-muted)]">
                <item.icon className="h-3.5 w-3.5" />
                {item.label}
              </div>
              <p className="mt-2 text-sm text-[var(--text-primary)]">{String(item.value ?? "—")}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-1">
        {tabs
          .filter((t) => !t.analystOnly || analystMode)
          .map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
                tab === t.id
                  ? "bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              }`}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          ))}
      </div>

      <motion.div
        key={tab}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        {tab === "overview" && (
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-6">
              <h2 className="text-lg font-medium text-[var(--text-primary)]">Economic Narrative</h2>
              <p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)]">
                {String(latest?.narrative ?? "Run a forecast to generate AI economic storytelling.")}
              </p>
              {latest?.prediction_id != null && (
                <button
                  type="button"
                  onClick={async () => {
                    const { data } = await intelligenceAPI.getExplainabilityPdf(String(latest.prediction_id));
                    const url = URL.createObjectURL(new Blob([data], { type: "application/pdf" }));
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `explainability_${latest.prediction_id}.pdf`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="mt-4 inline-flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  <FileText className="h-4 w-4" />
                  Download Explainability PDF
                </button>
              )}
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-6">
                <h2 className="text-lg font-medium text-[var(--text-primary)]">Reliability Score</h2>
                <div className="mt-3 flex items-baseline gap-3">
                  <span className="text-4xl font-semibold text-[var(--text-primary)]">
                    {latest?.reliability_score != null ? Number(latest.reliability_score).toFixed(0) : "—"}
                  </span>
                  <span className={`text-sm font-medium ${RELIABILITY_CLASS[String(latest?.reliability_level ?? "")] ?? ""}`}>
                    {String(latest?.reliability_level ?? "")}
                  </span>
                </div>
              </div>

              <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-6">
                <h2 className="text-lg font-medium text-[var(--text-primary)]">Economic Regime</h2>
                <p className="mt-2 text-sm font-medium text-[var(--text-primary)]">
                  {String(regime?.regime_label ?? "—")}
                </p>
                <p className="mt-2 text-sm text-[var(--text-muted)]">{String(regime?.explanation ?? "")}</p>
              </div>

              <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-6">
                <h2 className="text-lg font-medium text-[var(--text-primary)]">Health Index</h2>
                <p className="mt-2 text-3xl font-semibold">{Number(health?.score ?? 0).toFixed(0)}/100</p>
                <p className="text-sm text-[var(--text-muted)]">{String(health?.label ?? "")}</p>
              </div>

              {cpiSelection && (
                <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-6">
                  <h2 className="text-lg font-medium text-[var(--text-primary)]">CPI Data Source</h2>
                  <p className="mt-2 text-sm font-medium text-[var(--text-primary)]">
                    {String(cpiSelection.source_label ?? cpiSelection.source ?? "—")}
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">
                    {cpiSelection.inflation_rate != null
                      ? `${Number(cpiSelection.inflation_rate).toFixed(2)}%`
                      : "—"}
                  </p>
                  <p className="mt-2 text-xs text-[var(--text-muted)]">
                    Accuracy score: {Number(cpiSelection.accuracy_score ?? 0).toFixed(1)}/100
                    {cpiSelection.candidates_considered != null
                      ? ` · ${Number(cpiSelection.candidates_considered)} sources compared`
                      : ""}
                  </p>
                  {cpiSelection.reason != null && (
                    <p className="mt-2 text-xs leading-relaxed text-[var(--text-muted)]">
                      {String(cpiSelection.reason)}
                    </p>
                  )}
                </div>
              )}

              {resolvedIndicators.length > 0 && (
                <div className="lg:col-span-2 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-6">
                  <h2 className="text-lg font-medium text-[var(--text-primary)]">
                    Indicator Sources
                  </h2>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    Live API data is auto-synced and preferred. Manual or estimated values are
                    only used when no API has the indicator.
                    {dataSelection?.api_coverage_pct != null && (
                      <> API coverage: {Number(dataSelection.api_coverage_pct).toFixed(0)}%.</>
                    )}
                  </p>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {resolvedIndicators.slice(0, 12).map(([key, sel]) => (
                      <div
                        key={key}
                        className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border-primary)] px-3 py-2 text-sm"
                      >
                        <span className="text-[var(--text-muted)]">
                          {key.replace(/_/g, " ")}
                        </span>
                        <span className="text-right text-[var(--text-primary)]">
                          {typeof sel.value === "number"
                            ? Number(sel.value).toLocaleString(undefined, { maximumFractionDigits: 2 })
                            : String(sel.value)}
                          <span className={`ml-2 text-xs ${sel.data_tier === "api" ? "text-emerald-300/80" : "text-amber-200/80"}`}>
                            {sel.data_tier === "api" ? "API · " : "Fallback · "}
                            {String(sel.source_label ?? sel.source ?? "")}
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {recommendations && recommendations.length > 0 && (
              <div className="lg:col-span-2 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-6">
                <h2 className="text-lg font-medium text-[var(--text-primary)]">Recommendations</h2>
                <ul className="mt-4 space-y-3">
                  {recommendations.map((rec, i) => (
                    <li key={i} className="flex gap-3 text-sm text-[var(--text-secondary)]">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--text-muted)]" />
                      <span>{String(rec.message)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {tab === "changes" && (
          <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-6">
            <h2 className="text-lg font-medium text-[var(--text-primary)]">What Changed Since Last Forecast</h2>
            {changes?.forecast_delta != null && (
              <p className="mt-2 text-sm text-[var(--text-muted)]">
                Forecast delta: <span className={sentimentTextClass(Number(changes.forecast_delta) > 0 ? "negative" : "positive")}>
                  {Number(changes.forecast_delta) > 0 ? "+" : ""}{Number(changes.forecast_delta).toFixed(2)}%
                </span>
              </p>
            )}
            <div className="mt-6 space-y-3">
              {((changes?.changes as Array<Record<string, unknown>>) ?? []).length === 0 ? (
                <p className="text-sm text-[var(--text-muted)]">No significant indicator changes detected.</p>
              ) : (
                ((changes?.changes as Array<Record<string, unknown>>) ?? []).map((ch, i) => (
                  <div
                    key={i}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border-primary)] px-4 py-3"
                  >
                    <span className="font-medium text-[var(--text-primary)]">{String(ch.label)}</span>
                    <span className="text-sm text-[var(--text-muted)]">
                      {Number(ch.previous_value).toFixed(2)} → {Number(ch.current_value).toFixed(2)}
                    </span>
                    <span className={sentimentTextClass(Number(ch.change_pct) > 0 ? "negative" : "positive")}>
                      {Number(ch.change_pct) > 0 ? "+" : ""}{Number(ch.change_pct).toFixed(1)}%
                    </span>
                    <span className="text-xs text-[var(--text-muted)]">
                      Expected inflation: {Number(ch.impact_on_inflation_pct) > 0 ? "+" : ""}{Number(ch.impact_on_inflation_pct).toFixed(1)}%
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {tab === "warnings" && (
          <div className="space-y-4">
            <div className="flex gap-4">
              {(["red", "yellow", "green"] as const).map((sev) => (
                <div key={sev} className={`rounded-lg border px-4 py-2 text-sm capitalize ${SEVERITY_CLASS[sev]}`}>
                  {sev}: {warnings?.summary?.[sev] ?? 0}
                </div>
              ))}
            </div>
            <div className="space-y-3">
              {(warnings?.warnings ?? []).map((w, i) => (
                <div
                  key={i}
                  className={`rounded-xl border p-4 ${SEVERITY_CLASS[String(w.severity)] ?? SEVERITY_CLASS.green}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{String(w.title)}</span>
                    <CountryLabel code={String(w.country_code)} />
                  </div>
                  <p className="mt-2 text-sm opacity-90">{String(w.message)}</p>
                  <p className="mt-1 text-xs opacity-70">{String(w.explanation)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "similarity" && (
          <div>
            {(similar?.similar ?? []).length === 0 ? (
              <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-8 text-center">
                <p className="text-sm text-[var(--text-muted)]">
                  No similar economies found yet. Run a forecast or sync economic data for richer comparisons.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {(similar?.similar ?? []).map((s, i) => (
                  <div key={i} className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-5">
                    <CountryLabel code={String(s.country_code)} />
                    <p className="mt-3 text-2xl font-semibold text-[var(--text-primary)]">
                      {Number(s.similarity_pct).toFixed(0)}%
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">similarity</p>
                    <p className="mt-3 text-xs text-[var(--text-muted)]">
                      {(s.common_indicators as string[])?.slice(0, 4).join(", ")}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "archive" && (
          <div className="space-y-6">
            {archiveTrend.length > 0 && (
              <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-6">
                <h2 className="mb-4 text-lg font-medium">Forecast Trend</h2>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={archiveTrend}>
                    <CartesianGrid stroke={chartGridStroke} strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={chartAxisTick} axisLine={chartAxisLine} tickFormatter={(v) => String(v).slice(0, 10)} />
                    <YAxis tick={chartAxisTick} axisLine={chartAxisLine} />
                    <Tooltip {...chartTooltipProps} />
                    <Line type="monotone" dataKey="inflation_rate" stroke="var(--text-primary)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-6">
              <h2 className="text-lg font-medium">Historical Forecasts</h2>
              <div className="mt-4 space-y-2">
                {((archive?.archives as Array<Record<string, unknown>>) ?? []).length === 0 ? (
                  <p className="text-sm text-[var(--text-muted)]">
                    No archived forecasts yet. Generate a prediction to start building history.
                  </p>
                ) : (
                  ((archive?.archives as Array<Record<string, unknown>>) ?? []).map((a, i) => (
                    <div key={i} className="flex justify-between border-b border-[var(--border-primary)] py-2 text-sm">
                      <span className="text-[var(--text-muted)]">{String(a.archived_at).slice(0, 10)}</span>
                      <span className="text-[var(--text-primary)]">{Number(a.inflation_rate).toFixed(2)}%</span>
                      <span className="text-[var(--text-muted)]">Rel: {a.reliability_score != null ? Number(a.reliability_score).toFixed(0) : "—"}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {tab === "map" && (
          <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-6">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <div className="flex flex-wrap gap-2">
                {["inflation_level", "deflation_risk", "economic_health", "currency_strength"].map((ind) => (
                  <button
                    key={ind}
                    type="button"
                    onClick={() => setMapIndicator(ind)}
                    className={`rounded-lg px-3 py-1.5 text-xs capitalize ${
                      mapIndicator === ind
                        ? "bg-[var(--bg-primary)] text-[var(--text-primary)]"
                        : "text-[var(--text-muted)]"
                    }`}
                  >
                    {ind.replace(/_/g, " ")}
                  </button>
                ))}
              </div>
              <select
                value={mapContinent}
                onChange={(e) => setMapContinent(e.target.value)}
                className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] px-3 py-1.5 text-xs text-[var(--text-primary)]"
              >
                <option value="">All continents</option>
                {["Africa", "Asia", "Europe", "North America", "South America", "Oceania"].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              {mapData && (
                <span className="text-xs text-[var(--text-muted)]">
                  {Number(mapData.total)} countries
                  {mapData.live_data_count != null && ` · ${Number(mapData.live_data_count)} with live data`}
                </span>
              )}
            </div>
            {mapLoading ? (
              <div className="flex min-h-[200px] items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-[var(--text-muted)]" />
              </div>
            ) : mapError ? (
              <PageLoadError title="Failed to load global map" onRetry={() => void loadMap()} />
            ) : (
              <div className="grid max-h-[480px] gap-1 overflow-y-auto sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {((mapData?.countries as Array<Record<string, unknown>>) ?? []).map((c) => {
                  const intensity = Number(c.color_intensity ?? 0);
                  const opacity = Math.min(1, Math.max(0.12, intensity / 100));
                  return (
                    <div
                      key={String(c.country_code)}
                      className="rounded-lg border border-[var(--border-primary)] p-3"
                      style={{ backgroundColor: `rgba(255,255,255,${opacity * 0.08})` }}
                    >
                      <CountryLabel code={String(c.country_code)} />
                      <p className="mt-1 text-sm font-medium">{Number(c.value).toFixed(1)}</p>
                      {!c.has_live_data && (
                        <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">estimated</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {tab === "backtest" && analystMode && backtestLoading && (
          <div className="flex min-h-[200px] items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-[var(--text-muted)]" />
          </div>
        )}
        {tab === "backtest" && analystMode && !backtestLoading && backtest && (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {Object.entries((backtest.metrics as Record<string, number>) ?? {}).map(([k, v]) => (
                <div key={k} className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-4">
                  <p className="text-xs uppercase text-[var(--text-muted)]">{k.replace(/_/g, " ")}</p>
                  <p className="mt-1 text-xl font-semibold">{typeof v === "number" ? v.toFixed(2) : v}</p>
                </div>
              ))}
            </div>
            <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-6">
              <h2 className="mb-4 text-lg font-medium">Error Distribution</h2>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart
                  data={((backtest.error_distribution as Record<string, unknown>)?.bins as string[] ?? []).map(
                    (bin, i) => ({
                      bin,
                      count: ((backtest.error_distribution as Record<string, number[]>)?.counts ?? [])[i] ?? 0,
                    }),
                  )}
                >
                  <CartesianGrid stroke={chartGridStroke} strokeDasharray="3 3" />
                  <XAxis dataKey="bin" tick={chartAxisTick} axisLine={chartAxisLine} />
                  <YAxis tick={chartAxisTick} axisLine={chartAxisLine} />
                  <Tooltip {...chartTooltipProps} />
                  <Bar dataKey="count" fill="var(--text-muted)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {tab === "nlq" && (
          <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-6">
            <h2 className="text-lg font-medium text-[var(--text-primary)]">Natural Language Query</h2>
            <div className="mt-4 flex gap-2">
              <input
                type="text"
                value={nlqQuestion}
                onChange={(e) => setNlqQuestion(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void askNlq()}
                placeholder={`Why is inflation changing in ${getCountryMeta(countryCode).name}?`}
                className="flex-1 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] px-4 py-2 text-sm text-[var(--text-primary)]"
              />
              <button
                type="button"
                onClick={() => void askNlq()}
                disabled={nlqLoading}
                className="rounded-lg border border-[var(--border-primary)] px-4 py-2 text-sm hover:bg-[var(--bg-primary)]"
              >
                {nlqLoading ? "..." : "Ask"}
              </button>
            </div>
            {nlqAnswer && (
              <div className="mt-6 rounded-lg border border-[var(--border-primary)] p-4">
                <p className="text-sm leading-relaxed text-[var(--text-secondary)]">{String(nlqAnswer.answer)}</p>
                <p className="mt-2 text-xs text-[var(--text-muted)]">
                  Sources: {(nlqAnswer.sources as string[])?.join(", ")}
                </p>
              </div>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              {[
                `Why is inflation increasing in ${getCountryMeta(countryCode).name}?`,
                "What caused the latest prediction?",
                "How does oil price affect inflation?",
                `What countries are similar to ${getCountryMeta(countryCode).name}?`,
              ].map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => { setNlqQuestion(q); }}
                  className="rounded-full border border-[var(--border-primary)] px-3 py-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}