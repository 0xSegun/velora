'use client';

import { Brain, AlertTriangle, Lightbulb } from 'lucide-react';
import GlowCard from '@/components/ui/GlowCard';
import type { AIInsights } from '@/lib/api';
import { confidenceSentiment, sentimentClass } from '@/lib/financialColors';

export default function AIInsightsPanel({ insights }: { insights: AIInsights }) {
  const confSentiment = confidenceSentiment(insights.confidence_level);

  return (
    <GlowCard id="ai-insights" className="p-5">
      <div className="mb-4 flex items-center gap-2">
        <Brain className="h-4 w-4 text-[var(--text-primary)]" />
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">AI Economic Insights</h2>
        {insights.confidence_level != null && (
          <span
            className="ml-auto rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={{
              color: sentimentClass(confSentiment),
              backgroundColor: sentimentClass(confSentiment, 'bg'),
            }}
          >
            {insights.confidence_level}% confidence
          </span>
        )}
      </div>

      <p className="text-sm leading-relaxed text-[var(--text-secondary)]">{insights.summary}</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div
          className="rounded-lg p-3"
          style={{ backgroundColor: sentimentClass('info', 'bg') }}
        >
          <p className="mb-2 text-xs font-semibold" style={{ color: sentimentClass('info') }}>
            Key Drivers
          </p>
          <ul className="space-y-1 text-xs text-[var(--text-muted)]">
            {insights.key_drivers.map((d, i) => (
              <li key={i}>• {d}</li>
            ))}
          </ul>
        </div>
        <div
          className="rounded-lg p-3"
          style={{ backgroundColor: sentimentClass('negative', 'bg') }}
        >
          <p
            className="mb-2 flex items-center gap-1 text-xs font-semibold"
            style={{ color: sentimentClass('negative') }}
          >
            <AlertTriangle className="h-3 w-3" /> Risks
          </p>
          <ul className="space-y-1 text-xs text-[var(--text-muted)]">
            {insights.risks.map((r, i) => (
              <li key={i}>• {r}</li>
            ))}
          </ul>
        </div>
        <div
          className="rounded-lg p-3"
          style={{ backgroundColor: sentimentClass('positive', 'bg') }}
        >
          <p
            className="mb-2 flex items-center gap-1 text-xs font-semibold"
            style={{ color: sentimentClass('positive') }}
          >
            <Lightbulb className="h-3 w-3" /> Opportunities
          </p>
          <ul className="space-y-1 text-xs text-[var(--text-muted)]">
            {insights.opportunities.map((o, i) => (
              <li key={i}>• {o}</li>
            ))}
          </ul>
        </div>
      </div>
    </GlowCard>
  );
}