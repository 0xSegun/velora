"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Loader2,
  Newspaper,
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
import { newsAPI, type NewsApiConfig, type NewsApiHealth } from "@/lib/api";
import { handleApiError } from "@/lib/errorHandler";
import { toast } from "@/lib/feedback";
import { formatDateTime } from "@/lib/dates";
import { apiHealthSentiment, sentimentClass } from "@/lib/financialColors";

const PROVIDERS = [
  { id: "newsapi", label: "NewsAPI.org", url: "https://newsapi.org/v2", hint: "Reuters, Bloomberg, FT, CNBC" },
  { id: "gnews", label: "GNews.io", url: "https://gnews.io/api/v4", hint: "Global economic headlines" },
];

const PRESET_SOURCES = [
  "reuters", "bloomberg", "financial-times", "cnbc",
  "the-wall-street-journal", "business-insider", "bbc-news",
];

interface NewsApiLog {
  id: string;
  endpoint: string;
  request_timestamp: string;
  response_time_ms?: number | null;
  success: boolean;
  status_code?: number | null;
  articles_fetched: number;
  error_message?: string | null;
}

export default function NewsApiAdminPage() {
  const [config, setConfig] = useState<NewsApiConfig | null>(null);
  const [health, setHealth] = useState<NewsApiHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [toggling, setToggling] = useState(false);

  const [apiKey, setApiKey] = useState("");
  const [provider, setProvider] = useState("newsapi");
  const [baseUrl, setBaseUrl] = useState("https://newsapi.org/v2");
  const [refreshInterval, setRefreshInterval] = useState("hourly");
  const [syncEnabled, setSyncEnabled] = useState(true);
  const [sources, setSources] = useState(PRESET_SOURCES.join(", "));
  const [queries, setQueries] = useState(
    "inflation, interest rates, GDP, exchange rate, oil prices, central bank",
  );
  const [logs, setLogs] = useState<NewsApiLog[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cfgRes, healthRes, logsRes] = await Promise.all([
        newsAPI.getConfig(),
        newsAPI.getHealth(),
        newsAPI.getLogs({ limit: 20 }),
      ]);
      const cfg = cfgRes.data;
      setConfig(cfg);
      setHealth(healthRes.data);
      setProvider(cfg.provider);
      setBaseUrl(cfg.base_url);
      setRefreshInterval(cfg.refresh_interval);
      setSyncEnabled(cfg.sync_enabled);
      const sc = cfg.source_config ?? {};
      if (sc.sources?.length) setSources(sc.sources.join(", "));
      if (sc.queries?.length) setQueries(sc.queries.join(", "));
      setLogs((logsRes.data as NewsApiLog[]) ?? []);
    } catch (err) {
      setError(handleApiError(err, "Failed to load News API settings."));
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
        provider,
        base_url: baseUrl,
        refresh_interval: refreshInterval,
        sync_enabled: syncEnabled,
        source_config: {
          sources: sources.split(",").map((s) => s.trim()).filter(Boolean),
          queries: queries.split(",").map((q) => q.trim()).filter(Boolean),
        },
      };
      if (apiKey.trim()) payload.api_key = apiKey.trim();
      const { data } = await newsAPI.updateConfig(payload);
      setConfig(data);
      setApiKey("");
      toast.success("News API settings saved");
      const healthRes = await newsAPI.getHealth();
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
      const { data } = await newsAPI.testConnection(apiKey.trim() ? { api_key: apiKey } : {});
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
      const { data } = await newsAPI.sync();
      const result = data as { success?: boolean; message?: string };
      if (result.success) toast.success(result.message ?? "Sync complete");
      else toast.error(result.message ?? "Sync failed");
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
      const { data } = enable ? await newsAPI.enable() : await newsAPI.disable();
      setConfig(data);
      toast.success(enable ? "News API enabled" : "News API disabled");
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
        title="News API Settings"
        description="Connect NewsAPI.org or GNews.io to pull Reuters, Bloomberg, FT, CNBC, and other economic headlines into the platform."
        icon={Newspaper}
      />

      <motion.div className="glass-panel rounded-2xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <StatusIcon className="h-5 w-5" style={{ color: sentimentClass(sentiment) }} />
            <div>
              <p className="text-sm font-semibold text-[var(--text-primary)]">
                {health?.provider ?? "News API"} — {config?.is_active ? "Active" : "Inactive"}
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                {health?.last_sync
                  ? `Last sync ${formatDateTime(health.last_sync)}`
                  : "Never synced"}
                {health?.articles_retrieved != null &&
                  ` · ${health.articles_retrieved} articles stored`}
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
          <h2 className="font-semibold text-[var(--text-primary)]">Provider</h2>
          <select
            value={provider}
            onChange={(e) => {
              const p = PROVIDERS.find((x) => x.id === e.target.value);
              setProvider(e.target.value);
              if (p) setBaseUrl(p.url);
            }}
            className="app-input w-full rounded-xl px-3 py-2 text-sm"
          >
            {PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label} — {p.hint}
              </option>
            ))}
          </select>
          <div>
            <label className="text-xs text-[var(--text-muted)]">API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={config?.api_key_set ? "•••••••• (leave blank to keep)" : "Paste your API key"}
              className="app-input mt-1 w-full rounded-xl px-3 py-2 text-sm"
            />
            <p className="mt-1 text-[10px] text-[var(--text-faint)]">
              Or set NEWS_API_KEY in backend .env
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
          <h2 className="font-semibold text-[var(--text-primary)]">Sources & Topics</h2>
          <p className="text-xs text-[var(--text-muted)]">
            NewsAPI source IDs (Reuters, Bloomberg, etc.) and search queries for economic news.
          </p>
          <div>
            <label className="text-xs text-[var(--text-muted)]">Sources (comma-separated)</label>
            <textarea
              value={sources}
              onChange={(e) => setSources(e.target.value)}
              rows={3}
              className="app-input mt-1 w-full rounded-xl px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-[var(--text-muted)]">Search queries</label>
            <textarea
              value={queries}
              onChange={(e) => setQueries(e.target.value)}
              rows={3}
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
                  <th className="pb-2 pr-4 font-medium">Articles</th>
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
                    <td className="py-2 pr-4">{log.articles_fetched}</td>
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