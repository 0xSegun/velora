'use client';

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import {
  changeSentiment,
  formatTrendChange,
  sentimentClass,
  trendSentiment,
  type FinancialSentiment,
} from '@/lib/financialColors';
import { cn } from '@/lib/utils';

interface TrendIndicatorProps {
  direction?: string | null;
  change?: number | null;
  suffix?: string;
  invert?: boolean;
  label?: string;
  size?: 'sm' | 'md';
  className?: string;
}

function IconForDirection(direction?: string | null) {
  const d = direction?.toLowerCase();
  if (d === 'up') return TrendingUp;
  if (d === 'down') return TrendingDown;
  return Minus;
}

export default function TrendIndicator({
  direction,
  change,
  suffix = '%',
  invert = false,
  label,
  size = 'sm',
  className,
}: TrendIndicatorProps) {
  let sentiment: FinancialSentiment;
  let display: string;

  if (change != null) {
    const formatted = formatTrendChange(change, suffix);
    sentiment = changeSentiment(change, invert);
    display = `${formatted.arrow} ${formatted.label}`;
  } else {
    sentiment = trendSentiment(direction, invert);
    display = label ?? direction ?? 'stable';
  }

  const Icon = IconForDirection(direction);
  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5';
  const textSize = size === 'sm' ? 'text-[10px]' : 'text-xs';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium capitalize',
        textSize,
        className,
      )}
      style={{
        color: sentimentClass(sentiment),
        backgroundColor: sentimentClass(sentiment, 'bg'),
      }}
    >
      <Icon className={iconSize} />
      {display}
    </span>
  );
}