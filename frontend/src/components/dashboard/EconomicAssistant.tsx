"use client";

import { useMemo, useState } from "react";
import { MessageCircle, Send, Sparkles } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { isAnalystRole } from "@/lib/roles";
import { toSimpleForecast } from "@/lib/plainLanguage";
import { intelligenceAPI } from "@/lib/api";

interface AssistantContext {
  countryName?: string;
  inflationRate?: number | null;
  trend?: string | null;
  riskLevel?: string | null;
  confidence?: number | null;
  aiSummary?: string | null;
}

const ORDINARY_PROMPTS = [
  "What does inflation mean for my daily expenses?",
  "Should I worry about rising prices?",
  "How can I protect my savings?",
];

const ANALYST_PROMPTS = [
  "Explain the influence of CPI and interest rates on the current forecast.",
  "What are the top feature drivers in this prediction?",
  "How confident is the TS-Transformer model?",
];

function buildOrdinaryAnswer(question: string, ctx: AssistantContext): string {
  const simple = toSimpleForecast({
    countryName: ctx.countryName ?? "your country",
    inflationRate: ctx.inflationRate,
    trend: ctx.trend,
    riskLevel: ctx.riskLevel,
    confidence: ctx.confidence,
    aiSummary: ctx.aiSummary,
  });

  const q = question.toLowerCase();
  if (q.includes("daily") || q.includes("expense") || q.includes("grocer")) {
    return `Based on the current outlook, ${simple.currentSituation.toLowerCase()} ${simple.expectedTrend.toLowerCase()} In practical terms, you may notice small changes in groceries, transport, and everyday bills. Risk level: ${simple.riskLevel}.`;
  }
  if (q.includes("worry") || q.includes("risk")) {
    return `The current risk level is ${simple.riskLevel} with ${simple.confidenceLabel.toLowerCase()}. ${simple.normalCase}`;
  }
  if (q.includes("saving") || q.includes("protect")) {
    return `When prices rise, cash buys less over time. Consider keeping an emergency fund and comparing prices. Right now: ${simple.currentSituation} ${simple.worstCase}`;
  }
  return ctx.aiSummary ?? simple.aiSummary;
}

function buildAnalystAnswer(question: string, ctx: AssistantContext): string {
  const rate = ctx.inflationRate != null ? `${ctx.inflationRate.toFixed(2)}%` : "N/A";
  const trend = ctx.trend ?? "stable";
  const risk = ctx.riskLevel ?? "medium";
  const conf = ctx.confidence != null
    ? (ctx.confidence <= 1 ? ctx.confidence * 100 : ctx.confidence).toFixed(1)
    : "—";

  const q = question.toLowerCase();
  if (q.includes("cpi") || q.includes("interest")) {
    return `The TS-Transformer forecast for ${ctx.countryName ?? "the selected economy"} projects inflation at ${rate} with a ${trend} trend. CPI momentum and policy rates typically transmit through demand and credit conditions — review Analytics and Explainable AI for indicator-level attribution.`;
  }
  if (q.includes("feature") || q.includes("driver")) {
    return `Open Explainable AI for attention heatmaps and feature importance rankings. Model confidence is ${conf}% with ${risk} risk classification on the current horizon.`;
  }
  if (q.includes("confident") || q.includes("model")) {
    return `TS-Transformer confidence: ${conf}%. Risk band: ${risk}. Trend direction: ${trend}. Use Model Performance and Accuracy Monitoring for backtest metrics and drift signals.`;
  }
  return (
    ctx.aiSummary ??
    `Forecast: ${rate} inflation, ${trend} trend, ${risk} risk, ${conf}% model confidence. Drill into Explainable AI and Scenario Simulator for technical decomposition.`
  );
}

export default function EconomicAssistant({ context }: { context?: AssistantContext }) {
  const role = useAuthStore((s) => s.user?.role);
  const analyst = isAnalystRole(role);
  const prompts = analyst ? ANALYST_PROMPTS : ORDINARY_PROMPTS;
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const ctx = useMemo(() => context ?? {}, [context]);

  const ask = async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setLoading(true);
    setQuestion(trimmed);
    try {
      const country = useAuthStore.getState().user?.country ?? "NG";
      const { data } = await intelligenceAPI.naturalLanguageQuery({
        question: trimmed,
        country_code: country,
      });
      setAnswer(String(data.answer ?? ""));
    } catch {
      setAnswer(
        analyst ? buildAnalystAnswer(trimmed, ctx) : buildOrdinaryAnswer(trimmed, ctx),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="glass-panel rounded-2xl p-6">
      <div className="flex items-center gap-2">
        <MessageCircle className="h-5 w-5 text-[var(--text-primary)]" />
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">
          {analyst ? "Economic Intelligence Assistant" : "Ask About Your Forecast"}
        </h2>
      </div>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        {analyst
          ? "Technical and model-based explanations for your current forecast."
          : "Plain-English answers about how prices may affect your life."}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {prompts.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => ask(prompt)}
            className="rounded-full border border-[var(--border-primary)] px-3 py-1.5 text-xs text-[var(--text-muted)] transition hover:border-[var(--border-active)] hover:text-[var(--text-primary)]"
          >
            {prompt}
          </button>
        ))}
      </div>

      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          ask(question);
        }}
      >
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={
            analyst
              ? "Ask about CPI, model drivers, confidence intervals..."
              : "Ask what rising prices mean for you..."
          }
          className="app-input flex-1 rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)]"
        />
        <button
          type="submit"
          disabled={loading || !question.trim()}
          className="btn-primary rounded-xl px-4 py-2.5 disabled:opacity-50"
          aria-label="Send question"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>

      {answer && (
        <div className="mt-4 rounded-xl border border-[var(--border-primary)] bg-[var(--accent-faint)] p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-faint)]">
            <Sparkles className="h-3.5 w-3.5" />
            {analyst ? "Technical response" : "Plain-language response"}
          </div>
          <p className="text-sm leading-relaxed text-[var(--text-secondary)]">{answer}</p>
        </div>
      )}
    </section>
  );
}