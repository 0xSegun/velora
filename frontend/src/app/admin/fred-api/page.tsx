"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  AlertCircle,
  BarChart3,
  CheckCircle2,
  Download,
  LineChart,
  Loader2,
  Play,
  Power,
  PowerOff,
  RefreshCw,
  Save,
  ScrollText,
  Settings,
  SlidersHorizontal,
  X,
  XCircle,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart as ReLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { chartTooltipProps } from "@/components/charts/ChartTooltip";
import ToggleSwitch from "@/components/ui/ToggleSwitch";
import PageHeader from "@/components/ui/PageHeader";
import PageLoadError from "@/components/ui/PageLoadError";
import {
  fredAPI,
  type FredConfig,
  type FredFeatureConfig,
  type FredHealth,
  type FredIndicator,
} from "@/lib/api";
import { handleApiError } from "@/lib/errorHandler";
import { toast } from "@/lib/feedback";
import { formatDateTime } from "@/lib/dates";
import { apiHealthSentiment, sentimentClass } from "@/lib/financialColors";

type Tab = "settings" | "indicators" | "features" | "health" | "logs" | "analytics";

interface ApiLog {
  id: string;
  endpoint: string;
  request_timestamp: string;
  response_time_ms?: number | null;
  success: boolean;
  error_message?: string | null;
  status_code?: number | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  inflation: "Inflation Indicators",
  interest_rate: "Interest Rate Indicators",
  employment: "Employment Indicators",
  economic_activity: "Economic Activity Indicators",
  money_supply: "Money Supply Indicators",
  exchange_rate: "Exchange Rate Indicators",
  commodity: "Commodity Indicators",
  housing: "Housing Indicators",
  consumer_confidence: "Consumer Confidence Indicators",
};

function statusBadge(status: string) {
  const map: Record<string, "positive" | "caution" | "negative" | "info"> = {
    green: "positive",
    yellow: "caution",
    red: "negative",
    inactive: "info",
  };
  const sentiment = map[status] ?? apiHealthSentiment(status);
  const icon =
    sentiment === "positive"
      ? CheckCircle2
      : sentiment === "caution"
        ? AlertCircle
        : XCircle;
  return { icon, sentiment, label: status };
}

