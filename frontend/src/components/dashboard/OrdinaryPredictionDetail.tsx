"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Loader2,
  TrendingUp,
  TrendingDown,
  Minus,
  Shield,
  Sparkles,
  Printer,
} from "lucide-react";
import type { Prediction } from "@/types/prediction";
import { formatDateTime } from "@/lib/dates";
import { getCountryMeta } from "@/lib/countries";
import { CountryLabel } from "@/components/ui/CountryFlag";
import {
  PERSONAL_IMPACT_TOPICS,
  toSimpleForecast,
} from "@/lib/plainLanguage";
import { printPage } from "@/lib/print";
import PrintDocumentHeader from "@/components/print/PrintDocumentHeader";

function trendIcon(direction: string) {
  const d = direction.toLowerCase();
  if (d === "up") return TrendingUp;
  if (d === "down") return TrendingDown;
  return Minus;
}

interface OrdinaryPredictionDetailProps {
  prediction: Prediction | null;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export default function OrdinaryPredictionDetail({
  prediction,
  loading,
  error,
  onRetry,
}: OrdinaryPredictionDetailProps) {
  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--text-muted)]" />
      </div>
    );
  }

  if (error || !prediction) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <Link
          href="/dashboard/predictions"
          className="inline-flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to predictions
        </Link>
        <p className="text-sm text-[var(--text-muted)]">{error ?? "Forecast unavailable."}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-xl border border-[var(--border-active)] px-4 py-2 text-sm"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  const country = getCountryMeta(prediction.country_code);
  const simple = toSimpleForecast({
    countryName: country.name,
    inflationRate: prediction.inflation_rate,
    trend: prediction.trend_direction,
    riskLevel: prediction.risk_level,
    confidence: prediction.confidence_score,
    aiSummary: prediction.ai_summary,
  });
  const TrendIcon = trendIcon(prediction.trend_direction);
  const pricesRising = prediction.trend_direction.toLowerCase() === "up" || prediction.inflation_rate > 5;

  return (
    <div className="print-document mx-auto max-w-4xl space-y-6">
      <PrintDocumentHeader
        title={`${country.name} — Your Price Outlook`}
        subtitle="Plain-language inflation forecast"
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href="/dashboard/predictions"
            className="mb-3 inline-flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] print:hidden"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to predictions
          </Link>
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold text-[var(--text-primary)]">
            <CountryLabel
              code={prediction.country_code}
              name={country.name}
              flagSize="lg"
              nameClassName="text-2xl font-bold"
            />
            <span>Price Forecast</span>
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Updated {formatDateTime(prediction.created_at)}
          </p>
        </div>
        <button
          type="button"
          onClick={printPage}
          className="inline-flex items-center gap-2 self-start rounded-xl border border-[var(--border-active)] px-4 py-2.5 text-sm print:hidden"
        >
          <Printer className="h-4 w-4" />
          Download report
        </button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-panel rounded-2xl p-6"
      >
        <p className="text-sm leading-relaxed text-[var(--text-secondary)]">{simple.aiSummary}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            { label: "Current situation", value: simple.currentSituation, icon: TrendIcon },
            { label: "Expected trend", value: simple.expectedTrend, icon: Sparkles },
            { label: "Risk", value: `${simple.riskLevel} · ${simple.confidenceLabel}`, icon: Shield },
          ].map((card) => (
            <div key={card.label} className="rounded-xl border border-[var(--border-primary)] p-4">
              <card.icon className="mb-2 h-4 w-4 text-[var(--text-primary)]" />
              <p className="text-xs text-[var(--text-faint)]">{card.label}</p>
              <p className="mt-1 text-sm text-[var(--text-primary)]">{card.value}</p>
            </div>
          ))}
        </div>
      </motion.div>

      <section className="glass-panel rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">What might happen?</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {[
            { title: "Best Case", text: simple.bestCase },
            { title: "Normal Case", text: simple.normalCase },
            { title: "Worst Case", text: simple.worstCase },
          ].map((s) => (
            <div key={s.title} className="rounded-xl border border-[var(--border-primary)] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-faint)]">
                {s.title}
              </p>
              <p className="mt-2 text-sm text-[var(--text-muted)]">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="glass-panel rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">How does this affect you?</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {PERSONAL_IMPACT_TOPICS.map((topic) => (
            <div key={topic.key} className="flex gap-3 rounded-xl border border-[var(--border-primary)] p-4">
              <span className="text-2xl">{topic.icon}</span>
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">{topic.title}</p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  {topic.template(pricesRising)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {prediction.recommended_actions && prediction.recommended_actions.length > 0 && (
        <section className="glass-panel rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Recommendations</h2>
          <ul className="mt-3 space-y-2">
            {prediction.recommended_actions.map((action, i) => (
              <li
                key={i}
                className="rounded-lg border border-[var(--border-primary)] px-3 py-2 text-sm text-[var(--text-muted)]"
              >
                {action}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}