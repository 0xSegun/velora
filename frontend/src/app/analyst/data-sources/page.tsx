"use client";

import { useEffect, useState } from "react";
import { Database, Loader2 } from "lucide-react";
import { economicDataAPI } from "@/lib/api";
import PageHeader from "@/components/ui/PageHeader";

export default function AnalystDataSourcesPage() {
  const [sources, setSources] = useState<string[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    economicDataAPI
      .getLatest()
      .then(({ data }) => {
        const rows = Array.isArray(data) ? data : [];
        setCount(rows.length);
        const unique = [...new Set(rows.map((r: { source?: string }) => String(r.source ?? "Unknown")))];
        setSources(unique);
      })
      .catch(() => {
        setSources(["FRED", "CBN", "NBS", "Velora TS-Transformer"]);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Intelligence"
        title="Data Sources"
        description="Feeds powering forecasts — FRED, national statistics, exchange rates, and platform datasets."
        icon={Database}
      />
      {loading ? (
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-[var(--text-muted)]" />
      ) : (
        <div className="glass-panel rounded-2xl p-6">
          <p className="text-sm text-[var(--text-muted)]">{count} country snapshots indexed</p>
          <ul className="mt-4 space-y-2">
            {(sources.length ? sources : ["FRED", "CBN", "NBS", "ExchangeRate-API"]).map((s) => (
              <li
                key={s}
                className="flex items-center justify-between rounded-xl border border-[var(--border-primary)] px-4 py-3 text-sm"
              >
                <span className="text-[var(--text-primary)]">{s}</span>
                <span className="text-xs text-[var(--text-faint)]">Active</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}