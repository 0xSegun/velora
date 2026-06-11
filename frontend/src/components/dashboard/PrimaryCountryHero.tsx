'use client';

import { motion } from 'framer-motion';
import { TrendingUp, Brain, Shield } from 'lucide-react';
import { CountryLabel } from '@/components/ui/CountryFlag';
import CurrencyDisplay from '@/components/ui/CurrencyDisplay';
import TrendIndicator from '@/components/ui/TrendIndicator';
import FinancialKpiCard from '@/components/ui/FinancialKpiCard';
import type { DashboardCountryCard } from '@/lib/api';
import {
  confidenceSentiment,
  gdpSentiment,
  inflationSentiment,
  riskSentiment,
  sentimentClass,
} from '@/lib/financialColors';
import { formatCurrencyLabel } from '@/lib/currency';

function formatVal(v: number | null | undefined, suffix = '%') {
  if (v == null || Number.isNaN(v)) return '—';
  return `${v.toFixed(2)}${suffix}`;
}

export default function PrimaryCountryHero({ country }: { country: DashboardCountryCard }) {
  const m = country.metrics;
  const pred = country.prediction;
  const confPct =
    pred?.confidence_score != null
      ? pred.confidence_score <= 1
        ? pred.confidence_score * 100
        : pred.confidence_score
      : null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl border border-[var(--border-active)] bg-[var(--glass-bg)] p-6 shadow-[0_0_40px_rgba(255,255,255,0.03)] lg:p-8"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent-faint)] via-transparent to-transparent pointer-events-none" />

      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <CountryLabel
            code={country.code}
            name={country.name}
            flagSize="lg"
            nameClassName="text-2xl font-bold text-[var(--text-primary)]"
          />
          {country.location && (
            <p className="text-sm text-[var(--text-muted)]">{country.location}</p>
          )}
          <div className="text-xs text-[var(--text-muted)]">
            <p>Currency: {formatCurrencyLabel(country.code, country.currency)}</p>
          </div>
          {m.data_source && m.last_updated && (
            <p className="text-[10px]" style={{ color: sentimentClass('info') }}>
              Source: {m.data_source} · Updated {m.last_updated}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3">
          <FinancialKpiCard
            label="Inflation Rate"
            value={formatVal(m.inflation_rate)}
            sentiment={inflationSentiment(m.inflation_rate)}
            status={
              m.inflation_rate != null
                ? m.inflation_rate <= 5
                  ? 'Healthy'
                  : m.inflation_rate <= 10
                    ? 'Elevated'
                    : 'High'
                : undefined
            }
          />
          <FinancialKpiCard
            label="Deflation Risk"
            value={formatVal(m.deflation_risk)}
            sentiment={m.deflation_risk != null && m.deflation_risk > 30 ? 'negative' : 'positive'}
          />
          <FinancialKpiCard
            label="GDP Growth"
            value={formatVal(m.gdp_growth)}
            sentiment={gdpSentiment(m.gdp_growth)}
          />
          <FinancialKpiCard
            label="Interest Rate"
            value={formatVal(m.interest_rate)}
            sentiment="info"
          />
          <div className="glass-card rounded-xl hover:transform-none p-4">
            <p className="text-xs text-[var(--text-muted)]">Exchange Rate</p>
            <div className="mt-1">
              <CurrencyDisplay
                countryCode={country.code}
                rate={m.exchange_rate_detail?.rate ?? m.exchange_rate}
                currencyCode={m.exchange_rate_detail?.currency_code ?? country.currency}
                variant="block"
                isStale={m.exchange_rate_detail?.is_stale}
                staleMessage={m.exchange_rate_detail?.stale_message}
                change24h={m.exchange_rate_detail?.change_24h}
                change7d={m.exchange_rate_detail?.change_7d}
                trend={m.exchange_rate_detail?.trend}
              />
            </div>
          </div>
          <FinancialKpiCard
            label="Stability Score"
            value={formatVal(m.economic_stability_score, '')}
            sentiment={
              m.economic_stability_score != null && m.economic_stability_score >= 70
                ? 'positive'
                : m.economic_stability_score != null && m.economic_stability_score < 50
                  ? 'negative'
                  : 'caution'
            }
          />
        </div>
      </div>

      <div className="relative mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--accent-faint)]/40 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
            <TrendingUp className="h-4 w-4" />
            Inflation Forecast
          </div>
          {pred ? (
            <div className="space-y-2">
              <p
                className="text-2xl font-bold"
                style={{ color: sentimentClass(inflationSentiment(pred.inflation_rate)) }}
              >
                {formatVal(pred.inflation_rate)}
              </p>
              <TrendIndicator direction={pred.trend_direction} invert />
              <p className="text-xs text-[var(--text-muted)]">
                {pred.forecast_horizon}mo horizon ·{' '}
                <span style={{ color: sentimentClass(confidenceSentiment(confPct)) }}>
                  {confPct != null ? `${confPct.toFixed(1)}% confidence` : '—'}
                </span>
              </p>
            </div>
          ) : (
            <p className="text-sm text-[var(--text-muted)]">
              Latest official data not currently available. Run a prediction to generate a forecast.
            </p>
          )}
        </div>

        <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--accent-faint)]/40 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
            <Brain className="h-4 w-4" />
            AI Economic Summary
          </div>
          <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
            {pred?.ai_summary ?? country.ai_insights.summary}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <TrendIndicator
              direction={pred?.trend_direction ?? (m.inflation_rate != null ? 'stable' : undefined)}
              invert
            />
            {pred?.risk_level && (
              <span
                className="inline-flex items-center gap-1 text-xs"
                style={{ color: sentimentClass(riskSentiment(pred.risk_level)) }}
              >
                <Shield className="h-3 w-3" />
                {pred.risk_level} risk
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.section>
  );
}