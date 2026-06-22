/**
 * Financial color intelligence — green/red/yellow/blue contextual colors.
 * Bloomberg / TradingView style: green positive, red negative, yellow caution, blue info.
 */

export type FinancialSentiment = 'positive' | 'negative' | 'caution' | 'neutral' | 'info';

export const FIN_COLORS = {
  positive: 'var(--fin-positive)',
  negative: 'var(--fin-negative)',
  caution: 'var(--fin-caution)',
  info: 'var(--fin-info)',
  neutral: 'var(--text-secondary)',
} as const;

export const FIN_BG = {
  positive: 'var(--fin-positive-bg)',
  negative: 'var(--fin-negative-bg)',
  caution: 'var(--fin-caution-bg)',
  info: 'var(--fin-info-bg)',
  neutral: 'var(--accent-faint)',
} as const;

export function sentimentClass(sentiment: FinancialSentiment, type: 'text' | 'bg' = 'text'): string {
  const map = type === 'text' ? FIN_COLORS : FIN_BG;
  return map[sentiment] ?? map.neutral;
}

/** Tailwind utility class for text color */
export function sentimentTextClass(sentiment: FinancialSentiment): string {
  const map: Record<FinancialSentiment, string> = {
    positive: 'text-fin-positive',
    negative: 'text-fin-negative',
    caution: 'text-fin-caution',
    info: 'text-fin-info',
    neutral: 'text-[var(--text-secondary)]',
  };
  return map[sentiment] ?? map.neutral;
}

/** CSS color value for inline styles */
export function sentimentColorValue(sentiment: FinancialSentiment): string {
  return FIN_COLORS[sentiment] ?? FIN_COLORS.neutral;
}

/** Inflation: 0–5% green, 5–10% yellow, 10%+ red */
export function inflationSentiment(rate: number | null | undefined): FinancialSentiment {
  if (rate == null) return 'neutral';
  if (rate < 0) return 'negative';
  if (rate <= 5) return 'positive';
  if (rate <= 10) return 'caution';
  return 'negative';
}

export function inflationChartColor(rate: number): string {
  const s = inflationSentiment(rate);
  if (s === 'positive') return FIN_COLORS.positive;
  if (s === 'caution') return FIN_COLORS.caution;
  return FIN_COLORS.negative;
}

/** Deflation always red */
export function deflationChartColor(): string {
  return FIN_COLORS.negative;
}

/** GDP: positive green, negative red */
export function gdpSentiment(growth: number | null | undefined): FinancialSentiment {
  if (growth == null) return 'neutral';
  if (growth > 0) return 'positive';
  if (growth < 0) return 'negative';
  return 'caution';
}

export function gdpChartColor(growth: number): string {
  const s = gdpSentiment(growth);
  if (s === 'positive') return FIN_COLORS.positive;
  if (s === 'negative') return FIN_COLORS.negative;
  return FIN_COLORS.caution;
}

/** Currency strength: strong green, weak red, stable yellow */
export function currencySentiment(strength: number | null | undefined): FinancialSentiment {
  if (strength == null) return 'neutral';
  if (strength >= 65) return 'positive';
  if (strength <= 40) return 'negative';
  return 'caution';
}

/** Confidence: 90–100 green, 70–89 yellow, <70 red */
export function confidenceSentiment(score: number | null | undefined): FinancialSentiment {
  if (score == null) return 'neutral';
  const pct = score <= 1 ? score * 100 : score;
  if (pct >= 90) return 'positive';
  if (pct >= 70) return 'caution';
  return 'negative';
}

export function confidenceChartColor(score: number): string {
  const s = confidenceSentiment(score);
  if (s === 'positive') return FIN_COLORS.positive;
  if (s === 'caution') return FIN_COLORS.caution;
  return FIN_COLORS.negative;
}

/** Trend direction with optional invert (e.g. inflation down = positive) */
export function trendSentiment(
  direction: string | null | undefined,
  invert = false,
): FinancialSentiment {
  const d = direction?.toLowerCase();
  if (d === 'up') return invert ? 'negative' : 'positive';
  if (d === 'down') return invert ? 'positive' : 'negative';
  return 'caution';
}

export function changeSentiment(change: number | null | undefined, invert = false): FinancialSentiment {
  if (change == null || Math.abs(change) < 0.05) return 'caution';
  if (change > 0) return invert ? 'negative' : 'positive';
  return invert ? 'positive' : 'negative';
}

/** Risk levels */
export function riskSentiment(level: string | null | undefined): FinancialSentiment {
  const l = level?.toLowerCase();
  if (l === 'low') return 'positive';
  if (l === 'medium' || l === 'moderate') return 'caution';
  if (l === 'high' || l === 'critical') return 'negative';
  return 'neutral';
}

/** API health status */
export function apiHealthSentiment(status: string | null | undefined): FinancialSentiment {
  const s = status?.toLowerCase();
  if (s === 'healthy' || s === 'ok' || s === 'active') return 'positive';
  if (s === 'degraded' || s === 'warning') return 'caution';
  if (s === 'down' || s === 'offline' || s === 'failed') return 'negative';
  return 'neutral';
}

export function formatTrendChange(
  change: number | null | undefined,
  suffix = '%',
): { arrow: string; label: string; sentiment: FinancialSentiment } {
  if (change == null) return { arrow: '—', label: '—', sentiment: 'neutral' };
  const sentiment = changeSentiment(change);
  const arrow = change > 0 ? '▲' : change < 0 ? '▼' : '—';
  const sign = change > 0 ? '+' : '';
  return { arrow, label: `${sign}${change.toFixed(2)}${suffix}`, sentiment };
}