"use client";

import { useCallback, useEffect, useState } from "react";
import { Target, Loader2, Play } from "lucide-react";
import { intelligenceAPI } from "@/lib/api";
import { sentimentTextClass } from "@/lib/financialColors";
import CountryFocusBar, { useActiveCountryCode } from "@/components/dashboard/CountryFocusBar";
import { CountryLabel } from "@/components/ui/CountryFlag";
import { toast } from "@/lib/feedback";

const SLIDERS = [
  { key: "cpi", label: "CPI", min: 50, max: 600, step: 5 },
  { key: "interest_rate", label: "Interest Rate (%)", min: 0, max: 35, step: 0.25 },
  { key: "exchange_rate", label: "Exchange Rate", min: 0.5, max: 2000, step: 10 },
  { key: "oil_price", label: "Oil Price ($)", min: 20, max: 150, step: 1 },
  { key: "gov_spending", label: "Gov. Spending", min: 1, max: 7000, step: 10 },
  { key: "unemployment_rate", label: "Unemployment (%)", min: 2, max: 40, step: 0.5 },
  { key: "money_supply", label: "Money Supply", min: 10, max: 70000, step: 100 },
];

export default function ScenariosPage() {
  const countryCode = useActiveCountryCode();
  const [overrides, setOverrides] = useState<Record<string, number>>({});
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [history, setHistory] = useState<Array<Record<string, unknown>>>([]);
  const [running, setRunning] = useState(false);

  const loadHistory = useCallback(async () => {
    try {
      const { data } = await intelligenceAPI.listScenarios();
      setHistory(Array.isArray(data) ? data : []);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const runScenario = async () => {
    setRunning(true);
    try {
      const { data } = await intelligenceAPI.runScenario({
        country_code: countryCode,
        name: "Custom Scenario",
        overrides,
      });
      setResult(data);
      toast.success("Scenario forecast generated.");
      await loadHistory();
    } catch {
      toast.error("Failed to run scenario.");
    } finally {
      setRunning(false);
    }
  };

  const diff = result?.forecast_difference as number | undefined;
  const diffSent = diff != null ? (diff > 0 ? "negative" : diff < 0 ? "positive" : "neutral") : "neutral";

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-[var(--text-primary)]">
          <Target className="h-6 w-6" /> Scenario Simulation Lab
        </h1>
        <p className="text-sm text-[var(--text-muted)]">
          Adjust macro assumptions and generate TS-Transformer forecasts for{" "}
          <CountryLabel code={countryCode} />
        </p>
      </div>

      <CountryFocusBar label="Scenario focus" />

      <div className="glass-card rounded-xl hover:transform-none p-5 space-y-5">
        {SLIDERS.map((s) => (
          <div key={s.key}>
            <div className="flex justify-between text-sm">
              <label>{s.label}</label>
              <span className="text-[var(--text-muted)]">
                {overrides[s.key] ?? "baseline"}
              </span>
            </div>
            <input
              type="range"
              min={s.min}
              max={s.max}
              step={s.step}
              value={overrides[s.key] ?? (s.min + s.max) / 2}
              onChange={(e) =>
                setOverrides((o) => ({ ...o, [s.key]: Number(e.target.value) }))
              }
              className="mt-2 w-full accent-[var(--text-primary)]"
            />
          </div>
        ))}

        <button
          onClick={() => void runScenario()}
          disabled={running}
          className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-white"
        >
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          Generate Forecast
        </button>
      </div>

      {result && (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="glass-card rounded-xl hover:transform-none p-4">
            <p className="text-xs text-[var(--text-muted)]">Baseline</p>
            <p className="text-2xl font-bold">{String(result.baseline_forecast)}%</p>
          </div>
          <div className="glass-card rounded-xl hover:transform-none p-4">
            <p className="text-xs text-[var(--text-muted)]">Scenario</p>
            <p className="text-2xl font-bold">{String(result.scenario_forecast)}%</p>
          </div>
          <div className="glass-card rounded-xl hover:transform-none p-4">
            <p className="text-xs text-[var(--text-muted)]">Difference</p>
            <p className={`text-2xl font-bold ${sentimentTextClass(diffSent)}`}>
              {diff != null ? `${diff > 0 ? "+" : ""}${diff.toFixed(2)} pp` : "—"}
            </p>
          </div>
          <div className="sm:col-span-3 glass-card rounded-xl hover:transform-none p-4">
            <p className="text-sm text-[var(--text-secondary)]">{String(result.impact_summary)}</p>
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div className="glass-card rounded-xl hover:transform-none p-5">
          <h2 className="mb-3 text-sm font-semibold">Recent Scenarios</h2>
          <div className="space-y-2">
            {history.slice(0, 5).map((s) => (
              <div key={String(s.id)} className="flex justify-between text-sm">
                <span className="inline-flex items-center gap-2">
                  {String(s.name)} ·{" "}
                  <CountryLabel code={String(s.country_code)} flagSize="xs" />
                </span>
                <span className={sentimentTextClass(
                  (s.forecast_difference as number) > 0 ? "negative" : "positive"
                )}>
                  {(s.forecast_difference as number) > 0 ? "+" : ""}
                  {String(s.forecast_difference)} pp
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}