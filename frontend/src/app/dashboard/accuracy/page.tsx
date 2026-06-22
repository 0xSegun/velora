"use client";

import { useCallback, useEffect, useState } from "react";
import { BarChart3, Loader2, AlertTriangle } from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { chartTooltipProps } from "@/components/charts/ChartTooltip";
import { intelligenceAPI } from "@/lib/api";
import PageLoadError from "@/components/ui/PageLoadError";
import CountryFocusBar, { useActiveCountryCode } from "@/components/dashboard/CountryFocusBar";
import { CountryFlag, CountryLabel } from "@/components/ui/CountryFlag";
import { getCountryMeta } from "@/lib/countries";
import { chartAxisLine, chartAxisTick, chartGridStroke } from "@/lib/chartTheme";
import { sentimentTextClass } from "@/lib/financialColors";

function CountryAxisTick({
  x = 0,
  y = 0,
  payload,
}: {
  x?: number;
  y?: number;
  payload?: { value?: string };
}) {
  const code = payload?.value ?? "";
  return (
    <g transform={`translate(${x},${y})`}>
      <foreignObject x={-22} y={4} width={52} height={20}>
        <CountryFlag code={code} size="xs" title={getCountryMeta(code).name} />
      </foreignObject>
    </g>
  );
}

export default function AccuracyPage() {
  const countryCode = useActiveCountryCode();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const { data: payload } = await intelligenceAPI.getAccuracy(countryCode);
      setData(payload);
    } catch {
      setData(null);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [countryCode]);

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

  if (loadError || !data) {
    return (
      <PageLoadError
        title="Failed to load accuracy data"
        onRetry={() => void load()}
      />
    );
  }

  const metrics = data.overall_metrics as Record<string, number> | undefined;
  const monthly = (data.monthly_trends as Array<Record<string, unknown>>) ?? [];
  const rankings = (data.country_rankings as Array<Record<string, unknown>>) ?? [];
  const alerts = (data.alerts as Array<Record<string, unknown>>) ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-[var(--text-primary)]">
          <BarChart3 className="h-6 w-6" /> Prediction Accuracy Dashboard
        </h1>
        <p className="text-sm text-[var(--text-muted)]">
          TS-Transformer model performance for{" "}
          <CountryLabel code={countryCode} />
        </p>
      </div>

      <CountryFocusBar label="Accuracy focus" />

      {alerts.length > 0 && (
        <div className="rounded-xl border border-[var(--fin-caution)] bg-[var(--fin-caution-bg)] p-4">
          {alerts.map((a, i) => (
            <p key={i} className="flex items-center gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-fin-caution" />
              {String(a.message)}
            </p>
          ))}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          ["Accuracy", metrics?.accuracy_pct != null ? `${metrics.accuracy_pct}%` : "—", "positive"],
          ["RMSE", metrics?.rmse, "info"],
          ["MAE", metrics?.mae, "info"],
          ["MAPE", metrics?.mape != null ? `${metrics.mape}%` : "—", "caution"],
          ["R² Score", metrics?.r2_score, "positive"],
        ].map(([label, val, sent]) => (
          <div
            key={String(label)}
            className="glass-card rounded-xl hover:transform-none p-4"
          >
            <p className="text-xs text-[var(--text-muted)]">{String(label)}</p>
            <p className={`mt-1 text-2xl font-bold ${sentimentTextClass(sent as "info" | "caution" | "positive")}`}>
              {String(val ?? "—")}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="glass-card rounded-xl hover:transform-none p-5">
          <h2 className="mb-4 text-sm font-semibold">Monthly Accuracy (MAE)</h2>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={monthly}>
              <CartesianGrid stroke={chartGridStroke} strokeDasharray="3 3" />
              <XAxis dataKey="period" tick={chartAxisTick} axisLine={chartAxisLine} />
              <YAxis tick={chartAxisTick} axisLine={chartAxisLine} />
              <Tooltip {...chartTooltipProps} />
              <Line type="monotone" dataKey="mae" stroke="var(--text-primary)" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-card rounded-xl hover:transform-none p-5">
          <h2 className="mb-4 text-sm font-semibold">Country Accuracy Rankings</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={rankings.slice(0, 8)}>
              <CartesianGrid stroke={chartGridStroke} strokeDasharray="3 3" />
              <XAxis
                dataKey="country_code"
                tick={<CountryAxisTick />}
                axisLine={chartAxisLine}
                height={48}
              />
              <YAxis tick={chartAxisTick} axisLine={chartAxisLine} />
              <Tooltip {...chartTooltipProps} />
              <Bar dataKey="mae" fill="var(--text-muted)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}