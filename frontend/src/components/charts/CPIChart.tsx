"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type ChartPayload = {
  dataKey?: string;
  value?: number;
  color?: string;
};

interface TooltipProps {
  active?: boolean;
  payload?: ChartPayload[];
  label?: string;
}

/* ---------- Nigerian CPI Index Data (12 months) ---------- */
const data = [
  { month: "Jan", overall: 290.5, food: 334.2, core: 268.1 },
  { month: "Feb", overall: 293.1, food: 338.5, core: 270.4 },
  { month: "Mar", overall: 296.4, food: 342.8, core: 273.0 },
  { month: "Apr", overall: 299.2, food: 346.1, core: 275.7 },
  { month: "May", overall: 302.0, food: 350.3, core: 278.1 },
  { month: "Jun", overall: 305.1, food: 354.0, core: 280.9 },
  { month: "Jul", overall: 308.3, food: 358.2, core: 283.5 },
  { month: "Aug", overall: 311.0, food: 361.7, core: 285.8 },
  { month: "Sep", overall: 313.5, food: 364.9, core: 287.4 },
  { month: "Oct", overall: 315.8, food: 367.5, core: 289.2 },
  { month: "Nov", overall: 317.6, food: 370.1, core: 290.9 },
  { month: "Dec", overall: 319.2, food: 372.4, core: 292.3 },
];

/* ---------- Legend config ---------- */
const lines = [
  { key: "overall", label: "Overall CPI", color: "var(--chart-primary)" },
  { key: "food", label: "Food CPI", color: "var(--chart-secondary)" },
  { key: "core", label: "Core CPI", color: "var(--chart-tertiary)" },
] as const;

/* ---------- Custom Tooltip ---------- */
function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card rounded-xl hover:transform-none p-3 shadow-xl min-w-[170px]">
      <p className="text-xs text-[var(--text-muted)] mb-2 font-medium">
        {label}
      </p>
      {payload.map((entry) => (
        <div
          key={entry.dataKey}
          className="flex items-center justify-between gap-4 mb-1 last:mb-0"
        >
          <span className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: entry.color }}
            />
            {lines.find((l) => l.key === entry.dataKey)?.label ?? entry.dataKey}
          </span>
          <span className="text-xs font-semibold text-[var(--text-primary)]">
            {entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ---------- Component ---------- */
export default function CPIChart() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted)
    return (
      <div className="chart-shell h-[304px] shimmer rounded-xl" aria-hidden />
    );

  return (
    <div className="chart-shell h-[304px]">
      {/* Custom legend */}
      <div className="flex gap-4 mb-4 flex-wrap">
        {lines.map((l) => (
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
        height={260}
        minWidth={0}
        minHeight={260}
      >
        <LineChart
          data={data}
          margin={{ top: 5, right: 10, left: -10, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" />

          <XAxis
            dataKey="month"
            tick={{ fontSize: 11, fill: "var(--text-muted)" }}
            axisLine={{ stroke: "var(--border-primary)" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "var(--text-muted)" }}
            axisLine={{ stroke: "var(--border-primary)" }}
            tickLine={false}
            domain={["auto", "auto"]}
          />

          <Tooltip content={<CustomTooltip />} />

          {lines.map((l) => (
            <Line
              key={l.key}
              type="monotone"
              dataKey={l.key}
              stroke={l.color}
              strokeWidth={2}
              dot={false}
              activeDot={{
                r: 4,
                fill: l.color,
                stroke: "var(--bg-secondary)",
                strokeWidth: 2,
              }}
              isAnimationActive={true}
              animationDuration={1000}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
