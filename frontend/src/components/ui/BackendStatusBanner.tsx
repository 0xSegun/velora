"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

type HealthStatus = "healthy" | "degraded" | "offline" | "checking";

export default function BackendStatusBanner() {
  const [status, setStatus] = useState<HealthStatus>("checking");
  const [detail, setDetail] = useState<string | null>(null);

  const check = useCallback(async () => {
    setStatus("checking");
    try {
      const res = await fetch(`${API_URL}/health`, { cache: "no-store" });
      if (!res.ok) {
        setStatus("offline");
        setDetail("API returned an error. Restart the backend server.");
        return;
      }
      const data = (await res.json()) as {
        status?: string;
        database?: string;
      };
      if (data.database === "disconnected") {
        setStatus("degraded");
        setDetail("PostgreSQL is not running. Start the database, then refresh.");
      } else if (data.status === "healthy") {
        setStatus("healthy");
        setDetail(null);
      } else {
        setStatus("degraded");
        setDetail("API is running but not fully healthy. Some pages may fail to load.");
      }
    } catch {
      setStatus("offline");
      setDetail(
        "Cannot reach the API. Run scripts/start_dev.ps1 or start the backend on port 8000.",
      );
    }
  }, []);

  useEffect(() => {
    void check();
    const id = window.setInterval(() => void check(), 30000);
    return () => window.clearInterval(id);
  }, [check]);

  if (status === "healthy" || status === "checking") return null;

  return (
    <div
      role="alert"
      className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200"
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <div>
            <p className="font-medium text-[var(--text-primary)]">
              {status === "offline" ? "Backend offline" : "Database disconnected"}
            </p>
            {detail && (
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">{detail}</p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => void check()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] transition hover:bg-amber-500/10"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Check again
        </button>
      </div>
    </div>
  );
}