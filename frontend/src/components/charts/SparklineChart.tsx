"use client";

import { useEffect, useId, useState } from "react";
import { AreaChart, Area, ResponsiveContainer } from "recharts";

interface SparklineChartProps {
  /** Array of raw numeric values to plot */
  data: number[];
  /** Stroke / fill accent colour */
  color: string;
  /** Chart width in px (default 100) */
  width?: number;
  /** Chart height in px (default 40) */
  height?: number;
}

/**
 * SparklineChart — a minimal inline area chart designed to fit inside
 * metric cards. Renders with zero chrome (no axes, grid, or tooltip).
 */
export default function SparklineChart({
  data,
  color,
  width = 100,
  height = 40,
}: SparklineChartProps) {
  // Reshape raw numbers into Recharts-friendly objects
  const chartData = data.map((value, index) => ({ index, value }));

  const [mounted, setMounted] = useState(false);
  const reactId = useId().replace(/:/g, "");
  const gradientId = `sparkline-${reactId}`;

  useEffect(() => setMounted(true), []);

  if (!mounted)
    return (
      <div className="shimmer rounded" style={{ width, height }} aria-hidden />
    );

  return (
    <div style={{ width, height, minWidth: 0 }}>
      <ResponsiveContainer
        width="100%"
        height="100%"
        minWidth={0}
        minHeight={height}
      >
        <AreaChart
          data={chartData}
          margin={{ top: 2, right: 2, bottom: 2, left: 2 }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.4} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#${gradientId})`}
            dot={false}
            isAnimationActive={true}
            animationDuration={800}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
