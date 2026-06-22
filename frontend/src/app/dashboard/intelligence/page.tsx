"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Sparkles,
  Calendar,
  Newspaper,
  Shield,
  Activity,
  Loader2,
  TrendingUp,
  BarChart3,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { chartTooltipProps } from "@/components/charts/ChartTooltip";
import { intelligenceAPI } from "@/lib/api";
import { sentimentTextClass } from "@/lib/financialColors";
import { chartAxisLine, chartAxisTick, chartGridStroke } from "@/lib/chartTheme";
import CountryFocusBar, { useActiveCountryCode } from "@/components/dashboard/CountryFocusBar";
import { CountryLabel } from "@/components/ui/CountryFlag";

type Tab = "overview" | "events" | "news" | "risk" | "indicators";

export default function IntelligencePage() {
  const countryCode = useActiveCountryCode();
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState<Record<string, unknown> | null>(null);
  const [sentiment, setSentiment] = useState<Record<string, unknown> | null>(null);
  const [timeline, setTimeline] = useState<Array<Record<string, unknown>>>([]);
  const [news, setNews] = useState<Array<Record<string, unknown>>>([]);
  const [risk, setRisk] = useState<Record<string, unknown> | null>(null);
  const [indicators, setIndicators] = useState<Array<Record<string, unknown>>>([]);
  const [multiHorizon, setMultiHorizon] = useState<Array<Record<string, unknown>>>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [h, s, t, n, r, ind, mh] = await Promise.all([
        intelligenceAPI.getEconomicHealth(countryCode),
        intelligenceAPI.getSentiment(countryCode),
        intelligenceAPI.getEventTimeline(countryCode),
        intelligenceAPI.getNews({ country_code: countryCode, limit: 10 }),
        intelligenceAPI.getCountryRisk(countryCode),
        intelligenceAPI.getAdvancedIndicators(countryCode),
        intelligenceAPI.getMultiHorizon(countryCode),
      ]);
      setHealth(h.data);
      setSentiment(s.data);
      setTimeline(Array.isArray(t.data) ? t.data : []);
      setNews(Array.isArray(n.data) ? n.data : []);
      setRisk(r.data);
      setIndicators(Array.isArray(ind.data) ? ind.data : []);
      setMultiHorizon(
        Array.isArray(mh.data?.horizons) ? mh.data.horizons : [],
      );
    } catch {
      /* partial load ok */
    } finally {
      setLoading(false);
    }
  }, [countryCode]);

  useEffect(() => {
    void load();
  }, [load]);

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "overview", label: "Overview", icon: Sparkles },
    { id: "events", label: "Events", icon: Calendar },
    { id: "news", label: "News", icon: Newspaper },
    { id: "risk", label: "Risk", icon: Shield },
    { id: "indicators", label: "Indicators", icon: BarChart3 },
  ];

  const horizonChart = multiHorizon.map((h) => ({
    label: `${h.horizon_months}M`,
    expected: h.expected_case,
    best: h.best_case,
    worst: h.worst_case,
  }));

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--text-muted)]" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">
          Economic Intelligence Center
        </h1>
        <p className="text-sm text-[var(--text-muted)]">
          TS-Transformer powered insights for{" "}
          <CountryLabel code={countryCode} />
        </p>
      </div>

      <CountryFocusBar label="Analysis focus" />

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm transition ${
              tab === t.id
                ? "bg-[var(--accent-faint)] text-[var(--text-primary)] border border-[var(--border-hover)]"
                : "text-[var(--text-muted)] hover:bg-[var(--glass-bg)]"
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="glass-card rounded-xl hover:transform-none p-5">
              <p className="text-xs text-[var(--text-muted)]">Economic Health Index</p>
              <p className="mt-1 text-3xl font-bold text-[var(--text-primary)]">
                {String(health?.score ?? "—")}
                <span className="text-base font-normal text-[var(--text-muted)]">/100</span>
              </p>
              <p className={`mt-1 text-sm ${sentimentTextClass("info")}`}>
                {String(health?.label ?? "—")}
              </p>
            </div>
            <div className="glass-card rounded-xl hover:transform-none p-5">
              <p className="text-xs text-[var(--text-muted)]">Sentiment</p>
              <p className="mt-1 text-lg font-semibold capitalize text-[var(--text-primary)]">
                {String(sentiment?.dominant ?? "—")}
              </p>
              <p className="mt-2 text-xs text-[var(--text-muted)]">
                +{((sentiment?.positive as number) * 100 || 0).toFixed(0)}% / −
                {((sentiment?.negative as number) * 100 || 0).toFixed(0)}%
              </p>
            </div>
            <div className="glass-card rounded-xl hover:transform-none p-5">
              <p className="text-xs text-[var(--text-muted)]">Overall Risk</p>
              <p className="mt-1 text-lg font-semibold text-[var(--text-primary)]">
                {String(risk?.overall_risk_label ?? "—")}
              </p>
              <p className="mt-2 text-xs text-[var(--text-muted)] line-clamp-2">
                {String(risk?.ai_summary ?? "")}
              </p>
            </div>
          </div>

          {horizonChart.length > 0 && (
            <div className="glass-card rounded-xl hover:transform-none p-5">
              <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
                <TrendingUp className="h-4 w-4" /> Multi-Horizon Forecast Bands
              </h2>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={horizonChart}>
                  <CartesianGrid stroke={chartGridStroke} strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={chartAxisTick} axisLine={chartAxisLine} />
                  <YAxis tick={chartAxisTick} axisLine={chartAxisLine} unit="%" />
                  <Tooltip {...chartTooltipProps} />
                  <Legend />
                  <Line type="monotone" dataKey="best" stroke="var(--fin-positive)" name="Best Case" dot={false} />
                  <Line type="monotone" dataKey="expected" stroke="var(--text-primary)" name="Expected" strokeWidth={2} />
                  <Line type="monotone" dataKey="worst" stroke="var(--fin-negative)" name="Worst Case" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="glass-card rounded-xl hover:transform-none p-5">
            <h2 className="mb-2 text-sm font-semibold">AI Health Summary</h2>
            <p className="text-sm text-[var(--text-secondary)]">
              {String(health?.ai_summary ?? "No summary available.")}
            </p>
          </div>
        </motion.div>
      )}

      {tab === "events" && (
        <div className="space-y-3">
          {timeline.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">No events in timeline.</p>
          ) : (
            timeline.map((e) => (
              <div
                key={String(e.id)}
                className="glass-card rounded-xl hover:transform-none p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-[var(--text-primary)]">{String(e.title)}</p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      {String(e.category).replace(/_/g, " ")} · {String(e.event_date)}
                    </p>
                    <p className="mt-2 text-sm text-[var(--text-secondary)]">{String(e.description)}</p>
                  </div>
                  <div className="text-right text-xs">
                    <p className={sentimentTextClass("caution")}>
                      Severity {String(e.severity_score)}
                    </p>
                    <p className={sentimentTextClass("negative")}>
                      Impact {String(e.economic_impact_score)}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === "news" && (
        <div className="space-y-3">
          {news.map((n) => (
            <div
              key={String(n.id)}
              className="glass-card rounded-xl hover:transform-none p-4"
            >
              <p className="font-medium text-[var(--text-primary)]">{String(n.title)}</p>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
                {n.country_code ? (
                  <CountryLabel code={String(n.country_code)} flagSize="xs" />
                ) : null}
                <span>
                  {String(n.source)} · {String(n.category)}
                </span>
              </p>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">{String(n.summary)}</p>
            </div>
          ))}
        </div>
      )}

      {tab === "risk" && risk && (
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            ["Inflation Risk", risk.inflation_risk, "negative"],
            ["Deflation Risk", risk.deflation_risk, "caution"],
            ["Economic Stability", risk.economic_stability, "positive"],
            ["Currency Risk", risk.currency_risk, "negative"],
            ["Investment Risk", risk.investment_risk, "caution"],
          ].map(([label, val, sent]) => (
            <div
              key={String(label)}
              className="glass-card rounded-xl hover:transform-none p-4"
            >
              <p className="text-xs text-[var(--text-muted)]">{String(label)}</p>
              <p className={`mt-1 text-2xl font-bold ${sentimentTextClass(sent as "positive" | "negative" | "caution")}`}>
                {String(val)}/100
              </p>
            </div>
          ))}
          <div className="sm:col-span-2 glass-card rounded-xl hover:transform-none p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Activity className="h-4 w-4" /> Risk Factors
            </h3>
            <ul className="mt-2 list-inside list-disc text-sm text-[var(--text-secondary)]">
              {(risk.factors as string[] | undefined)?.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {tab === "indicators" && (
        <div className="overflow-x-auto rounded-xl border border-[var(--border-primary)]">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border-primary)] bg-[var(--glass-bg)]">
                <th className="px-4 py-3">Indicator</th>
                <th className="px-4 py-3">Current</th>
                <th className="px-4 py-3">Previous</th>
                <th className="px-4 py-3">Trend</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Updated</th>
              </tr>
            </thead>
            <tbody>
              {indicators.map((ind) => (
                <tr key={String(ind.key)} className="border-b border-[var(--border-primary)]">
                  <td className="px-4 py-3 font-medium">{String(ind.label)}</td>
                  <td className="px-4 py-3">
                    {ind.available ? `${ind.value} ${ind.suffix}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-[var(--text-muted)]">
                    {ind.previous_value != null ? String(ind.previous_value) : "—"}
                  </td>
                  <td className={`px-4 py-3 capitalize ${sentimentTextClass(
                    ind.trend_direction === "up" ? "negative" : ind.trend_direction === "down" ? "positive" : "neutral"
                  )}`}>
                    {String(ind.trend_direction)}
                  </td>
                  <td className="px-4 py-3 text-[var(--text-muted)]">{String(ind.source ?? "—")}</td>
                  <td className="px-4 py-3 text-[var(--text-muted)]">{String(ind.last_updated ?? "—")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}