"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, Loader2, Plug, RefreshCw } from "lucide-react";
import { integrationsAPI, type PlatformIntegration } from "@/lib/api";
import { toast } from "@/lib/feedback";
import { formatDateTime } from "@/lib/dates";
import { apiHealthSentiment, sentimentClass } from "@/lib/financialColors";
import { runBackgroundSync } from "@/lib/syncPolling";

export default function PlatformIntegrationsSection() {
  const [data, setData] = useState<{
    total: number;
    active: number;
    healthy: number;
    warning: number;
    offline: number;
    integrations: PlatformIntegration[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: res } = await integrationsAPI.list();
      setData(res);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSync = async (integration: PlatformIntegration) => {
    if (!integration.supports_sync) return;
    setSyncingId(integration.id);
    try {
      if (integration.supports_background_sync) {
        await runBackgroundSync(
          () => integrationsAPI.sync(integration.id),
          async () => {
            const { data: fresh } = await integrationsAPI.list();
            const item = fresh.integrations.find((i) => i.id === integration.id);
            return { data: { sync_status: item?.sync_status, countries_synced: item?.metrics?.countries_synced as number | undefined } };
          },
          {
            started: `${integration.name} sync started`,
            complete: `${integration.name} sync complete`,
            failed: `${integration.name} sync failed`,
          },
        );
      } else {
        const { data: result } = await integrationsAPI.sync(integration.id);
        const r = result as { success?: boolean; message?: string };
        if (r.success !== false) toast.success(r.message ?? "Sync complete");
        else toast.error(r.message ?? "Sync failed");
      }
      await load();
    } catch {
      toast.error("Sync failed");
    } finally {
      setSyncingId(null);
    }
  };

  if (loading) {
    return (
      <section className="glass-panel flex min-h-[120px] items-center justify-center rounded-2xl p-6">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--text-muted)]" />
      </section>
    );
  }

  if (!data) return null;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Plug className="h-5 w-5 text-[var(--text-primary)]" />
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Platform Integrations</h2>
            <p className="text-xs text-[var(--text-muted)]">
              {data.active} active · {data.healthy} healthy · {data.warning} warning · {data.offline} offline
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.integrations.map((integration) => {
          const sentiment = apiHealthSentiment(
            integration.health_status === "healthy"
              ? "healthy"
              : integration.health_status === "degraded"
                ? "degraded"
                : integration.health_status,
          );
          return (
            <div key={integration.id} className="glass-panel rounded-2xl p-5">
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-[var(--text-primary)]">{integration.name}</p>
                  <p className="text-xs text-[var(--text-muted)]">{integration.provider}</p>
                </div>
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-medium uppercase"
                  style={{
                    color: sentimentClass(sentiment),
                    backgroundColor: sentimentClass(sentiment, "bg"),
                  }}
                >
                  {integration.health_status}
                </span>
              </div>
              <p className="mb-3 line-clamp-2 text-xs text-[var(--text-muted)]">{integration.description}</p>
              <p className="mb-4 text-[10px] text-[var(--text-faint)]">
                {integration.is_active ? "Active" : "Inactive"}
                {integration.last_sync ? ` · Last sync ${formatDateTime(integration.last_sync)}` : ""}
                {integration.metrics?.countries_synced != null
                  ? ` · ${integration.metrics.countries_synced} countries`
                  : ""}
                {integration.metrics?.articles_retrieved != null
                  ? ` · ${integration.metrics.articles_retrieved} articles`
                  : ""}
              </p>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={integration.admin_path}
                  className="inline-flex items-center gap-1 rounded-xl border px-3 py-1.5 text-xs"
                >
                  Manage <ExternalLink className="h-3 w-3" />
                </Link>
                {integration.supports_sync && (
                  <button
                    type="button"
                    disabled={syncingId === integration.id}
                    onClick={() => void handleSync(integration)}
                    className="inline-flex items-center gap-1 rounded-xl border px-3 py-1.5 text-xs"
                  >
                    {syncingId === integration.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3 w-3" />
                    )}
                    Sync
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}