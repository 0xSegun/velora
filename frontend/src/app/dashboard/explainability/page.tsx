"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Microscope, Loader2, Brain } from "lucide-react";
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
import { predictionsAPI, intelligenceAPI } from "@/lib/api";
import { chartAxisLine, chartAxisTick, chartGridStroke } from "@/lib/chartTheme";

interface PredictionSummary {
  id: string;
  country_code: string;
  inflation_rate: number;
  created_at: string;
}

export default function ExplainabilityPage() {
  const [predictions, setPredictions] = useState<PredictionSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [explain, setExplain] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  const loadPredictions = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await predictionsAPI.getHistory({ per_page: 10 });
      const items = (data.predictions ?? []) as PredictionSummary[];
      setPredictions(items);
      if (items.length && !selectedId) {
        setSelectedId(items[0].id);
      }
    } catch {
      setPredictions([]);
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  const loadExplain = useCallback(async (id: string) => {
    try {
      const { data } = await intelligenceAPI.getExplainability(id);
      setExplain(data);
    } catch {
      setExplain(null);
    }
  }, []);

  useEffect(() => {
    void loadPredictions();
  }, [loadPredictions]);

  useEffect(() => {
    if (selectedId) void loadExplain(selectedId);
  }, [selectedId, loadExplain]);

  const importance = (explain?.feature_importance as Array<Record<string, unknown>>) ?? [];
  const chartData = importance.map((f) => ({
    name: String(f.feature),
    value: Number(f.importance),
  }));

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--text-muted)]" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-[var(--text-primary)]">
          <Microscope className="h-6 w-6" /> Explainable AI Center
        </h1>
        <p className="text-sm text-[var(--text-muted)]">
          Attention mechanism visualization and TS-Transformer reasoning
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {predictions.map((p) => (
          <button
            key={p.id}
            onClick={() => setSelectedId(p.id)}
            className={`rounded-xl px-4 py-2 text-sm transition ${
              selectedId === p.id
                ? "bg-[var(--accent-faint)] border border-[var(--border-hover)]"
                : "border border-[var(--border-primary)] hover:bg-[var(--glass-bg)]"
            }`}
          >
            {p.country_code} · {p.inflation_rate}%
          </button>
        ))}
      </div>

      {explain ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="glass-card rounded-xl hover:transform-none p-5">
            <h2 className="mb-4 text-sm font-semibold">Feature Importance Ranking</h2>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} layout="vertical">
                <CartesianGrid stroke={chartGridStroke} strokeDasharray="3 3" />
                <XAxis type="number" tick={chartAxisTick} axisLine={chartAxisLine} unit="%" />
                <YAxis type="category" dataKey="name" width={120} tick={chartAxisTick} />
                <Tooltip />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={i === 0 ? "var(--text-primary)" : "var(--text-muted)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-4">
            <div className="glass-card rounded-xl hover:transform-none p-5">
              <h2 className="mb-2 text-sm font-semibold">AI Reasoning Summary</h2>
              <p className="text-sm text-[var(--text-secondary)]">
                {String(explain.prediction_explanation)}
              </p>
            </div>
            <div className="glass-card rounded-xl hover:transform-none p-5">
              <h2 className="mb-2 text-sm font-semibold">Economic Interpretation</h2>
              <p className="text-sm text-[var(--text-secondary)]">
                {String(explain.economic_interpretation)}
              </p>
            </div>
            <div className="glass-card rounded-xl hover:transform-none p-5">
              <h2 className="mb-2 text-sm font-semibold">Confidence Analysis</h2>
              <pre className="text-xs text-[var(--text-muted)] overflow-auto">
                {JSON.stringify(explain.confidence_analysis, null, 2)}
              </pre>
            </div>
            {selectedId && (
              <Link
                href={`/dashboard/predictions/${selectedId}`}
                className="inline-flex items-center gap-2 text-sm text-[var(--text-primary)] hover:underline"
              >
                <Brain className="h-4 w-4" /> View full forecast breakdown
              </Link>
            )}
          </div>

          {(explain.attention_heatmap as number[][])?.length > 0 && (
            <div className="lg:col-span-2 glass-card rounded-xl hover:transform-none p-5">
              <h2 className="mb-4 text-sm font-semibold">Attention Heatmap</h2>
              <div className="overflow-x-auto">
                <div className="inline-grid gap-0.5" style={{
                  gridTemplateColumns: `repeat(${(explain.attention_heatmap as number[][])[0]?.length ?? 1}, 1.5rem)`,
                }}>
                  {(explain.attention_heatmap as number[][]).flatMap((row, ri) =>
                    row.map((val, ci) => (
                      <div
                        key={`${ri}-${ci}`}
                        className="h-6 w-6 rounded-sm"
                        style={{
                          backgroundColor: `rgba(255,255,255,${Math.min(1, val * 2)})`,
                        }}
                        title={`${val.toFixed(3)}`}
                      />
                    ))
                  )}
                </div>
              </div>
              <p className="mt-2 text-xs text-[var(--text-muted)]">
                Model: {String(explain.model_version)} · Brighter cells = higher attention weight
              </p>
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-[var(--text-muted)]">
          Run a prediction to view explainability analysis.
        </p>
      )}
    </div>
  );
}