export default function FredApiPage() {
  const [tab, setTab] = useState<Tab>("settings");
  const [config, setConfig] = useState<FredConfig | null>(null);
  const [health, setHealth] = useState<FredHealth | null>(null);
  const [logs, setLogs] = useState<ApiLog[]>([]);
  const [analytics, setAnalytics] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    response_time_ms?: number | null;
    diagnostics?: Record<string, unknown>;
  } | null>(null);
  const [logFilter, setLogFilter] = useState<"all" | "success" | "failed">("all");

  const [apiKey, setApiKey] = useState("");
  const [refreshInterval, setRefreshInterval] = useState("daily");
  const [dateRange, setDateRange] = useState("5y");
  const [dataFrequency, setDataFrequency] = useState("monthly");
  const [predictionEnabled, setPredictionEnabled] = useState(true);
  const [syncEnabled, setSyncEnabled] = useState(true);
  const [historicalStorage, setHistoricalStorage] = useState(true);
  const [indicators, setIndicators] = useState<FredIndicator[]>([]);
  const [featureConfig, setFeatureConfig] = useState<FredFeatureConfig>({
    include_lag_variables: true,
    include_rolling_means: true,
    include_moving_averages: true,
    include_percentage_changes: true,
    include_growth_rates: true,
    input_sequence_length: 24,
    forecast_horizon: 6,
    normalization_method: "minmax",
  });

  const applyConfig = useCallback((cfg: FredConfig) => {
    setConfig(cfg);
    setRefreshInterval(cfg.refresh_interval);
    setDateRange(cfg.date_range);
    setDataFrequency(cfg.data_frequency);
    setPredictionEnabled(cfg.prediction_enabled);
    setSyncEnabled(cfg.sync_enabled);
    setHistoricalStorage(cfg.historical_storage_enabled);
    setIndicators(cfg.indicators ?? []);
    setFeatureConfig(cfg.feature_config);
    setApiKey("");
  }, []);

  const loadLogs = useCallback(async (filter: "all" | "success" | "failed") => {
    const params =
      filter === "all"
        ? { limit: 50 }
        : { limit: 50, status: filter === "success" ? "success" : "failed" };
    const res = await fredAPI.getLogs(params);
    setLogs(Array.isArray(res.data) ? (res.data as ApiLog[]) : []);
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const configRes = await fredAPI.getConfig();
      applyConfig(configRes.data);
      const [healthRes, logsRes, analyticsRes] = await Promise.allSettled([
        fredAPI.getHealth(),
        fredAPI.getLogs({ limit: 50 }),
        fredAPI.getAnalytics(),
      ]);
      if (healthRes.status === "fulfilled") setHealth(healthRes.value.data);
      if (logsRes.status === "fulfilled") {
        setLogs(Array.isArray(logsRes.value.data) ? (logsRes.value.data as ApiLog[]) : []);
      }
      if (analyticsRes.status === "fulfilled") {
        setAnalytics(analyticsRes.value.data as Record<string, unknown>);
      }
    } catch (err) {
      setError(handleApiError(err, "Failed to load FRED API settings."));
    } finally {
      setLoading(false);
    }
  }, [applyConfig]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const groupedIndicators = useMemo(() => {
    const groups: Record<string, FredIndicator[]> = {};
    for (const ind of indicators) {
      const cat = ind.category || "other";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(ind);
    }
    return groups;
  }, [indicators]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        refresh_interval: refreshInterval,
        date_range: dateRange,
        data_frequency: dataFrequency,
        prediction_enabled: predictionEnabled,
        sync_enabled: syncEnabled,
        historical_storage_enabled: historicalStorage,
        feature_config: featureConfig,
        indicators: indicators.map((i) => ({
          indicator_code: i.indicator_code,
          enabled: i.enabled,
        })),
      };
      if (apiKey.trim()) payload.api_key = apiKey.trim();
      const res = await fredAPI.updateConfig(payload);
      applyConfig(res.data as FredConfig);
      toast.success("FRED settings saved.");
      const healthRes = await fredAPI.getHealth();
      setHealth(healthRes.data);
    } catch (err) {
      toast.error(handleApiError(err, "Failed to save settings."));
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fredAPI.testConnection(
        apiKey.trim() ? { api_key: apiKey.trim() } : undefined,
      );
      const data = res.data as {
        success: boolean;
        message: string;
        response_time_ms?: number | null;
        diagnostics?: Record<string, unknown>;
      };
      setTestResult(data);
      if (data.success) toast.success(data.message);
      else toast.error(data.message);
    } catch (err) {
      const msg = handleApiError(err, "Unable to connect to the FRED API.");
      setTestResult({ success: false, message: msg });
      toast.error(msg);
    } finally {
      setTesting(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fredAPI.sync();
      const data = res.data as { success?: boolean; message?: string };
      if (data.success) toast.success(data.message ?? "Synchronization complete.");
      else toast.error(data.message ?? "Sync failed.");
      await loadAll();
    } catch (err) {
      toast.error(handleApiError(err, "Synchronization failed."));
    } finally {
      setSyncing(false);
    }
  };

  const handleToggleApi = async () => {
    if (!config) return;
    setToggling(true);
    try {
      const res = config.is_active ? await fredAPI.disable() : await fredAPI.enable();
      applyConfig(res.data as FredConfig);
      toast.success(config.is_active ? "FRED API disabled." : "FRED API enabled.");
      const healthRes = await fredAPI.getHealth();
      setHealth(healthRes.data);
    } catch (err) {
      toast.error(handleApiError(err, "Failed to toggle API."));
    } finally {
      setToggling(false);
    }
  };

  const handleReset = async () => {
    if (!confirm("Reset FRED settings to defaults? API key will not be cleared.")) return;
    try {
      const res = await fredAPI.reset();
      applyConfig(res.data as FredConfig);
      toast.success("Settings reset.");
    } catch (err) {
      toast.error(handleApiError(err, "Reset failed."));
    }
  };

  const handleExport = async (format: string) => {
    try {
      const res = await fredAPI.exportData(format);
      const blob = new Blob([res.data as BlobPart]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `fred_export.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported as ${format.toUpperCase()}.`);
    } catch (err) {
      toast.error(handleApiError(err, "Export failed."));
    }
  };

  const toggleIndicator = (code: string, enabled: boolean) => {
    setIndicators((prev) =>
      prev.map((i) => (i.indicator_code === code ? { ...i, enabled } : i)),
    );
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--text-muted)]" />
      </div>
    );
  }

  if (error) {
    return <PageLoadError description={error} onRetry={() => void loadAll()} />;
  }

  const badge = health ? statusBadge(health.status) : null;
  const StatusIcon = badge?.icon ?? Activity;
  const trends = (analytics?.trends ?? {}) as Record<string, { date: string; value: number }[]>;

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "settings", label: "Settings", icon: Settings },
    { id: "indicators", label: "Indicators", icon: LineChart },
    { id: "features", label: "Feature Engineering", icon: SlidersHorizontal },
    { id: "health", label: "Health", icon: Activity },
    { id: "logs", label: "Logs", icon: ScrollText },
    { id: "analytics", label: "Analytics", icon: BarChart3 },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="API Configuration"
        title="FRED API Settings"
        description="Manage Federal Reserve Economic Data integration, indicator selection, and TS-Transformer feature pipeline."
      />

      {health?.failover_warning && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {health.failover_warning}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition ${
                tab === t.id
                  ? "bg-[var(--accent)] text-white"
                  : "glass-panel text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {tab === "settings" && (
          <motion.div
            key="settings"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="grid gap-6 lg:grid-cols-2"
          >
            <section className="glass-panel space-y-4 rounded-2xl p-6">
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">Connection</h2>
              <div className="space-y-3 text-sm">
                <div>
                  <label className="text-xs text-[var(--text-faint)]">Provider Name</label>
                  <p className="text-[var(--text-primary)]">{config?.provider_name}</p>
                </div>
                <div>
                  <label className="text-xs text-[var(--text-faint)]">Base URL</label>
                  <p className="font-mono text-xs text-[var(--text-muted)]">{config?.base_url}</p>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-[var(--text-faint)]">API Key</label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={config?.api_key_set ? "•••••••• (leave blank to keep)" : "Enter FRED API key"}
                    className="w-full rounded-xl border border-[var(--border-primary)] bg-[var(--glass-bg)] px-3 py-2 text-sm text-[var(--text-primary)]"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[var(--text-faint)]">API Status</span>
                  <span
                    className="text-xs font-medium capitalize"
                    style={{ color: sentimentClass(badge?.sentiment ?? "info") }}
                  >
                    {config?.is_active ? "Enabled" : "Disabled"}
                    {config?.api_key_set ? " · Key set" : " · No key"}
                  </span>
                </div>
              </div>
            </section>

            <section className="glass-panel space-y-4 rounded-2xl p-6">
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">Synchronization</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs text-[var(--text-faint)]">Refresh Frequency</label>
                  <select
                    value={refreshInterval}
                    onChange={(e) => setRefreshInterval(e.target.value)}
                    className="w-full rounded-xl border border-[var(--border-primary)] bg-[var(--glass-bg)] px-3 py-2 text-sm"
                  >
                    <option value="hourly">Hourly</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-[var(--text-faint)]">Date Range</label>
                  <select
                    value={dateRange}
                    onChange={(e) => setDateRange(e.target.value)}
                    className="w-full rounded-xl border border-[var(--border-primary)] bg-[var(--glass-bg)] px-3 py-2 text-sm"
                  >
                    <option value="1y">1 Year</option>
                    <option value="3y">3 Years</option>
                    <option value="5y">5 Years</option>
                    <option value="10y">10 Years</option>
                    <option value="max">Maximum</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-[var(--text-faint)]">Data Frequency</label>
                  <select
                    value={dataFrequency}
                    onChange={(e) => setDataFrequency(e.target.value)}
                    className="w-full rounded-xl border border-[var(--border-primary)] bg-[var(--glass-bg)] px-3 py-2 text-sm"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                  </select>
                </div>
              </div>
              <div className="space-y-3 pt-2">
                {[
                  { label: "Prediction Data Usage", checked: predictionEnabled, set: setPredictionEnabled },
                  { label: "Enable Historical Data Storage", checked: historicalStorage, set: setHistoricalStorage },
                  { label: "Enable Automatic Synchronization", checked: syncEnabled, set: setSyncEnabled },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between">
                    <span className="text-xs text-[var(--text-muted)]">{row.label}</span>
                    <ToggleSwitch checked={row.checked} onChange={row.set} aria-label={row.label} />
                  </div>
                ))}
              </div>
            </section>

            <section className="glass-panel flex flex-wrap gap-2 rounded-2xl p-4 lg:col-span-2">
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving}
                className="flex items-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Settings
              </button>
              <button
                type="button"
                onClick={() => void handleTest()}
                disabled={testing}
                className="glass-panel flex items-center gap-2 rounded-xl px-4 py-2 text-sm"
              >
                {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                Test Connection
              </button>
              <button
                type="button"
                onClick={() => void handleSync()}
                disabled={syncing}
                className="glass-panel flex items-center gap-2 rounded-xl px-4 py-2 text-sm"
              >
                {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Synchronize Data
              </button>
              <button
                type="button"
                onClick={() => void handleToggleApi()}
                disabled={toggling}
                className="glass-panel flex items-center gap-2 rounded-xl px-4 py-2 text-sm"
              >
                {config?.is_active ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                {config?.is_active ? "Disable API" : "Enable API"}
              </button>
              <button type="button" onClick={() => void handleReset()} className="glass-panel rounded-xl px-4 py-2 text-sm">
                Reset Settings
              </button>
            </section>

            {testResult && (
              <div
                className={`flex items-start gap-2 rounded-xl p-4 text-sm lg:col-span-2 ${
                  testResult.success
                    ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                    : "border border-red-500/30 bg-red-500/10 text-red-200"
                }`}
              >
                {testResult.success ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                <div>
                  <p>{testResult.message}</p>
                  {testResult.response_time_ms != null && (
                    <p className="mt-1 text-xs opacity-80">{testResult.response_time_ms}ms</p>
                  )}
                </div>
                <button type="button" onClick={() => setTestResult(null)} className="ml-auto">
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
          </motion.div>
        )}

        {tab === "indicators" && (
          <motion.div key="indicators" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            {Object.entries(groupedIndicators).map(([category, items]) => (
              <section key={category} className="glass-panel rounded-2xl p-6">
                <h2 className="mb-4 text-sm font-semibold text-[var(--text-primary)]">
                  {CATEGORY_LABELS[category] ?? category}
                </h2>
                <div className="space-y-3">
                  {items.map((ind) => (
                    <div
                      key={ind.indicator_code}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border-primary)] p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-[var(--text-primary)]">
                          {ind.indicator_name}{" "}
                          <span className="font-mono text-xs text-[var(--text-faint)]">({ind.indicator_code})</span>
                        </p>
                        <p className="mt-0.5 text-xs text-[var(--text-muted)]">{ind.description}</p>
                        <p className="mt-1 text-[10px] text-[var(--text-faint)]">
                          {ind.frequency}
                          {ind.last_updated ? ` · Updated ${formatDateTime(ind.last_updated)}` : ""}
                        </p>
                      </div>
                      <ToggleSwitch
                        checked={ind.enabled}
                        onChange={(v) => toggleIndicator(ind.indicator_code, v)}
                        aria-label={`Enable ${ind.indicator_name}`}
                      />
                    </div>
                  ))}
                </div>
              </section>
            ))}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving}
                className="flex items-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2 text-sm text-white"
              >
                <Save className="h-4 w-4" /> Save Indicators
              </button>
            </div>
          </motion.div>
        )}

        {tab === "features" && (
          <motion.div key="features" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-panel rounded-2xl p-6">
            <h2 className="mb-4 text-sm font-semibold">Prediction Feature Configuration</h2>
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-3">
                <p className="text-xs uppercase tracking-wider text-[var(--text-faint)]">Feature Toggles</p>
                {(
                  [
                    ["include_lag_variables", "Include Lag Variables"],
                    ["include_rolling_means", "Include Rolling Means"],
                    ["include_moving_averages", "Include Moving Averages"],
                    ["include_percentage_changes", "Include Percentage Changes"],
                    ["include_growth_rates", "Include Growth Rates"],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-sm text-[var(--text-muted)]">{label}</span>
                    <ToggleSwitch
                      checked={featureConfig[key]}
                      onChange={(v) => setFeatureConfig((f) => ({ ...f, [key]: v }))}
                      aria-label={label}
                    />
                  </div>
                ))}
              </div>
              <div className="space-y-3">
                <p className="text-xs uppercase tracking-wider text-[var(--text-faint)]">Model Parameters</p>
                <div>
                  <label className="text-xs text-[var(--text-faint)]">Input Sequence Length</label>
                  <input
                    type="number"
                    min={6}
                    max={120}
                    value={featureConfig.input_sequence_length}
                    onChange={(e) =>
                      setFeatureConfig((f) => ({
                        ...f,
                        input_sequence_length: Number(e.target.value),
                      }))
                    }
                    className="mt-1 w-full rounded-xl border border-[var(--border-primary)] bg-[var(--glass-bg)] px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--text-faint)]">Forecast Horizon</label>
                  <input
                    type="number"
                    min={1}
                    max={36}
                    value={featureConfig.forecast_horizon}
                    onChange={(e) =>
                      setFeatureConfig((f) => ({ ...f, forecast_horizon: Number(e.target.value) }))
                    }
                    className="mt-1 w-full rounded-xl border border-[var(--border-primary)] bg-[var(--glass-bg)] px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--text-faint)]">Normalization Method</label>
                  <select
                    value={featureConfig.normalization_method}
                    onChange={(e) =>
                      setFeatureConfig((f) => ({ ...f, normalization_method: e.target.value }))
                    }
                    className="mt-1 w-full rounded-xl border border-[var(--border-primary)] bg-[var(--glass-bg)] px-3 py-2 text-sm"
                  >
                    <option value="minmax">Min-Max</option>
                    <option value="zscore">Z-Score</option>
                    <option value="robust">Robust</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving}
                className="flex items-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2 text-sm text-white"
              >
                <Save className="h-4 w-4" /> Save Feature Config
              </button>
            </div>
          </motion.div>
        )}

        {tab === "health" && health && (
          <motion.div key="health" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-panel rounded-2xl p-6">
            <div className="flex items-center gap-3">
              <StatusIcon style={{ color: sentimentClass(badge?.sentiment ?? "info") }} className="h-6 w-6" />
              <div>
                <h2 className="text-sm font-semibold">{health.provider}</h2>
                <p className="text-xs capitalize text-[var(--text-muted)]">Status: {health.status}</p>
              </div>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-xs">
              {[
                ["Response Time", health.response_time_ms != null ? `${health.response_time_ms}ms` : "—"],
                ["Last Sync", formatDateTime(health.last_sync ?? null)],
                ["Last Failed Sync", formatDateTime(health.last_failed_sync ?? null)],
                ["Success Rate", health.success_rate != null ? `${health.success_rate}%` : "—"],
                ["Error Count", String(health.error_count)],
                ["Records Retrieved", String(health.records_retrieved)],
                ["Indicators Enabled", String(health.indicators_enabled)],
                ["Data Quality Score", health.data_quality_score != null ? `${health.data_quality_score}%` : "—"],
                ["Model Feature Count", String(health.model_feature_count)],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-[var(--text-faint)]">{label}</p>
                  <p className="mt-0.5 text-[var(--text-primary)]">{value}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {tab === "logs" && (
          <motion.div key="logs" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-panel rounded-2xl p-6">
            <div className="mb-4 flex gap-2">
              {(["all", "success", "failed"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => {
                    setLogFilter(f);
                    void loadLogs(f);
                  }}
                  className={`rounded-lg px-3 py-1 text-xs capitalize ${
                    logFilter === f ? "bg-[var(--accent)] text-white" : "text-[var(--text-muted)]"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
            <div className="max-h-96 overflow-y-auto space-y-2">
              {logs.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)]">No logs yet.</p>
              ) : (
                logs.map((log) => (
                  <div
                    key={log.id}
                    className="rounded-lg border border-[var(--border-primary)] p-3 text-xs"
                  >
                    <div className="flex justify-between gap-2">
                      <span className={log.success ? "text-emerald-400" : "text-red-400"}>
                        {log.success ? "Success" : "Failed"} · {log.status_code ?? "—"}
                      </span>
                      <span className="text-[var(--text-faint)]">{formatDateTime(log.request_timestamp)}</span>
                    </div>
                    <p className="mt-1 truncate font-mono text-[var(--text-muted)]">{log.endpoint}</p>
                    {log.error_message && <p className="mt-1 text-red-300">{log.error_message}</p>}
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}

        {tab === "analytics" && (
          <motion.div key="analytics" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div className="flex flex-wrap gap-2">
              {(["csv", "xlsx", "pdf"] as const).map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => void handleExport(fmt)}
                  className="glass-panel flex items-center gap-2 rounded-xl px-3 py-2 text-xs"
                >
                  <Download className="h-3.5 w-3.5" /> Export {fmt.toUpperCase()}
                </button>
              ))}
            </div>
            {Object.entries(trends).map(([code, points]) =>
              points.length > 0 ? (
                <section key={code} className="glass-panel rounded-2xl p-6">
                  <h3 className="mb-4 text-sm font-semibold">{code}</h3>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <ReLineChart data={points}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="var(--text-faint)" />
                        <YAxis tick={{ fontSize: 10 }} stroke="var(--text-faint)" />
                        <Tooltip {...chartTooltipProps} />
                        <Line type="monotone" dataKey="value" stroke="var(--accent)" dot={false} strokeWidth={2} />
                      </ReLineChart>
                    </ResponsiveContainer>
                  </div>
                </section>
              ) : null,
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}