"use client";

import { useEffect, useState } from "react";
import { Plug, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import { formatDateTime } from "@/lib/dates";

interface HealthPayload {
  status?: string;
  database?: string;
  timestamp?: string;
}

export default function AnalystApiStatusPage() {
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"}/health`)
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setHealth({ status: "unavailable" }))
      .finally(() => setLoading(false));
  }, []);

  const ok = health?.status === "healthy";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Platform"
        title="API Status"
        description="Read-only view of core API and database connectivity (configuration is admin-only)."
        icon={Plug}
      />
      {loading ? (
        <Loader2 className="mx-auto h-8 w-8 animate-spin" />
      ) : (
        <div className="glass-panel rounded-2xl p-6">
          <div className="flex items-center gap-3">
            {ok ? (
              <CheckCircle2 className="h-6 w-6 text-emerald-500" />
            ) : (
              <AlertCircle className="h-6 w-6 text-amber-500" />
            )}
            <div>
              <p className="font-semibold text-[var(--text-primary)]">
                Platform API — {health?.status ?? "unknown"}
              </p>
              <p className="text-sm text-[var(--text-muted)]">
                Database: {health?.database ?? "—"} · Checked {formatDateTime(health?.timestamp ?? null)}
              </p>
            </div>
          </div>
          <div className="mt-6 space-y-2 text-sm text-[var(--text-muted)]">
            <p>FRED, Exchange Rate, and email integrations are managed in the Admin API Configuration center.</p>
            <p>Analysts consume synchronized data through predictions and analytics — no API keys are exposed here.</p>
          </div>
        </div>
      )}
    </div>
  );
}