"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadialBarChart,
  RadialBar,
} from "recharts";
import { ChartTooltipContent } from "@/components/charts/ChartTooltip";
import {
  chartAxisLine,
  chartAxisTick,
  chartGridStroke,
  CHART_COLORS,
} from "@/lib/chartTheme";

const SENTIMENT_COLORS = {
  positive: "#22c55e",
  moderate: "#eab308",
  negative: "#ef4444",
};

function healthColor(score: number) {
  if (score >= 75) return SENTIMENT_COLORS.positive;
  if (score >= 50) return SENTIMENT_COLORS.moderate;
  return SENTIMENT_COLORS.negative;
}

function riskColor(level: string) {
  const l = level.toLowerCase();
  if (l === "low") return SENTIMENT_COLORS.positive;
  if (l === "high" || l === "critical") return SENTIMENT_COLORS.negative;
  return SENTIMENT_COLORS.moderate;
}

interface SeriesPoint {
  label: string;
  value: number;
}

interface UserEconomicChartsProps {
  charts: Record<string, SeriesPoint[]>;
  gauges: {
    economic_health: number;
    forecast_confidence: number;
    risk_level: string;
    sentiment_score: number;
  };
}

function MiniLineChart({
  title,
  data,
  suffix = "",
  color = CHART_COLORS.primary,
}: {
  title: string;
  data: SeriesPoint[];
  suffix?: string;
  color?: string;
}) {
  if (!data.length) {
    return (
      <div className="glass-panel rounded-2xl p-4">
        <p className="text-xs text-[var(--text-faint)]">{title}</p>
        <p className="mt-2 text-sm text-[var(--text-muted)]">Data loading…</p>
      </div>
    );
  }
  return (
    <div className="glass-panel rounded-2xl p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-faint)]">
        {title}
      </p>
      <div className="chart-shell h-40">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} />
            <XAxis dataKey="label" tick={chartAxisTick} axisLine={chartAxisLine} />
            <YAxis tick={chartAxisTick} axisLine={chartAxisLine} width={36} />
            <Tooltip
              content={
                <ChartTooltipContent
                  valueFormatter={(v) =>
                    typeof v === "number" ? `${v.toFixed(2)}${suffix}` : String(v)
                  }
                />
              }
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              dot={{ r: 3, fill: color }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function GaugeCard({
  title,
  value,
  suffix,
  color,
}: {
  title: string;
  value: number;
  suffix?: string;
  color: string;
}) {
  const data = [{ name: title, value, fill: color }];
  return (
    <div className="glass-panel rounded-2xl p-4 text-center">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-faint)]">
        {title}
      </p>
      <div className="mx-auto h-28 w-28">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            cx="50%"
            cy="50%"
            innerRadius="60%"
            outerRadius="100%"
            data={data}
            startAngle={180}
            endAngle={0}
          >
            <RadialBar dataKey="value" cornerRadius={4} background />
          </RadialBarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-lg font-bold" style={{ color }}>
        {value.toFixed(0)}
        {suffix}
      </p>
    </div>
  );
}

export default function UserEconomicCharts({ charts, gauges }: UserEconomicChartsProps) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-[var(--text-primary)]">Easy-to-read charts</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MiniLineChart
          title="Inflation Trend"
          data={charts.inflation_trend ?? []}
          suffix="%"
          color={SENTIMENT_COLORS.moderate}
        />
        <MiniLineChart
          title="Cost of Living (CPI)"
          data={charts.food_price_trend ?? []}
          color={CHART_COLORS.secondary}
        />
        <MiniLineChart
          title="Exchange Rate"
          data={charts.exchange_rate_trend ?? []}
        />
        <MiniLineChart
          title="Fuel Price Trend"
          data={charts.fuel_price_trend ?? []}
          color={SENTIMENT_COLORS.negative}
        />
        <MiniLineChart
          title="Purchasing Power"
          data={charts.purchasing_power_trend ?? []}
          suffix="%"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <GaugeCard
          title="Economic Health"
          value={gauges.economic_health}
          color={healthColor(gauges.economic_health)}
        />
        <GaugeCard
          title="Forecast Confidence"
          value={gauges.forecast_confidence}
          suffix="%"
          color={healthColor(gauges.forecast_confidence)}
        />
        <GaugeCard
          title="Risk Level"
          value={
            gauges.risk_level.toLowerCase() === "low"
              ? 25
              : gauges.risk_level.toLowerCase() === "high"
                ? 85
                : 55
          }
          color={riskColor(gauges.risk_level)}
        />
      </div>
    </div>
  );
}