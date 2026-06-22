"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Loader2,
  TrendingUp,
  Shield,
  Sparkles,
  Calendar,
  Bell,
  FileText,
  Globe,
  PiggyBank,
} from "lucide-react";
import LiveDateTime from "@/components/dashboard/LiveDateTime";
import CountryFocusBar, { useActiveCountryCode } from "@/components/dashboard/CountryFocusBar";
import { CountryLabel } from "@/components/ui/CountryFlag";
import EconomicAssistant from "@/components/dashboard/EconomicAssistant";
import UserEconomicCharts from "@/components/dashboard/UserEconomicCharts";
import { useAuthStore } from "@/store/authStore";
import { dashboardAPI, type UserInsights } from "@/lib/api";
import { getPersonalizedGreeting } from "@/lib/greeting";
import { HEALTH_LABELS, PERSONAL_IMPACT_TOPICS } from "@/lib/plainLanguage";
import { getCountryMeta } from "@/lib/countries";
import EmptyState from "@/components/ui/EmptyState";
import { formatDate } from "@/lib/dates";

const COST_ICONS: Record<string, string> = {
  food: "🛒",
  housing: "🏠",
  transportation: "🚌",
  utilities: "💡",
  fuel: "⛽",
};

const TREND_COLORS: Record<string, string> = {
  Increasing: "#ef4444",
  Decreasing: "#22c55e",
  Stable: "#eab308",
};

