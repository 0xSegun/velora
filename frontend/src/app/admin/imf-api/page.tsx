"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Loader2,
  Landmark,
  Play,
  RefreshCw,
  Save,
  Power,
  PowerOff,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ScrollText,
} from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import PageLoadError from "@/components/ui/PageLoadError";
import ToggleSwitch from "@/components/ui/ToggleSwitch";
import { imfAPI, type ImfApiConfig, type ImfApiHealth } from "@/lib/api";
import { handleApiError } from "@/lib/errorHandler";
import { toast } from "@/lib/feedback";
import { formatDateTime } from "@/lib/dates";
import { apiHealthSentiment, sentimentClass } from "@/lib/financialColors";
import { runBackgroundSync } from "@/lib/syncPolling";

interface ImfApiLog {
  id: string;
  endpoint: string;
  request_timestamp: string;
  response_time_ms?: number | null;
  success: boolean;
  status_code?: number | null;
  countries_synced: number;
  error_message?: string | null;
}

const DEFAULT_INDICATORS = [
  "PCPIPCH",
  "NGDP_RPCH",
  "NGDPD",
  "GGXWDG_NGDP",
  "LUR",
  "BCA_NGDPD",
];

export default function ImfApiAdminPage() {
  const [config, setConfig] = useState<ImfApiConfig | null>(null);
  const [health, setHealth] = useState<ImfApiHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [toggling, setToggling] = useState(false);

  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("https://www.imf.org/external/datamapper/api/v1");
  const [refreshInterval, setRefreshInterval] = useState("daily");
  const [syncEnabled, setSyncEnabled] = useState(true);
  const [countryCodes, setCountryCodes] = useState("NG, US, GB, GH");
  const [indicators, setIndicators] = useState(DEFAULT_INDICATORS.join(", "));
  const [preferredYear, setPreferredYear] = useState("");
  const [logs, setLogs] = useState<ImfApiLog[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cfgRes, healthRes, logsRes] = await Promise.all([
        imfAPI.getConfig(),
        imfAPI.getHealth(),
        imfAPI.getLogs({ limit: 20 }),
      ]);
      const cfg = cfgRes.data;
      setConfig(cfg);
      setHealth(healthRes.data);
      setBaseUrl(cfg.base_url);
      setRefreshInterval(cfg.refresh_interval);
      setSyncEnabled(cfg.sync_enabled);
      const sc = cfg.source_config ?? {};
      if (sc.country_codes?.length) setCountryCodes(sc.country_codes.join(", "));
      if (sc.indicators?.length) setIndicators(sc.indicators.join(", "));
      if (sc.preferred_year) setPreferredYear(String(sc.preferred_year));
      setLogs((logsRes.data as ImfApiLog[]) ?? []);
    } catch (err) {
      setError(handleApiError(err, "Failed to load IMF API settings."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        base_url: baseUrl,
        refresh_interval: refreshInterval,
        sync_enabled: syncEnabled,
        source_config: {
          country_codes: countryCodes.split(",").map((c) => c.trim().toUpperCase()).filter(Boolean),
          indicators: indicators.split(",").map((i) => i.trim()).filter(Boolean),
          preferred_year: preferredYear ? parseInt(preferredYear, 10) : null,
        },
      };
      if (apiKey.trim()) payload.api_key = apiKey.trim();
      const { data } = await imfAPI.updateConfig(payload);
      setConfig(data);
      setApiKey("");
      toast.success("IMF API settings saved");
      const healthRes = await imfAPI.getHealth();
      setHealth(healthRes.data);
    } catch (err) {
      handleApiError(err, "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const { data } = await imfAPI.testConnection(
        apiKey.trim() ? { api_key: apiKey, country_code: "NG" } : { country_code: "NG" },
      );
      if (data.success) toast.success(data.message);
      else toast.error(data.message);
    } catch (err) {
      handleApiError(err, "Connection test failed");
    } finally {
      setTesting(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await runBackgroundSync(imfAPI.sync, imfAPI.getHealth, {
        started: "IMF sync started",
        complete: "IMF sync complete",
        failed: "IMF sync failed",
      });
      await load();
    } catch (err) {
      handleApiError(err, "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const handleToggle = async (enable: boolean) => {
    setToggling(true);
    try {
      const { data } = enable ? await imfAPI.enable() : await imfAPI.disable();
      setConfig(data);
      toast.success(enable ? "IMF API enabled" : "IMF API disabled");
      await load();
    } catch (err) {
      handleApiError(err, "Toggle failed");
    } finally {
      setToggling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--text-muted)]" />
      </div>
    );
  }

  if (error) return <PageLoadError description={error} onRetry={() => void load()} />;

  const status = health?.status ?? "inactive";
  const sentiment = apiHealthSentiment(status === "green" ? "healthy" : status);
  const StatusIcon = sentiment === "positive" ? CheckCircle2 : sentiment === "caution" ? AlertCircle : XCircle;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Integrations"
        title="IMF API Settings"
        description="Configure IMF DataMapper for GDP, inflation, debt, unemployment, and fiscal indicators used in reports and predictions."
        icon={Landmark}
      />

      <motion.div className="glass-panel rounded-2xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <StatusIcon className="h-5 w-5" style={{ color: sentimentClass(sentiment) }} />
            <div>
              <p className="text-sm font-semibold text-[var(--text-primary)]">
                {health?.provider ?? "IMF DataMapper"} — {config?.is_active ? "Active" : "Inactive"}
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                {health?.last_sync
                  ? `Last sync ${formatDateTime(health.last_sync)}`
                  : "Never synced"}
                {health?.countries_synced != null &&
                  ` · ${health.countries_synced} countries stored`}
                {config?.source_config?.country_codes?.length
                  ? ` · ${config.source_config.country_codes.length} configured`
                  : ""}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {config?.is_active ? (
              <button
                type="button"
                disabled={toggling}
                onClick={() => void handleToggle(false)}
                className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm"
              >
                <PowerOff className="h-4 w-4" /> Disable
              </button>
            ) : (
              <button
                type="button"
                disabled={toggling}
                onClick={() => void handleToggle(true)}
                className="btn-primary inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm"
              >
                <Power className="h-4 w-4" /> Enable
              </button>
            )}
            <button
              type="button"
              disabled={syncing}
              onClick={() => void handleSync()}
              className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm"
            >
              {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Sync Now
            </button>
          </div>
        </div>
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="glass-panel space-y-4 rounded-2xl p-6">
          <h2 className="font-semibold text-[var(--text-primary)]">Connection</h2>
          <div>
            <label className="text-xs text-[var(--text-muted)]">API Key (optional)</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={config?.api_key_set ? "•••••••• (leave blank to keep)" : "IMF DataMapper key if required"}
              className="app-input mt-1 w-full rounded-xl px-3 py-2 text-sm"
            />
            <p className="mt-1 text-[10px] text-[var(--text-faint)]">
              Or set IMF_API_KEY in backend .env
            </p>
          </div>
          <div>
            <label className="text-xs text-[var(--text-muted)]">Base URL</label>
            <input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              className="app-input mt-1 w-full rounded-xl px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-[var(--text-muted)]">Refresh interval</label>
            <select
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(e.target.value)}
              className="app-input mt-1 w-full rounded-xl px-3 py-2 text-sm"
            >
              <option value="hourly">Hourly</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--text-muted)]">Automatic sync</span>
            <ToggleSwitch
              checked={syncEnabled}
              onChange={setSyncEnabled}
              aria-label="Automatic sync"
            />
          </div>
        </section>

        <section className="glass-panel space-y-4 rounded-2xl p-6">
          <h2 className="font-semibold text-[var(--text-primary)]">Data Scope</h2>
          <p className="text-xs text-[var(--text-muted)]">
            ISO2 country codes and IMF indicator codes (PCPIPCH = inflation, NGDP_RPCH = GDP growth, etc.).
          </p>
          <div>
            <label className="text-xs text-[var(--text-muted)]">Countries (comma-separated)</label>
            <textarea
              value={countryCodes}
              onChange={(e) => setCountryCodes(e.target.value)}
              rows={2}
              className="app-input mt-1 w-full rounded-xl px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-[var(--text-muted)]">Indicators</label>
            <textarea
              value={indicators}
              onChange={(e) => setIndicators(e.target.value)}
              rows={3}
              className="app-input mt-1 w-full rounded-xl px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-[var(--text-muted)]">Preferred data year (optional)</label>
            <input
              type="number"
              value={preferredYear}
              onChange={(e) => setPreferredYear(e.target.value)}
              placeholder="Latest available"
              className="app-input mt-1 w-full rounded-xl px-3 py-2 text-sm"
            />
          </div>
        </section>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={saving}
          onClick={() => void handleSave()}
          className="btn-primary inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Settings
        </button>
        <button
          type="button"
          disabled={testing}
          onClick={() => void handleTest()}
          className="inline-flex items-center gap-2 rounded-xl border px-5 py-2.5 text-sm"
        >
          {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          Test Connection
        </button>
      </div>

      <section className="glass-panel rounded-2xl p-6">
        <div className="mb-4 flex items-center gap-2">
          <ScrollText className="h-4 w-4 text-[var(--text-muted)]" />
          <h2 className="font-semibold text-[var(--text-primary)]">Sync Logs</h2>
        </div>
        {logs.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">No sync activity yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-[var(--text-faint)]">
                  <th className="pb-2 pr-4 font-medium">Time</th>
                  <th className="pb-2 pr-4 font-medium">Endpoint</th>
                  <th className="pb-2 pr-4 font-medium">Status</th>
                  <th className="pb-2 pr-4 font-medium">Countries</th>
                  <th className="pb-2 font-medium">Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-t border-[var(--border-subtle)]">
                    <td className="py-2 pr-4 text-[var(--text-muted)]">
                      {formatDateTime(log.request_timestamp)}
                    </td>
                    <td className="py-2 pr-4">{log.endpoint}</td>
                    <td className="py-2 pr-4">
                      {log.success ? (
                        <span className="text-green-500">OK</span>
                      ) : (
                        <span className="text-red-500">Failed</span>
                      )}
                    </td>
                    <td className="py-2 pr-4">{log.countries_synced}</td>
                    <td className="py-2 text-[var(--text-muted)]">
                      {log.error_message ?? `${log.response_time_ms ?? "—"} ms`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}