"use client";

import { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type ChartPayload = {
  dataKey?: string;
  value?: number | null;
};

interface TooltipProps {
  active?: boolean;
  payload?: ChartPayload[];
  label?: string;
}

/* ---------- Data ---------- */
const data = [
  { month: "Jan", actual: 21.3, predicted: 21.5, upper: 22.0, lower: 21.0 },
  { month: "Feb", actual: 21.8, predicted: 21.9, upper: 22.5, lower: 21.3 },
  { month: "Mar", actual: 22.1, predicted: 22.0, upper: 22.7, lower: 21.3 },
  { month: "Apr", actual: 22.4, predicted: 22.3, upper: 23.0, lower: 21.6 },
  { month: "May", actual: 22.6, predicted: 22.5, upper: 23.2, lower: 21.8 },
  { month: "Jun", actual: 22.8, predicted: 22.7, upper: 23.4, lower: 22.0 },
  { month: "Jul", actual: null, predicted: 23.1, upper: 23.8, lower: 22.4 },
  { month: "Aug", actual: null, predicted: 22.9, upper: 23.7, lower: 22.1 },
  { month: "Sep", actual: null, predicted: 22.6, upper: 23.5, lower: 21.7 },
  { month: "Oct", actual: null, predicted: 22.3, upper: 23.3, lower: 21.3 },
  { month: "Nov", actual: null, predicted: 22.0, upper: 23.1, lower: 20.9 },
  { month: "Dec", actual: null, predicted: 21.7, upper: 22.9, lower: 20.5 },
];

/* ---------- Custom Tooltip ---------- */
function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null;

  const actual = payload.find((p) => p.dataKey === "actual")?.value;
  const predicted = payload.find((p) => p.dataKey === "predicted")?.value;

  return (
    <div className="glass-card rounded-xl hover:transform-none p-3 shadow-xl min-w-[160px]">
      <p className="text-xs text-[var(--text-muted)] mb-2 font-medium">
        {label}
      </p>
      {actual !== null && actual !== undefined && (
        <div className="flex items-center justify-between gap-4 mb-1">
          <span className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
            <span className="w-2 h-2 rounded-full bg-[#D9D9D9]" />
            Actual
          </span>
          <span className="text-xs font-semibold text-[var(--text-primary)]">
            {actual}%
          </span>
        </div>
      )}
      {predicted !== null && predicted !== undefined && (
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
            <span className="w-2 h-2 rounded-full bg-[#FFFFFF]" />
            Predicted
          </span>
          <span className="text-xs font-semibold text-[var(--text-primary)]">
            {predicted}%
          </span>
        </div>
      )}
    </div>
  );
}

/* ---------- Component ---------- */
export default function InflationChart() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted)
    return (
      <div className="chart-shell h-[300px] shimmer rounded-xl" aria-hidden />
    );

  return (
    <div className="chart-shell h-[300px]">
      <ResponsiveContainer
        width="100%"
        height="100%"
        minWidth={0}
        minHeight={300}
      >
        <AreaChart
          data={data}
          margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
        >
          <defs>
            {/* Confidence band fill */}
            <linearGradient id="confidence-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.06} />
              <stop offset="100%" stopColor="#FFFFFF" stopOpacity={0.01} />
            </linearGradient>
            {/* Predicted line gradient */}
            <linearGradient id="predicted-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.15} />
              <stop offset="100%" stopColor="#FFFFFF" stopOpacity={0} />
            </linearGradient>
            {/* Actual line gradient */}
            <linearGradient id="actual-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#D9D9D9" stopOpacity={0.1} />
              <stop offset="100%" stopColor="#D9D9D9" stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" />

          <XAxis
            dataKey="month"
            tick={{ fontSize: 12, fill: "var(--text-muted)" }}
            axisLine={{ stroke: "var(--border-primary)" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 12, fill: "var(--text-muted)" }}
            axisLine={{ stroke: "var(--border-primary)" }}
            tickLine={false}
            domain={["auto", "auto"]}
            tickFormatter={(v: number) => `${v}%`}
          />

          <Tooltip content={<CustomTooltip />} />

          {/* Upper confidence bound */}
          <Area
            type="monotone"
            dataKey="upper"
            stroke="transparent"
            fill="url(#confidence-fill)"
            fillOpacity={1}
            isAnimationActive={true}
            animationDuration={1200}
          />
          {/* Lower confidence bound */}
          <Area
            type="monotone"
            dataKey="lower"
            stroke="transparent"
            fill="var(--bg-primary, #000000)"
            fillOpacity={1}
            isAnimationActive={true}
            animationDuration={1200}
          />

          {/* Predicted trend */}
          <Area
            type="monotone"
            dataKey="predicted"
            stroke="var(--chart-primary)"
            strokeWidth={2}
            fill="url(#predicted-gradient)"
            dot={false}
            activeDot={{
              r: 4,
              fill: "var(--chart-primary)",
              stroke: "var(--bg-primary)",
              strokeWidth: 1,
            }}
            isAnimationActive={true}
            animationDuration={1000}
          />

          {/* Actual data (Jan-Jun only) */}
          <Area
            type="monotone"
            dataKey="actual"
            stroke="var(--chart-secondary)"
            strokeWidth={2}
            strokeDasharray="4 2"
            fill="url(#actual-gradient)"
            dot={{
              r: 3,
              fill: "var(--chart-secondary)",
              stroke: "var(--bg-secondary)",
              strokeWidth: 2,
            }}
            activeDot={{
              r: 5,
              fill: "var(--chart-secondary)",
              stroke: "var(--bg-primary)",
              strokeWidth: 1,
            }}
            connectNulls={false}
            isAnimationActive={true}
            animationDuration={1000}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
