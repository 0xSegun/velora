"use client";

import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

type ChartPayload = {
  dataKey?: string;
  value?: number;
};

interface TooltipProps {
  active?: boolean;
  payload?: ChartPayload[];
  label?: string;
}

/* ---------- Data ---------- */
const data = [
  { country: "Nigeria", current: 22.79, previous: 21.3, predicted: 23.1 },
  { country: "USA", current: 3.2, previous: 3.7, predicted: 3.0 },
  { country: "UK", current: 4.1, previous: 4.6, predicted: 3.8 },
  { country: "Ghana", current: 23.5, previous: 25.8, predicted: 22.0 },
  { country: "S. Africa", current: 5.4, previous: 5.9, predicted: 5.1 },
];

/* ---------- Legend items ---------- */
const legend = [
  { key: "current", label: "Current", color: "var(--chart-primary)" },
  { key: "previous", label: "Previous", color: "var(--chart-tertiary)" },
  { key: "predicted", label: "Predicted", color: "var(--chart-secondary)" },
];

/* ---------- Custom Tooltip ---------- */
function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card rounded-xl hover:transform-none p-3 shadow-xl min-w-[180px]">
      <p className="text-xs text-[var(--text-muted)] mb-2 font-semibold">
        {label}
      </p>
      {payload.map((entry) => {
        const meta = legend.find((l) => l.key === entry.dataKey);
        return (
          <div
            key={entry.dataKey}
            className="flex items-center justify-between gap-4 mb-1 last:mb-0"
          >
            <span className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: meta?.color }}
              />
              {meta?.label ?? entry.dataKey}
            </span>
            <span className="text-xs font-semibold text-[var(--text-primary)]">
              {entry.value}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- Component ---------- */
export default function CountryComparisonChart() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted)
    return (
      <div className="chart-shell h-[324px] shimmer rounded-xl" aria-hidden />
    );

  return (
    <div className="chart-shell h-[324px]">
      {/* Custom legend */}
      <div className="flex gap-4 mb-4 flex-wrap">
        {legend.map((l) => (
          <span
            key={l.key}
            className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]"
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: l.color }}
            />
            {l.label}
          </span>
        ))}
      </div>

      <ResponsiveContainer
        width="100%"
        height={280}
        minWidth={0}
        minHeight={280}
      >
        <BarChart
          data={data}
          margin={{ top: 5, right: 10, left: -10, bottom: 0 }}
          barCategoryGap="20%"
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--border-primary)"
            vertical={false}
          />

          <XAxis
            dataKey="country"
            tick={{ fontSize: 11, fill: "var(--text-muted)" }}
            axisLine={{ stroke: "var(--border-primary)" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "var(--text-muted)" }}
            axisLine={{ stroke: "var(--border-primary)" }}
            tickLine={false}
            tickFormatter={(v: number) => `${v}%`}
          />

          <Tooltip
            content={<CustomTooltip />}
            cursor={{ fill: "rgba(255,255,255,0.02)" }}
          />

          <Bar
            dataKey="previous"
            fill="var(--chart-tertiary)"
            radius={[4, 4, 0, 0]}
            maxBarSize={24}
            isAnimationActive
            animationDuration={800}
          >
            {data.map((_, i) => (
              <Cell key={`prev-${i}`} fill="var(--chart-tertiary)" />
            ))}
          </Bar>
          <Bar
            dataKey="current"
            fill="var(--chart-primary)"
            radius={[4, 4, 0, 0]}
            maxBarSize={24}
            isAnimationActive
            animationDuration={1000}
          >
            {data.map((_, i) => (
              <Cell key={`curr-${i}`} fill="var(--chart-primary)" />
            ))}
          </Bar>
          <Bar
            dataKey="predicted"
            fill="var(--chart-secondary)"
            radius={[4, 4, 0, 0]}
            maxBarSize={24}
            isAnimationActive
            animationDuration={1200}
          >
            {data.map((_, i) => (
              <Cell
                key={`pred-${i}`}
                fill="var(--chart-secondary)"
                fillOpacity={0.65}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
