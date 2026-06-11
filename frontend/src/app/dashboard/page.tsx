'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Loader2,
  FileText,
  Calendar,
  BarChart3,
  Target,
} from 'lucide-react';
import FinancialKpiCard from '@/components/ui/FinancialKpiCard';
import TrendIndicator from '@/components/ui/TrendIndicator';
import CurrencyDisplay from '@/components/ui/CurrencyDisplay';
import {
  confidenceSentiment,
  gdpSentiment,
  inflationSentiment,
  sentimentClass,
} from '@/lib/financialColors';
import GlowCard from '@/components/ui/GlowCard';
import EmptyState from '@/components/ui/EmptyState';
import { CountryLabel } from '@/components/ui/CountryFlag';
import LiveDateTime from '@/components/dashboard/LiveDateTime';
import PrimaryCountryHero from '@/components/dashboard/PrimaryCountryHero';
import TrackedCountriesPanel from '@/components/dashboard/TrackedCountriesPanel';
import EconomicHealthSummary from '@/components/dashboard/EconomicHealthSummary';
import AIInsightsPanel from '@/components/dashboard/AIInsightsPanel';
import CountryComparisonWidget from '@/components/dashboard/CountryComparisonWidget';
import CountryComparePanel from '@/components/dashboard/CountryComparePanel';
import QuickActionsPanel from '@/components/dashboard/QuickActionsPanel';
import { countriesAPI, dashboardAPI, economicDataAPI, reportsAPI, type DashboardOverview } from '@/lib/api';
import type { CompareCountryOption } from '@/components/dashboard/CountryComparePanel';
import { useAuthStore } from '@/store/authStore';
import { useDashboardCopy } from '@/hooks/useSiteSettings';
import { getPersonalizedGreeting } from '@/lib/greeting';
import { formatDate, formatRelative } from '@/lib/dates';
import type { Report } from '@/types/report';

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

function indicatorSentiment(key: string, value: number | null): ReturnType<typeof inflationSentiment> {
  if (value == null) return 'neutral';
  if (key.includes('inflation')) return inflationSentiment(value);
  if (key.includes('gdp')) return gdpSentiment(value);
  if (key.includes('unemployment')) return value > 6 ? 'negative' : 'positive';
  return 'info';
}

