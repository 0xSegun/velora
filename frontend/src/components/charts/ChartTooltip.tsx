"use client";

export type ChartTooltipPayload = {
  name?: string;
  value?: number | string;
  color?: string;
  dataKey?: string | number;
};

export interface ChartTooltipContentProps {
  active?: boolean;
  payload?: ChartTooltipPayload[];
  label?: string | number;
  valueFormatter?: (value: number | string, name: string) => string;
  labelFormatter?: (label: string | number) => string;
}

/** Theme-aware Recharts tooltip body — dark text in light mode, light text in dark mode. */
export function ChartTooltipContent({
  active,
  payload,
  label,
  valueFormatter,
  labelFormatter,
}: ChartTooltipContentProps) {
  if (!active || !payload?.length) return null;

  const displayLabel =
    label != null
      ? labelFormatter
        ? labelFormatter(label)
        : String(label)
      : null;

  return (
    <div className="chart-tooltip">
      {displayLabel ? (
        <p className="chart-tooltip__label">{displayLabel}</p>
      ) : null}
      <ul className="chart-tooltip__list">
        {payload.map((entry, i) => {
          const name = entry.name ?? String(entry.dataKey ?? "");
          const raw = entry.value;
          const displayValue =
            valueFormatter && raw != null
              ? valueFormatter(raw, name)
              : typeof raw === "number"
                ? raw.toFixed(2)
                : String(raw ?? "—");

          return (
            <li key={`${name}-${i}`} className="chart-tooltip__item">
              <span className="chart-tooltip__series">
                <span
                  className="chart-tooltip__dot"
                  style={{ backgroundColor: entry.color ?? "var(--accent)" }}
                />
                <span className="chart-tooltip__name">{name}</span>
              </span>
              <span className="chart-tooltip__value">{displayValue}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Props for Recharts default tooltip styling (when not using custom content). */
export const chartTooltipProps = {
  contentStyle: {
    backgroundColor: "var(--tooltip-bg)",
    border: "1px solid var(--tooltip-border)",
    borderRadius: "12px",
    boxShadow: "var(--tooltip-shadow)",
    padding: "10px 12px",
  },
  labelStyle: {
    color: "var(--tooltip-text)",
    fontWeight: 600,
    fontSize: 12,
    marginBottom: 4,
  },
  itemStyle: {
    color: "var(--tooltip-text)",
    fontSize: 12,
  },
  cursor: { fill: "var(--accent-faint)" },
} as const;