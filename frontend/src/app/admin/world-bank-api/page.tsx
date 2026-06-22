"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Loader2,
  Globe2,
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
import { worldBankAPI, type WorldBankApiConfig, type WorldBankApiHealth } from "@/lib/api";
import { handleApiError } from "@/lib/errorHandler";
import { toast } from "@/lib/feedback";
import { formatDateTime } from "@/lib/dates";
import { apiHealthSentiment, sentimentClass } from "@/lib/financialColors";
import { runBackgroundSync } from "@/lib/syncPolling";

const DEFAULT_INDICATORS = [
  "FP.CPI.TOTL.ZG",
  "NY.GDP.MKTP.KD.ZG",
  "NY.GDP.MKTP.CD",
  "GC.DOD.TOTL.GD.ZS",
  "SL.UEM.TOTL.ZS",
  "BN.CAB.XOKA.GD.ZS",
];

export default function WorldBankApiAdminPage() {
  const [config, setConfig] = useState<WorldBankApiConfig | null>(null);
  const [health, setHealth] = useState<WorldBankApiHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [toggling, setToggling] = useState(false);

  const [baseUrl, setBaseUrl] = useState("https://api.worldbank.org/v2");
  const [refreshInterval, setRefreshInterval] = useState("daily");
  const [syncEnabled, setSyncEnabled] = useState(true);
  const [countryCodes, setCountryCodes] = useState("NG, US, GB, GH");
  const [indicators, setIndicators] = useState(DEFAULT_INDICATORS.join(", "));
  const [dateRange, setDateRange] = useState("2015:2025");
  const [logs, setLogs] = useState<Array<Record<string, unknown>>>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cfgRes, healthRes, logsRes] = await Promise.all([
        worldBankAPI.getConfig(),
        worldBankAPI.getHealth(),
        worldBankAPI.getLogs({ limit: 20 }),
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
      if (sc.date_range) setDateRange(sc.date_range);
      setLogs((logsRes.data as Array<Record<string, unknown>>) ?? []);
    } catch (err) {
      setError(handleApiError(err, "Failed to load World Bank API settings."));
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
      const { data } = await worldBankAPI.updateConfig({
        base_url: baseUrl,
        refresh_interval: refreshInterval,
        sync_enabled: syncEnabled,
        source_config: {
          country_codes: countryCodes.split(",").map((c) => c.trim().toUpperCase()).filter(Boolean),
          indicators: indicators.split(",").map((i) => i.trim()).filter(Boolean),
          date_range: dateRange,
        },
      });
      setConfig(data);
      toast.success("World Bank API settings saved");
      setHealth((await worldBankAPI.getHealth()).data);
    } catch (err) {
      handleApiError(err, "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const { data } = await worldBankAPI.testConnection({ country_code: "NG" });
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
      await runBackgroundSync(worldBankAPI.sync, worldBankAPI.getHealth, {
        started: "World Bank sync started",
        complete: "World Bank sync complete",
        failed: "World Bank sync failed",
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
      const { data } = enable ? await worldBankAPI.enable() : await worldBankAPI.disable();
      setConfig(data);
      toast.success(enable ? "World Bank API enabled" : "World Bank API disabled");
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
        title="World Bank API Settings"
        description="Sync GDP, inflation, unemployment, and fiscal indicators from World Bank Open Data for reports and analytics."
        icon={Globe2}
      />

      <motion.div className="glass-panel rounded-2xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <StatusIcon className="h-5 w-5" style={{ color: sentimentClass(sentiment) }} />
            <div>
              <p className="text-sm font-semibold text-[var(--text-primary)]">
                {health?.provider ?? "World Bank Open Data"} — {config?.is_active ? "Active" : "Inactive"}
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                {health?.last_sync ? `Last sync ${formatDateTime(health.last_sync)}` : "Never synced"}
                {health?.countries_synced != null && ` · ${health.countries_synced} countries stored`}
                {config?.source_config?.country_codes?.length
                  ? ` · ${config.source_config.country_codes.length} configured`
                  : ""}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {config?.is_active ? (
              <button type="button" disabled={toggling} onClick={() => void handleToggle(false)} className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm">
                <PowerOff className="h-4 w-4" /> Disable
              </button>
            ) : (
              <button type="button" disabled={toggling} onClick={() => void handleToggle(true)} className="btn-primary inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm">
                <Power className="h-4 w-4" /> Enable
              </button>
            )}
            <button type="button" disabled={syncing} onClick={() => void handleSync()} className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm">
              {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Sync Now
            </button>
          </div>
        </div>
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="glass-panel space-y-4 rounded-2xl p-6">
          <h2 className="font-semibold text-[var(--text-primary)]">Connection</h2>
          <p className="text-xs text-[var(--text-muted)]">Public API — no key required.</p>
          <div>
            <label className="text-xs text-[var(--text-muted)]">Base URL</label>
            <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} className="app-input mt-1 w-full rounded-xl px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-[var(--text-muted)]">Refresh interval</label>
            <select value={refreshInterval} onChange={(e) => setRefreshInterval(e.target.value)} className="app-input mt-1 w-full rounded-xl px-3 py-2 text-sm">
              <option value="hourly">Hourly</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--text-muted)]">Automatic sync</span>
            <ToggleSwitch checked={syncEnabled} onChange={setSyncEnabled} aria-label="Automatic sync" />
          </div>
        </section>

        <section className="glass-panel space-y-4 rounded-2xl p-6">
          <h2 className="font-semibold text-[var(--text-primary)]">Data Scope</h2>
          <div>
            <label className="text-xs text-[var(--text-muted)]">Countries (ISO2)</label>
            <textarea value={countryCodes} onChange={(e) => setCountryCodes(e.target.value)} rows={2} className="app-input mt-1 w-full rounded-xl px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-[var(--text-muted)]">Indicators</label>
            <textarea value={indicators} onChange={(e) => setIndicators(e.target.value)} rows={3} className="app-input mt-1 w-full rounded-xl px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-[var(--text-muted)]">Date range</label>
            <input value={dateRange} onChange={(e) => setDateRange(e.target.value)} placeholder="2015:2025" className="app-input mt-1 w-full rounded-xl px-3 py-2 text-sm" />
          </div>
        </section>
      </div>

      <div className="flex flex-wrap gap-3">
        <button type="button" disabled={saving} onClick={() => void handleSave()} className="btn-primary inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Settings
        </button>
        <button type="button" disabled={testing} onClick={() => void handleTest()} className="inline-flex items-center gap-2 rounded-xl border px-5 py-2.5 text-sm">
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
          <div className="overflow-x-auto text-xs">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[var(--text-faint)]">
                  <th className="pb-2 pr-4">Time</th>
                  <th className="pb-2 pr-4">Endpoint</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2">Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={String(log.id)} className="border-t border-[var(--border-subtle)]">
                    <td className="py-2 pr-4 text-[var(--text-muted)]">{formatDateTime(String(log.request_timestamp ?? ""))}</td>
                    <td className="py-2 pr-4">{String(log.endpoint ?? "")}</td>
                    <td className="py-2 pr-4">{log.success ? <span className="text-green-500">OK</span> : <span className="text-red-500">Failed</span>}</td>
                    <td className="py-2 text-[var(--text-muted)]">{String(log.error_message ?? `${log.response_time_ms ?? "—"} ms`)}</td>
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