function formatIndicatorValue(
  value: number | null,
  suffix: string,
): string {
  if (value == null) return 'Latest official data not currently available.';
  return `${value.toFixed(2)}${suffix}`;
}

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const dashboardCopy = useDashboardCopy();
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [compareCountries, setCompareCountries] = useState<CompareCountryOption[]>([]);
  const [compareSelection, setCompareSelection] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [overviewRes, reportsRes, countriesRes, econRes] = await Promise.all([
        dashboardAPI.getOverview(),
        reportsAPI.list({ per_page: 3 }),
        countriesAPI.list(),
        economicDataAPI.getLatest(),
      ]);
      const overviewData = overviewRes.data;
      setOverview(overviewData);
      const reportList = reportsRes.data as { reports?: Report[] };
      setReports(reportList.reports ?? []);

      const econRecords = Array.isArray(econRes.data) ? econRes.data as Array<{
        country_code: string;
        inflation_rate?: number | null;
        gdp_growth?: number | null;
        interest_rate?: number | null;
      }> : [];
      const econByCode = new Map(econRecords.map((e) => [e.country_code, e]));
      setCompareCountries(
        countriesRes.countries.map((c) => {
          const econ = econByCode.get(c.code);
          return {
            code: c.code,
            name: c.name,
            flag: c.flag,
            inflation_rate: econ?.inflation_rate ?? c.inflation_rate,
            gdp_growth: econ?.gdp_growth ?? null,
            interest_rate: econ?.interest_rate ?? c.interest_rate,
          };
        }),
      );
      const preselected = [
        overviewData.primary_country.code,
        ...overviewData.tracked_countries.map((t) => t.code),
      ].filter((code, i, arr) => arr.indexOf(code) === i);
      setCompareSelection(preselected);
    } catch {
      setError('Unable to load dashboard data. Please try again later.');
      setOverview(null);
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const greeting = getPersonalizedGreeting(user?.full_name);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--text-muted)]" />
        <p className="text-sm text-[var(--text-muted)]">Loading economic intelligence…</p>
      </div>
    );
  }

  if (error || !overview) {
    return (
      <EmptyState
        icon={BarChart3}
        title="Dashboard unavailable"
        description={error ?? 'Could not load overview data.'}
        action={
          <button
            onClick={() => void load()}
            className="rounded-xl border border-[var(--border-hover)] bg-[var(--accent-faint)] px-4 py-2 text-sm"
          >
            Retry
          </button>
        }
      />
    );
  }

  const primary = overview.primary_country;
  const pred = primary.prediction;

  return (
    <motion.div initial="hidden" animate="show" variants={fadeUp} className="space-y-8">
      {/* SECTION 1–2: Greeting + Date/Time */}
      <motion.div variants={fadeUp} className="space-y-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-[var(--text-faint)]">{dashboardCopy.overviewTitle}</p>
          <h2 className="text-2xl font-bold text-[var(--text-primary)]">{greeting} 👋</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">{dashboardCopy.welcomeMessage || dashboardCopy.overviewSubtitle}</p>
        </div>
        <LiveDateTime initial={overview.server_time} location={overview.location} />
      </motion.div>

      {/* SECTION 3: Primary Country */}
      <motion.div variants={fadeUp}>
        <PrimaryCountryHero country={primary} />
      </motion.div>

      {/* SECTION 4: Tracked Countries */}
      <motion.div variants={fadeUp} id="tracked-countries">
        <TrackedCountriesPanel
          tracked={overview.tracked_countries}
          primaryCode={primary.code}
          maxTracked={overview.max_tracked}
          onUpdate={load}
        />
      </motion.div>

      {/* SECTION 5: Economic Health */}
      <motion.div variants={fadeUp}>
        <EconomicHealthSummary items={primary.economic_health} />
      </motion.div>

      {/* SECTION 6: AI Insights */}
      <motion.div variants={fadeUp}>
        <AIInsightsPanel insights={primary.ai_insights} />
      </motion.div>

      {/* SECTION 7: Prediction Snapshot */}
      <motion.div variants={fadeUp}>
        <GlowCard id="prediction-snapshot" className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <Target className="h-4 w-4" />
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Prediction Snapshot</h2>
          </div>
          {pred ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <FinancialKpiCard
                label="Forecast Rate"
                value={`${pred.inflation_rate.toFixed(2)}%`}
                sentiment={inflationSentiment(pred.inflation_rate)}
                status={
                  pred.inflation_rate <= 5 ? 'Healthy' : pred.inflation_rate <= 10 ? 'Elevated' : 'High'
                }
              />
              <div className="glass-card rounded-xl hover:transform-none p-4">
                <p className="text-xs text-[var(--text-muted)]">Trend</p>
                <div className="mt-2">
                  <TrendIndicator direction={pred.trend_direction} invert />
                </div>
              </div>
              <FinancialKpiCard
                label="Confidence"
                value={`${(pred.confidence_score <= 1 ? pred.confidence_score * 100 : pred.confidence_score).toFixed(1)}%`}
                sentiment={confidenceSentiment(
                  pred.confidence_score <= 1 ? pred.confidence_score * 100 : pred.confidence_score,
                )}
              />
              <FinancialKpiCard
                label="Horizon"
                value={`${pred.forecast_horizon ?? 6}mo`}
                sentiment="info"
              />
            </div>
          ) : (
            <p className="text-sm text-[var(--text-muted)]">
              No prediction for your primary country yet. Use Quick Actions to generate a forecast.
            </p>
          )}
        </GlowCard>
      </motion.div>

      {/* SECTION 8: Country Comparison */}
      <motion.div variants={fadeUp} className="space-y-4">
        <CountryComparisonWidget data={overview.comparison} />
        <CountryComparePanel
          countries={compareCountries}
          selection={compareSelection}
          onSelectionChange={setCompareSelection}
        />
      </motion.div>

      {/* SECTION 9: Recent Reports */}
      <motion.div variants={fadeUp}>
        <GlowCard id="recent-reports" className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Recent Reports</h2>
          </div>
          {reports.length > 0 ? (
            <div className="space-y-3">
              {reports.map((report) => (
                <div
                  key={report.id}
                  className="rounded-lg border border-[var(--border-primary)] bg-[var(--glass-bg)] p-3"
                >
                  <p className="text-sm font-medium text-[var(--text-primary)]">{report.title}</p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    {report.summary || 'No summary available.'}
                  </p>
                  <p className="mt-2 text-[10px] text-[var(--text-faint)]">
                    {formatDate(report.published_at)} · {formatRelative(report.published_at)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={FileText}
              title="No reports available"
              description="Synced economic reports will appear here."
            />
          )}
        </GlowCard>
      </motion.div>

      {/* SECTION 10: Recent Predictions */}
      <motion.div variants={fadeUp}>
        <GlowCard id="recent-predictions" className="p-5">
          <h2 className="mb-4 text-lg font-semibold text-[var(--text-primary)]">Recent Predictions</h2>
          {overview.recent_predictions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-primary)]">
                    {['Country', 'Rate', 'Trend', 'Confidence', 'Date'].map((h) => (
                      <th
                        key={h}
                        className="pb-2 text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {overview.recent_predictions.map((p) => {
                    const conf = p.confidence_score <= 1 ? p.confidence_score * 100 : p.confidence_score;
                    return (
                      <tr
                        key={p.id}
                        className="border-b border-[var(--border-primary)] last:border-0"
                      >
                        <td className="py-2">
                          <CountryLabel code={p.country_code} flagSize="sm" />
                        </td>
                        <td
                          className="py-2 font-medium"
                          style={{ color: sentimentClass(inflationSentiment(p.inflation_rate)) }}
                        >
                          {p.inflation_rate.toFixed(2)}%
                        </td>
                        <td className="py-2">
                          <TrendIndicator direction={p.trend_direction} invert size="sm" />
                        </td>
                        <td
                          className="py-2 font-medium"
                          style={{ color: sentimentClass(confidenceSentiment(conf)) }}
                        >
                          {conf.toFixed(0)}%
                        </td>
                        <td className="py-2 text-xs text-[var(--text-muted)]">
                          {formatDate(p.created_at)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-[var(--text-muted)]">No predictions yet.</p>
          )}
        </GlowCard>
      </motion.div>

      {/* SECTION 11: Key Economic Indicators */}
      <motion.div variants={fadeUp}>
        <GlowCard id="key-indicators" className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Key Economic Indicators</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {overview.key_indicators.map((ind) =>
              ind.key === 'exchange_rate' && ind.available ? (
                <div
                  key={ind.key}
                  className="rounded-xl border border-[var(--border-primary)] bg-[var(--accent-faint)]/40 p-4"
                >
                  <p className="text-xs text-[var(--text-muted)]">{ind.label}</p>
                  <div className="mt-1">
                    <CurrencyDisplay
                      countryCode={primary.code}
                      rate={primary.metrics?.exchange_rate_detail?.rate ?? ind.value}
                      currencyCode={
                        primary.metrics?.exchange_rate_detail?.currency_code ?? primary.currency
                      }
                      variant="block"
                      isStale={primary.metrics?.exchange_rate_detail?.is_stale}
                      staleMessage={primary.metrics?.exchange_rate_detail?.stale_message}
                      change24h={primary.metrics?.exchange_rate_detail?.change_24h}
                      change7d={primary.metrics?.exchange_rate_detail?.change_7d}
                      trend={primary.metrics?.exchange_rate_detail?.trend}
                    />
                  </div>
                  {(ind.change_7d != null || ind.previous_value != null) && (
                    <div className="mt-2">
                      <TrendIndicator
                        direction={ind.trend_direction}
                        change={ind.change_7d ?? ind.change}
                      />
                    </div>
                  )}
                  {ind.source && ind.last_updated && (
                    <p className="mt-1 text-[10px]" style={{ color: sentimentClass('info') }}>
                      Source: {ind.source} · Updated: {ind.last_updated}
                    </p>
                  )}
                </div>
              ) : (
                <FinancialKpiCard
                  key={ind.key}
                  label={ind.label}
                  value={
                    ind.available
                      ? formatIndicatorValue(ind.value, ind.suffix)
                      : (ind.unavailable_message ?? '—')
                  }
                  sentiment={ind.available ? indicatorSentiment(ind.key, ind.value) : 'neutral'}
                  trendDirection={ind.trend_direction}
                  trendChange={ind.change}
                  invertTrend={ind.key.includes('inflation') || ind.key.includes('unemployment')}
                  source={ind.source}
                  lastUpdated={ind.last_updated}
                  meta={
                    ind.available && ind.previous_value != null
                      ? `Prev: ${ind.previous_value.toFixed(2)}${ind.suffix}`
                      : undefined
                  }
                />
              ),
            )}
          </div>
        </GlowCard>
      </motion.div>

      {/* SECTION 12: Quick Actions */}
      <motion.div variants={fadeUp}>
        <QuickActionsPanel />
      </motion.div>
    </motion.div>
  );
}