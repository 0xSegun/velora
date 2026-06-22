"use client";

import { useEffect, useState } from "react";
import { Cpu, Loader2 } from "lucide-react";
import { adminAPI } from "@/lib/api";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";

interface ModelRow {
  name?: string;
  version?: string;
  accuracy?: number;
  rmse?: number;
  mae?: number;
  status?: string;
}

export default function AnalystModelsPage() {
  const [models, setModels] = useState<ModelRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminAPI
      .getModels()
      .then(({ data }) => {
        const list = (data as { models?: ModelRow[] })?.models ?? (Array.isArray(data) ? data : []);
        setModels(list as ModelRow[]);
      })
      .catch(() => setModels([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="AI Engine"
        title="Model Performance"
        description="TS-Transformer training metrics, deployment status, and version history."
        icon={Cpu}
      />
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--text-muted)]" />
        </div>
      ) : models.length === 0 ? (
        <EmptyState
          icon={Cpu}
          title="No model metrics"
          description="Train the TS-Transformer from the admin Training Center to populate performance data."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {models.map((m, i) => (
            <div key={i} className="glass-panel rounded-2xl p-5">
              <p className="font-semibold text-[var(--text-primary)]">{m.name ?? "TS-Transformer"}</p>
              <p className="text-xs text-[var(--text-muted)]">v{m.version ?? "—"} · {m.status ?? "unknown"}</p>
              <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                <div>
                  <p className="text-[var(--text-faint)]">Accuracy</p>
                  <p>{m.accuracy != null ? `${(m.accuracy * 100).toFixed(1)}%` : "—"}</p>
                </div>
                <div>
                  <p className="text-[var(--text-faint)]">RMSE</p>
                  <p>{m.rmse?.toFixed(3) ?? "—"}</p>
                </div>
                <div>
                  <p className="text-[var(--text-faint)]">MAE</p>
                  <p>{m.mae?.toFixed(3) ?? "—"}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}