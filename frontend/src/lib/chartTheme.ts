/** Chart styling with financial color intelligence */

import {
  confidenceChartColor,
  deflationChartColor,
  FIN_COLORS,
  gdpChartColor,
  inflationChartColor,
} from '@/lib/financialColors';

export const CHART_COLORS = {
  primary: 'var(--chart-primary)',
  secondary: 'var(--chart-secondary)',
  tertiary: 'var(--chart-tertiary)',
  muted: 'var(--text-muted)',
  border: 'var(--border-primary)',
  positive: FIN_COLORS.positive,
  negative: FIN_COLORS.negative,
  caution: FIN_COLORS.caution,
  info: FIN_COLORS.info,
  deflation: deflationChartColor(),
  series: [
    FIN_COLORS.positive,
    FIN_COLORS.info,
    FIN_COLORS.caution,
    FIN_COLORS.negative,
    'var(--chart-tertiary)',
  ] as const,
};

export const chartAxisTick = { fontSize: 11, fill: 'var(--text-muted)' };
export const chartAxisTickSm = { fontSize: 10, fill: 'var(--text-muted)' };
export const chartAxisLine = { stroke: 'var(--border-primary)' };
export const chartGridStroke = 'var(--border-primary)';
export const chartLegendStyle = { fontSize: 11, color: 'var(--text-muted)' };

export { inflationChartColor, gdpChartColor, confidenceChartColor, deflationChartColor };

/** Dynamic bar fill by value type */
export function barFillForMetric(
  metric: 'inflation' | 'gdp' | 'confidence' | 'deflation' | 'interest',
  value: number,
): string {
  switch (metric) {
    case 'inflation':
      return inflationChartColor(value);
    case 'gdp':
      return gdpChartColor(value);
    case 'confidence':
      return confidenceChartColor(value);
    case 'deflation':
      return deflationChartColor();
    default:
      return CHART_COLORS.secondary;
  }
}