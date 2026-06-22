"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Brain, TrendingUp, TrendingDown, Minus } from "lucide-react";
import Link from "next/link";
import { predictionsAPI } from "@/lib/api";
import { toSimpleForecast } from "@/lib/plainLanguage";
import { CountryLabel } from "@/components/ui/CountryFlag";
import { getCountryMeta } from "@/lib/countries";
import PageHeader from "@/components/ui/PageHeader";
import CountryFocusBar, { useActiveCountryCode } from "@/components/dashboard/CountryFocusBar";
import GeneratePredictionPanel from "@/components/dashboard/GeneratePredictionPanel";
import type { Prediction } from "@/types/prediction";

function trendIcon(d: string) {
  if (d === "up") return TrendingUp;
  if (d === "down") return TrendingDown;
  return Minus;
}

export default function OrdinaryPredictions() {
  const activeCountry = useActiveCountryCode();
  const [latest, setLatest] = useState<Prediction | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await predictionsAPI.getByCountry(activeCountry);
      const history = data as { predictions?: Prediction[] };
      const items = history.predictions ?? [];
      setLatest(items[0] ?? null);
    } catch {
      setLatest(null);
    } finally {
      setLoading(false);
    }
  }, [activeCountry]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--text-muted)]" />
      </div>
    );
  }

  const meta = latest ? getCountryMeta(latest.country_code) : null;
  const simple = latest
    ? toSimpleForecast({
        countryName: meta?.name ?? latest.country_code,
        inflationRate: latest.inflation_rate,
        trend: latest.trend_direction,
        riskLevel: latest.risk_level,
        confidence: latest.confidence_score,
        aiSummary: latest.ai_summary,
      })
    : null;

  const TrendIcon = latest ? trendIcon(latest.trend_direction) : Minus;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Forecasts"
        title="Your Predictions"
        description="Simple inflation outlook — what it means and how confident we are."
        icon={Brain}
      />

      <CountryFocusBar label="Forecast country" />

      <GeneratePredictionPanel
        key={activeCountry}
        initialCountry={activeCountry}
        onGenerated={load}
      />

      {latest && simple ? (
        <>
          <div className="glass-panel rounded-2xl p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CountryLabel code={latest.country_code} flagSize="md" />
              <span className="rounded-full border border-[var(--border-primary)] px-3 py-1 text-xs">
                {simple.riskLevel} risk · {simple.confidenceLabel}
              </span>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-xs text-[var(--text-faint)]">Current outlook</p>
                <p className="mt-1 text-sm text-[var(--text-primary)]">{simple.currentSituation}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--text-faint)]">Expected trend</p>
                <p className="mt-1 flex items-center gap-1 text-sm text-[var(--text-primary)]">
                  <TrendIcon className="h-4 w-4" /> {simple.expectedTrend}
                </p>
              </div>
              <div>
                <p className="text-xs text-[var(--text-faint)]">AI explanation</p>
                <p className="mt-1 text-sm text-[var(--text-muted)]">{simple.aiSummary}</p>
              </div>
            </div>
          </div>
          <Link
            href={`/dashboard/predictions/${latest.id}`}
            className="text-sm text-[var(--accent)] hover:underline"
          >
            View full forecast details →
          </Link>
        </>
      ) : (
        <p className="text-sm text-[var(--text-muted)]">
          No forecast yet. Generate one above to see your personalized outlook.
        </p>
      )}
    </div>
  );
}