export default function OrdinaryOverview() {
  const user = useAuthStore((s) => s.user);
  const countryCode = useActiveCountryCode();
  const [insights, setInsights] = useState<UserInsights | null>(null);
  const [briefing, setBriefing] = useState<{ greeting: string; body: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [insightsRes, briefingRes] = await Promise.all([
        dashboardAPI.getUserInsights(countryCode),
        dashboardAPI.getBriefing("morning", countryCode),
      ]);
      setInsights(insightsRes.data);
      setBriefing(briefingRes.data as { greeting: string; body: string });
    } catch {
      setInsights(null);
      setBriefing(null);
    } finally {
      setLoading(false);
    }
  }, [countryCode]);

  useEffect(() => {
    void load();
  }, [load]);

  const countryMeta = getCountryMeta(countryCode);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--text-muted)]" />
      </div>
    );
  }

  if (!insights) {
    return (
      <EmptyState
        icon={Sparkles}
        title="Your economic snapshot is loading"
        description="Once predictions are available for your country, you'll see a simple summary here."
        action={
          <button type="button" onClick={() => void load()} className="btn-primary px-4 py-2 text-sm">
            Retry
          </button>
        }
      />
    );
  }

  const summary = insights.todays_summary;
  const healthKey = summary.economic_health.toLowerCase() as keyof typeof HEALTH_LABELS;
  const healthInfo = HEALTH_LABELS[healthKey] ?? HEALTH_LABELS.moderate;
  const pricesRising = summary.inflation_trend === "up" || (summary.inflation_rate ?? 0) > 5;
  const quick = insights.quick_forecasts;

  return (
    <div className="space-y-6">
      <CountryFocusBar label="Your country focus" />

      {/* Daily briefing */}
      <section className="glass-panel rounded-2xl p-6 border-l-4" style={{ borderLeftColor: healthInfo.color }}>
        <p className="text-xs font-semibold uppercase tracking-widest text-[var(--text-faint)]">
          Daily AI Briefing
        </p>
        <h1 className="mt-2 text-2xl font-bold text-[var(--text-primary)]">
          {briefing?.greeting ?? getPersonalizedGreeting(user?.full_name)}
        </h1>
        <div className="mt-2 text-sm text-[var(--text-muted)]">
          {insights.server_time && (
            <LiveDateTime initial={insights.server_time} />
          )}
        </div>
        <div className="mt-3">
          <CountryLabel
            code={countryCode}
            name={countryMeta.name}
            flagSize="md"
            nameClassName="text-base font-medium"
          />
        </div>
        <p className="mt-4 text-sm leading-relaxed text-[var(--text-secondary)]">
          {briefing?.body ?? summary.ai_summary}
        </p>
      </section>

      {/* Today's Economic Summary */}
      <section className="glass-panel rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">Today&apos;s Economic Summary</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            { label: "Economic Health", value: summary.economic_health, color: healthInfo.color },
            { label: "Inflation Trend", value: summary.inflation_trend, color: TREND_COLORS.Increasing },
            {
              label: "Deflation Risk",
              value: summary.deflation_risk != null ? `${Number(summary.deflation_risk).toFixed(1)}%` : "—",
              color: SENTIMENT_COLOR(summary.deflation_risk),
            },
            { label: "Currency", value: summary.currency_trend ?? "stable", color: TREND_COLORS.Stable },
            { label: "AI Summary", value: "Updated", color: healthInfo.color },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-[var(--border-primary)] p-3"
            >
              <p className="text-xs text-[var(--text-faint)]">{item.label}</p>
              <p className="mt-1 text-sm font-semibold capitalize" style={{ color: item.color }}>
                {item.value}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm text-[var(--text-muted)]">{summary.ai_summary}</p>
      </section>

      {/* Quick forecast cards */}
      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: "Current Situation", value: String(quick.current_situation), icon: TrendingUp },
          { label: "Expected Trend", value: String(quick.expected_trend), icon: Sparkles },
          { label: "Risk Level", value: String(quick.risk_level), icon: Shield },
          { label: "Confidence", value: `${quick.confidence}%`, icon: Sparkles },
        ].map((card) => (
          <motion.div key={card.label} className="glass-panel rounded-2xl p-5">
            <card.icon className="mb-2 h-5 w-5" />
            <p className="text-xs text-[var(--text-faint)]">{card.label}</p>
            <p className="mt-1 text-sm font-medium">{card.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Cost of Living Monitor */}
      <section className="glass-panel rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">Cost of Living Monitor</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {Object.entries(insights.cost_of_living).map(([key, trend]) => (
            <div key={key} className="rounded-xl border border-[var(--border-primary)] p-4 text-center">
              <span className="text-2xl">{COST_ICONS[key] ?? "📊"}</span>
              <p className="mt-2 text-sm font-medium capitalize">{key}</p>
              <p
                className="mt-1 text-xs font-semibold"
                style={{ color: TREND_COLORS[trend] ?? TREND_COLORS.Stable }}
              >
                {trend}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Savings Advisor */}
      <section className="glass-panel rounded-2xl p-6">
        <div className="flex items-center gap-2">
          <PiggyBank className="h-5 w-5" />
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Savings Advisor</h2>
        </div>
        <ul className="mt-4 space-y-2">
          {insights.savings_advisor.map((tip, i) => (
            <li
              key={i}
              className="rounded-lg border border-[var(--border-primary)] px-4 py-3 text-sm text-[var(--text-muted)]"
            >
              {tip}
            </li>
          ))}
        </ul>
      </section>

      <UserEconomicCharts charts={insights.charts} gauges={insights.gauges} />

      <EconomicAssistant
        context={{
          countryName: insights.country_name,
          inflationRate: summary.inflation_rate,
          trend: summary.inflation_trend,
          riskLevel: String(quick.risk_level),
          confidence: Number(quick.confidence),
          aiSummary: summary.ai_summary,
        }}
      />

      {/* Personal Impact */}
      <section className="glass-panel rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">How does this affect you?</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PERSONAL_IMPACT_TOPICS.map((topic) => (
            <div key={topic.key} className="flex gap-3 rounded-xl border border-[var(--border-primary)] p-4">
              <span className="text-2xl">{topic.icon}</span>
              <div>
                <p className="text-sm font-medium">{topic.title}</p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  {topic.template(pricesRising)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Utilities row */}
      <div className="grid gap-4 lg:grid-cols-3">
        <section className="glass-panel rounded-2xl p-5">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <h3 className="font-semibold">Economic Calendar</h3>
          </div>
          <ul className="mt-3 space-y-2">
            {insights.recent_events.length === 0 ? (
              <li className="text-sm text-[var(--text-muted)]">No upcoming events tracked.</li>
            ) : (
              insights.recent_events.map((ev, i) => (
                <li key={i} className="text-xs text-[var(--text-muted)]">
                  <span className="font-medium text-[var(--text-primary)]">{ev.title}</span>
                  <br />
                  {formatDate(ev.date)} · {ev.category}
                </li>
              ))
            )}
          </ul>
          <Link href="/dashboard/news" className="mt-3 inline-block text-xs text-[var(--accent)] hover:underline">
            View all news →
          </Link>
        </section>

        <section className="glass-panel rounded-2xl p-5">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            <h3 className="font-semibold">Watchlist</h3>
          </div>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Tracking {insights.tracked_countries?.length ?? 0} countries besides your home market.
          </p>
          <Link href="/dashboard/countries" className="mt-3 inline-block text-xs text-[var(--accent)] hover:underline">
            Manage countries →
          </Link>
        </section>

        <section className="glass-panel rounded-2xl p-5">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <h3 className="font-semibold">Weekly Summary</h3>
          </div>
          <p className="mt-2 text-sm text-[var(--text-muted)]">{insights.weekly_summary}</p>
          <Link href="/dashboard/reports" className="mt-3 inline-block text-xs text-[var(--accent)] hover:underline">
            Generate full report →
          </Link>
        </section>
      </div>

      <section className="glass-panel rounded-2xl p-5">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4" />
          <h3 className="font-semibold">AI Recommendations</h3>
        </div>
        <ul className="mt-3 space-y-2">
          {insights.ai_recommendations.map((rec, i) => (
            <li key={i} className="text-sm text-[var(--text-muted)]">
              • {rec}
            </li>
          ))}
        </ul>
        <Link href="/dashboard/notifications" className="mt-3 inline-block text-xs text-[var(--accent)] hover:underline">
          Notification settings →
        </Link>
      </section>
    </div>
  );
}

function SENTIMENT_COLOR(value: number | null | undefined): string {
  if (value == null) return TREND_COLORS.Stable;
  if (value > 15) return TREND_COLORS.Increasing;
  if (value < 5) return TREND_COLORS.Decreasing;
  return TREND_COLORS.Stable;
}