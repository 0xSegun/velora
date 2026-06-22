"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Play,
  RefreshCw,
  Save,
  DollarSign,
  Activity,
  ScrollText,
  X,
  Power,
  PowerOff,
  BarChart3,
  History,
  Shield,
  Globe,
  ArrowLeftRight,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { chartTooltipProps } from "@/components/charts/ChartTooltip";
import {
  exchangeRatesAPI,
  type ExchangeRateAuditLog,
  type ExchangeRateCatalog,
  type ExchangeRateConfig,
} from "@/lib/api";
import { setCurrencyCatalogFromApi } from "@/lib/currency";
import { formatExchangeRate } from "@/lib/currency";
import { handleApiError } from "@/lib/errorHandler";
import { toast } from "@/lib/feedback";
import { formatDateTime } from "@/lib/dates";
import { apiHealthSentiment, sentimentClass } from "@/lib/financialColors";
import EmptyState from "@/components/ui/EmptyState";
import { CountryBadge, CountryFlag, CountryLabel, CurrencyBadge } from "@/components/ui/CountryFlag";

interface ConfigForm {
  provider_name: string;
  base_url: string;
  api_key: string;
  base_currency: string;
  refresh_interval: string;
}

interface HealthData {
  provider: string;
  status: string;
  is_active: boolean;
  response_time_ms?: number | null;
  last_sync?: string | null;
  next_sync?: string | null;
  error_count: number;
  success_count: number;
  success_rate?: number | null;
  sync_status: string;
}

interface ApiLog {
  id: string;
  endpoint: string;
  request_timestamp: string;
  response_time_ms?: number | null;
  success: boolean;
  error_message?: string | null;
  status_code?: number | null;
}

interface RateRow {
  id: string;
  target_currency: string;
  currency_name?: string | null;
  country_name?: string | null;
  exchange_rate: number;
  retrieved_at: string;
  country_code?: string | null;
}

interface FxAnalyticsSummary {
  last_sync?: string | null;
  supported_countries?: number;
  supported_currencies?: number;
}

interface FxAnalytics {
  strongest?: Array<Record<string, unknown>>;
  weakest?: Array<Record<string, unknown>>;
  most_volatile?: Array<Record<string, unknown>>;
  summary?: FxAnalyticsSummary;
}

interface HistoryPoint {
  period_date: string;
  exchange_rate: number;
  target_currency: string;
}

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

export default function ExchangeRateApiPage() {
  const [config, setConfig] = useState<ExchangeRateConfig | null>(null);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [logs, setLogs] = useState<ApiLog[]>([]);
  const [auditLogs, setAuditLogs] = useState<ExchangeRateAuditLog[]>([]);
  const [rates, setRates] = useState<RateRow[]>([]);
  const [fxAnalytics, setFxAnalytics] = useState<FxAnalytics | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    response_time_ms?: number | null;
  } | null>(null);
  const [logFilter, setLogFilter] = useState<"all" | "success" | "failed">("all");
  const [ratesSearch, setRatesSearch] = useState("");
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalog, setCatalog] = useState<ExchangeRateCatalog | null>(null);
  const [historyCurrency, setHistoryCurrency] = useState("NGN");
  const [pairBase, setPairBase] = useState("USD");
  const [pairTarget, setPairTarget] = useState("NGN");
  const [pairAmount, setPairAmount] = useState("");
  const [pairResult, setPairResult] = useState<Record<string, unknown> | null>(null);
  const [pairLoading, setPairLoading] = useState(false);
  const [histYear, setHistYear] = useState(String(new Date().getFullYear()));
  const [histMonth, setHistMonth] = useState("1");
  const [histDay, setHistDay] = useState("1");
  const [histBase, setHistBase] = useState("USD");
  const [histResult, setHistResult] = useState<Record<string, unknown> | null>(null);
  const [histLoading, setHistLoading] = useState(false);
  const [form, setForm] = useState<ConfigForm>({
    provider_name: "ExchangeRate-API",
    base_url: "https://v6.exchangerate-api.com",
    api_key: "",
    base_currency: "USD",
    refresh_interval: "hourly",
  });

  const loadLogs = useCallback(async (filter: "all" | "success" | "failed") => {
    const params =
      filter === "all"
        ? { limit: 50 }
        : { limit: 50, status: filter === "success" ? "success" : "failed" };
    const logsRes = await exchangeRatesAPI.getLogs(params);
    setLogs(Array.isArray(logsRes.data) ? (logsRes.data as ApiLog[]) : []);
  }, []);

  const applyConfig = useCallback((cfg: ExchangeRateConfig) => {
    setConfig(cfg);
    setForm({
      provider_name: cfg.provider_name,
      base_url: cfg.base_url,
      api_key: "",
      base_currency: cfg.base_currency,
      refresh_interval: cfg.refresh_interval,
    });
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const configRes = await exchangeRatesAPI.getConfig();
      const cfg = configRes.data as ExchangeRateConfig;
      applyConfig(cfg);

      const [healthRes, auditRes, ratesRes, analyticsRes, logsRes, catalogRes] =
        await Promise.allSettled([
          exchangeRatesAPI.getHealth(),
          exchangeRatesAPI.getAuditLogs({ limit: 25 }),
          exchangeRatesAPI.listRates(),
          exchangeRatesAPI.getAnalytics(),
          exchangeRatesAPI.getLogs({ limit: 50 }),
          exchangeRatesAPI.listCurrencies(),
        ]);

      if (healthRes.status === "fulfilled") {
        setHealth(healthRes.value.data as HealthData);
      }
      if (auditRes.status === "fulfilled") {
        setAuditLogs(
          Array.isArray(auditRes.value.data)
            ? (auditRes.value.data as ExchangeRateAuditLog[])
            : [],
        );
      }
      if (ratesRes.status === "fulfilled") {
        setRates(
          Array.isArray(ratesRes.value.data) ? (ratesRes.value.data as RateRow[]) : [],
        );
      }
      if (analyticsRes.status === "fulfilled") {
        setFxAnalytics(analyticsRes.value.data as FxAnalytics);
      }
      if (logsRes.status === "fulfilled") {
        setLogs(Array.isArray(logsRes.value.data) ? (logsRes.value.data as ApiLog[]) : []);
      }
      if (catalogRes.status === "fulfilled") {
        const cat = catalogRes.value.data as ExchangeRateCatalog;
        setCatalog(cat);
        setCurrencyCatalogFromApi(cat.currencies ?? []);
      }
    } catch (err) {
      const message = handleApiError(
        err,
        "Exchange rate config load",
        "Failed to load exchange rate API configuration.",
        false,
      );
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [applyConfig]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const loadHistory = useCallback(async (currency: string) => {
    try {
      const historyRes = await exchangeRatesAPI.getHistory({
        period_type: "daily",
        months: 6,
        target_currency: currency,
      });
      setHistory(
        Array.isArray(historyRes.data) ? (historyRes.data as HistoryPoint[]) : [],
      );
    } catch {
      setHistory([]);
    }
  }, []);

  useEffect(() => {
    if (rates.length > 0 && !rates.some((r) => r.target_currency === historyCurrency)) {
      setHistoryCurrency(rates[0].target_currency);
      return;
    }
    if (historyCurrency) {
      void loadHistory(historyCurrency);
    }
  }, [historyCurrency, loadHistory, rates]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        provider_name: form.provider_name.trim(),
        base_currency: form.base_currency.trim().toUpperCase(),
        refresh_interval: form.refresh_interval,
      };
      if (form.api_key.trim()) {
        payload.api_key = form.api_key.trim();
      }
      const { data } = await exchangeRatesAPI.updateConfig(payload);
      const saved = data as ExchangeRateConfig;
      applyConfig(saved);
      toast.success("Exchange rate configuration saved.");
      setSuccess("Configuration saved successfully.");
      void loadAll();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      const message = handleApiError(err, "Exchange rate config save", "Failed to save configuration.", false);
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    void loadLogs(logFilter);
  }, [logFilter, loadLogs]);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const payload = form.api_key.trim() ? { api_key: form.api_key.trim() } : undefined;
      const { data } = await exchangeRatesAPI.testConnection(payload);
      const result = data as { success: boolean; message: string; response_time_ms?: number | null };
      setTestResult(result);
      if (result.success) toast.success("Connection successful.");
      else toast.error(result.message);
      await loadAll();
    } catch {
      setTestResult({ success: false, message: "Connection test failed." });
      toast.error("Connection test failed.");
    } finally {
      setTesting(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data } = await exchangeRatesAPI.sync();
      const result = data as { success: boolean; message: string };
      if (result.success) {
        toast.success(result.message);
        setSuccess(result.message);
      } else {
        toast.error(result.message);
      }
      await loadAll();
      setTimeout(() => setSuccess(null), 4000);
    } catch (err) {
      const message = handleApiError(err, "Rate sync", "Rate sync failed.", false);
      toast.error(message);
      setError(message);
    } finally {
      setSyncing(false);
    }
  };

  const handleToggle = async (enable: boolean) => {
    setToggling(true);
    try {
      if (enable) {
        await exchangeRatesAPI.enable();
        toast.success("Exchange rate API enabled.");
      } else {
        await exchangeRatesAPI.disable();
        toast.success("Exchange rate API disabled.");
      }
      await loadAll();
    } catch (err) {
      handleApiError(err, "Toggle exchange rate API", "Failed to update API status.");
    } finally {
      setToggling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--text-muted)]" />
      </div>
    );
  }

  const badge = health ? statusBadge(health.status) : null;
  const StatusIcon = badge?.icon ?? AlertCircle;

  const filteredRates = rates.filter((rate) => {
    if (!ratesSearch.trim()) return true;
    const q = ratesSearch.trim().toLowerCase();
    return (
      rate.target_currency.toLowerCase().includes(q) ||
      (rate.country_code ?? "").toLowerCase().includes(q) ||
      (rate.currency_name ?? "").toLowerCase().includes(q) ||
      (rate.country_name ?? "").toLowerCase().includes(q)
    );
  });

  const filteredCatalog = (catalog?.currencies ?? []).filter((item) => {
    if (!catalogSearch.trim()) return true;
    const q = catalogSearch.trim().toLowerCase();
    return (
      item.code.toLowerCase().includes(q) ||
      item.name.toLowerCase().includes(q) ||
      item.country.toLowerCase().includes(q) ||
      item.country_code.toLowerCase().includes(q) ||
      item.continent.toLowerCase().includes(q)
    );
  });

  const handlePairConversion = async () => {
    setPairLoading(true);
    setPairResult(null);
    try {
      const payload: { base_currency: string; target_currency: string; amount?: number } = {
        base_currency: pairBase.trim().toUpperCase(),
        target_currency: pairTarget.trim().toUpperCase(),
      };
      if (pairAmount.trim()) payload.amount = Number(pairAmount);
      const { data } = await exchangeRatesAPI.pairConversion(payload);
      setPairResult(data as Record<string, unknown>);
      toast.success("Pair conversion loaded.");
    } catch (err) {
      handleApiError(err, "Pair conversion", "Pair conversion failed.");
    } finally {
      setPairLoading(false);
    }
  };

  const handleProviderHistorical = async () => {
    setHistLoading(true);
    setHistResult(null);
    try {
      const { data } = await exchangeRatesAPI.providerHistorical({
        base_currency: histBase.trim().toUpperCase(),
        year: Number(histYear),
        month: Number(histMonth),
        day: Number(histDay),
      });
      setHistResult(data as Record<string, unknown>);
      toast.success("Historical rates loaded.");
    } catch (err) {
      handleApiError(err, "Historical rates", "Historical fetch failed (Pro+ plan may be required).");
    } finally {
      setHistLoading(false);
    }
  };

  const historyCurrencies = Array.from(
    new Set(rates.map((r) => r.target_currency).filter(Boolean)),
  ).sort();

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--text-faint)]">Admin</p>
          <h1 className="mt-1 text-2xl font-bold text-[var(--text-primary)] sm:text-3xl">
            Exchange Rate API
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            All {catalog?.total ?? 165}+ ExchangeRate-API currencies — standard, pair, historical and enriched endpoints
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => void handleSync()}
            disabled={syncing}
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-hover)] bg-[var(--accent-faint)] px-4 py-2.5 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--glass-bg-hover)] disabled:opacity-40 transition"
          >
            {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Refresh Rates
          </button>
          {config?.is_active ? (
            <button
              onClick={() => void handleToggle(false)}
              disabled={toggling}
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-hover)] bg-[var(--accent-faint)] px-4 py-2.5 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--glass-bg-hover)] disabled:opacity-40 transition"
            >
              <PowerOff className="w-4 h-4" />
              Disable API
            </button>
          ) : (
            <button
              onClick={() => void handleToggle(true)}
              disabled={toggling}
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-hover)] bg-[var(--accent-faint)] px-4 py-2.5 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--glass-bg-hover)] disabled:opacity-40 transition"
            >
              <Power className="w-4 h-4" />
              Enable API
            </button>
          )}
        </div>
      </motion.div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2 rounded-xl border border-[var(--border-primary)] bg-[var(--accent-faint)] px-4 py-3 text-sm text-[var(--text-muted)]"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
            <button onClick={() => setError(null)} className="ml-auto"><X className="w-4 h-4" /></button>
          </motion.div>
        )}
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2 rounded-xl border border-[var(--border-primary)] bg-[var(--accent-faint)] px-4 py-3 text-sm text-[var(--text-primary)]"
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {success}
          </motion.div>
        )}
      </AnimatePresence>

      {catalog && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Supported Currencies", value: String(catalog.total) },
            { label: "Countries in Catalog", value: String(fxAnalytics?.summary?.supported_countries ?? "—") },
            { label: "Synced Rates", value: String(rates.length) },
            { label: "Base Currency", value: catalog.base_currency },
          ].map((item) => (
            <div key={item.label} className="glass-card rounded-xl hover:transform-none p-4">
              <p className="text-[10px] uppercase tracking-wider text-[var(--text-faint)]">{item.label}</p>
              <p className="mt-1 text-xl font-semibold text-[var(--text-primary)]">{item.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="glass-card rounded-xl hover:transform-none p-5 space-y-4">
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-[var(--text-primary)]" />
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">API Configuration</h2>
          </div>

          <div>
            <label htmlFor="provider" className="mb-1.5 block text-sm font-medium text-[var(--text-muted)]">
              API Name
            </label>
            <input
              id="provider"
              type="text"
              value={form.provider_name}
              onChange={(e) => setForm((f) => ({ ...f, provider_name: e.target.value }))}
              className="w-full rounded-xl border border-[var(--border-hover)] bg-[var(--accent-faint)] px-4 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-active)] transition"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--text-muted)]">
              Provider URL
            </label>
            <p className="rounded-xl border border-[var(--border-hover)] bg-[var(--accent-faint)] px-4 py-2.5 text-sm font-mono text-[var(--text-muted)]">
              https://v6.exchangerate-api.com
            </p>
            <p className="mt-1 text-xs text-[var(--text-faint)]">
              Fixed approved endpoint — not user-editable
            </p>
          </div>

          <div>
            <label htmlFor="api-key" className="mb-1.5 block text-sm font-medium text-[var(--text-muted)]">
              API Key {config?.api_key_set && "(leave blank to keep existing)"}
            </label>
            <input
              id="api-key"
              type="password"
              value={form.api_key}
              onChange={(e) => setForm((f) => ({ ...f, api_key: e.target.value }))}
              placeholder={config?.api_key_set ? "••••••••" : "Enter API key"}
              className="w-full rounded-xl border border-[var(--border-hover)] bg-[var(--accent-faint)] px-4 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-active)] transition"
            />
            {config?.api_key_set && !form.api_key && (
              <p className="mt-1 text-xs text-[var(--text-faint)]">Current key: ••••••••</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="base-currency" className="mb-1.5 block text-sm font-medium text-[var(--text-muted)]">
                Base Currency
              </label>
              <input
                id="base-currency"
                type="text"
                value={form.base_currency}
                onChange={(e) => setForm((f) => ({ ...f, base_currency: e.target.value }))}
                className="w-full rounded-xl border border-[var(--border-hover)] bg-[var(--accent-faint)] px-4 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-active)] transition"
              />
            </div>
            <div>
              <label htmlFor="refresh-interval" className="mb-1.5 block text-sm font-medium text-[var(--text-muted)]">
                Refresh Interval
              </label>
              <select
                id="refresh-interval"
                value={form.refresh_interval}
                onChange={(e) => setForm((f) => ({ ...f, refresh_interval: e.target.value }))}
                className="w-full rounded-xl border border-[var(--border-hover)] bg-[var(--accent-faint)] px-4 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-active)] transition"
              >
                <option value="hourly">Hourly</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-[var(--text-faint)]">Status:</span>
            <span
              className={`px-2 py-0.5 rounded-full font-medium ${
                config?.is_active
                  ? "bg-[var(--accent-faint)] text-[var(--text-primary)]"
                  : "bg-[var(--accent-faint)] text-[var(--text-muted)]"
              }`}
            >
              {config?.is_active ? "Active" : "Inactive"}
            </span>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={() => void handleSave()}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-xl bg-[var(--accent-faint)] border border-[var(--border-hover)] text-[var(--text-primary)] hover:bg-[var(--glass-bg-hover)] disabled:opacity-40 transition"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Configuration
            </button>
            <button
              onClick={() => void handleTest()}
              disabled={testing}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-xl border border-[var(--border-primary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-faint)] disabled:opacity-40 transition"
            >
              {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Test Connection
            </button>
          </div>

          {testResult && (
            <p
              className="text-xs"
              style={{ color: sentimentClass(testResult.success ? "positive" : "negative") }}
            >
              {testResult.success ? "Connection Successful" : "Connection Failed"}: {testResult.message}
              {testResult.response_time_ms != null && ` (${testResult.response_time_ms}ms)`}
            </p>
          )}
        </div>

        {health && badge && (
          <div className="glass-card rounded-xl hover:transform-none p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-[var(--text-primary)]" />
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">Health Dashboard</h2>
            </div>
            <div className="flex items-center gap-2">
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
                style={{
                  color: sentimentClass(badge.sentiment),
                  backgroundColor: sentimentClass(badge.sentiment, "bg"),
                }}
              >
                <StatusIcon className="w-3 h-3" />
                {badge.label}
              </span>
              <span className="text-xs text-[var(--text-muted)]">{health.provider}</span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              {[
                { label: "Response Time", value: health.response_time_ms != null ? `${health.response_time_ms}ms` : "—" },
                { label: "Last Sync", value: formatDateTime(health.last_sync ?? null) },
                { label: "Next Sync", value: formatDateTime(health.next_sync ?? null) },
                { label: "Error Count", value: String(health.error_count) },
                { label: "Success Rate", value: health.success_rate != null ? `${health.success_rate}%` : "—" },
                { label: "Sync Status", value: health.sync_status },
              ].map((item) => (
                <div key={item.label}>
                  <p className="text-[var(--text-faint)]">{item.label}</p>
                  <p className="text-[var(--text-muted)]">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Full currency catalog */}
      <div className="glass-card rounded-xl hover:transform-none p-5 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-[var(--text-primary)]" />
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Supported Currencies and Countries</h2>
            <span className="text-xs text-[var(--text-faint)]">
              ({filteredCatalog.length}{catalogSearch ? ` of ${catalog?.total ?? 0}` : ""})
            </span>
          </div>
          <input
            type="search"
            value={catalogSearch}
            onChange={(e) => setCatalogSearch(e.target.value)}
            placeholder="Search code, name, country, region…"
            className="w-full sm:w-72 rounded-xl border border-[var(--border-hover)] bg-[var(--accent-faint)] px-3 py-2 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-active)] transition"
          />
        </div>
        {!catalog ? (
          <EmptyState icon={Globe} title="Loading catalog" description="ExchangeRate-API currency directory." />
        ) : (
          <div className="overflow-x-auto max-h-80">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--border-primary)] text-[var(--text-muted)]">
                  {["Code", "Currency", "Country", "Region", "Live Rate"].map((h) => (
                    <th key={h} className="py-2 pr-4 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredCatalog.map((item) => (
                  <tr key={item.code} className="border-b border-[var(--border-primary)] last:border-0">
                    <td className="py-2 pr-4 text-[var(--text-primary)]">
                      <CurrencyBadge currencyCode={item.code} countryCode={item.country_code} />
                    </td>
                    <td className="py-2 pr-4 text-[var(--text-muted)]">{item.name}</td>
                    <td className="py-2 pr-4 text-[var(--text-muted)]">
                      <span className="inline-flex items-center gap-2">
                        <CountryFlag code={item.country_code} size="xs" title={item.country} />
                        {item.country}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-[var(--text-faint)]">{item.region}</td>
                    <td className="py-2 text-[var(--text-primary)]">
                      {item.exchange_rate != null
                        ? formatExchangeRate(item.exchange_rate, item.country_code, item.code)
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pair & provider historical tools */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="glass-card rounded-xl hover:transform-none p-5 space-y-4">
          <div className="flex items-center gap-2">
            <ArrowLeftRight className="w-4 h-4 text-[var(--text-primary)]" />
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Pair Conversion</h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input value={pairBase} onChange={(e) => setPairBase(e.target.value)} placeholder="Base (USD)" className="rounded-xl border border-[var(--border-hover)] bg-[var(--accent-faint)] px-3 py-2 text-xs" />
            <input value={pairTarget} onChange={(e) => setPairTarget(e.target.value)} placeholder="Target (NGN)" className="rounded-xl border border-[var(--border-hover)] bg-[var(--accent-faint)] px-3 py-2 text-xs" />
          </div>
          <input value={pairAmount} onChange={(e) => setPairAmount(e.target.value)} placeholder="Optional amount" className="w-full rounded-xl border border-[var(--border-hover)] bg-[var(--accent-faint)] px-3 py-2 text-xs" />
          <button onClick={() => void handlePairConversion()} disabled={pairLoading} className="inline-flex items-center gap-2 px-4 py-2 text-xs rounded-xl border border-[var(--border-primary)] disabled:opacity-40">
            {pairLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowLeftRight className="w-3 h-3" />}
            Convert Pair
          </button>
          {pairResult && (
            <p className="text-xs text-[var(--text-muted)]">
              1 {String(pairResult.base_code)} = {String(pairResult.conversion_rate)}{" "}
              {String(pairResult.target_code)}
              {pairResult.conversion_result != null && ` · ${pairAmount || 1} → ${String(pairResult.conversion_result)}`}
            </p>
          )}
        </div>
        <div className="glass-card rounded-xl hover:transform-none p-5 space-y-4">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-[var(--text-primary)]" />
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Provider Historical Rates</h2>
          </div>
          <div className="grid grid-cols-4 gap-2">
            <input value={histBase} onChange={(e) => setHistBase(e.target.value)} placeholder="Base" className="rounded-xl border border-[var(--border-hover)] bg-[var(--accent-faint)] px-2 py-2 text-xs" />
            <input value={histYear} onChange={(e) => setHistYear(e.target.value)} placeholder="Year" className="rounded-xl border border-[var(--border-hover)] bg-[var(--accent-faint)] px-2 py-2 text-xs" />
            <input value={histMonth} onChange={(e) => setHistMonth(e.target.value)} placeholder="Month" className="rounded-xl border border-[var(--border-hover)] bg-[var(--accent-faint)] px-2 py-2 text-xs" />
            <input value={histDay} onChange={(e) => setHistDay(e.target.value)} placeholder="Day" className="rounded-xl border border-[var(--border-hover)] bg-[var(--accent-faint)] px-2 py-2 text-xs" />
          </div>
          <button onClick={() => void handleProviderHistorical()} disabled={histLoading} className="inline-flex items-center gap-2 px-4 py-2 text-xs rounded-xl border border-[var(--border-primary)] disabled:opacity-40">
            {histLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <History className="w-3 h-3" />}
            Fetch Historical
          </button>
          {histResult && (
            <p className="text-xs text-[var(--text-muted)]">
              {String(histResult.rates_count ?? 0)} rates for {String(histResult.base_code)} on{" "}
              {String(histResult.year)}-{String(histResult.month)}-{String(histResult.day)}
            </p>
          )}
        </div>
      </div>

      {/* Current Rates Table */}
      <div className="glass-card rounded-xl hover:transform-none p-5 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-[var(--text-primary)]" />
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Current Rates</h2>
            <span className="text-xs text-[var(--text-faint)]">
              ({filteredRates.length}{ratesSearch ? ` of ${rates.length}` : ""} currencies)
            </span>
          </div>
          <input
            type="search"
            value={ratesSearch}
            onChange={(e) => setRatesSearch(e.target.value)}
            placeholder="Search currency or country…"
            className="w-full sm:w-64 rounded-xl border border-[var(--border-hover)] bg-[var(--accent-faint)] px-3 py-2 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-active)] transition"
          />
        </div>
        {rates.length === 0 ? (
          <EmptyState icon={DollarSign} title="No rates synced" description="Enable the API and run a sync to populate rates." />
        ) : (
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--border-primary)] text-[var(--text-muted)]">
                  {["Code", "Currency", "Country", "Rate", "Retrieved"].map((h) => (
                    <th key={h} className="py-2 pr-4 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRates.map((rate) => (
                  <tr key={rate.id} className="border-b border-[var(--border-primary)] last:border-0">
                    <td className="py-2 pr-4 text-[var(--text-primary)]">
                      <CurrencyBadge
                        currencyCode={rate.target_currency}
                        countryCode={rate.country_code}
                      />
                    </td>
                    <td className="py-2 pr-4 text-[var(--text-muted)]">{rate.currency_name ?? "—"}</td>
                    <td className="py-2 pr-4 text-[var(--text-muted)]">
                      {rate.country_name ? (
                        <span className="inline-flex items-center gap-2">
                          {rate.country_code ? (
                            <CountryFlag code={rate.country_code} size="xs" title={rate.country_name} />
                          ) : null}
                          {rate.country_name}
                        </span>
                      ) : rate.country_code ? (
                        <CountryLabel code={rate.country_code} flagSize="xs" />
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2 pr-4" style={{ color: sentimentClass("info") }}>
                      {formatExchangeRate(rate.exchange_rate, rate.country_code ?? rate.target_currency)}
                    </td>
                    <td className="py-2 text-[var(--text-muted)]">{formatDateTime(rate.retrieved_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Analytics & History */}
      <div className="grid gap-6 lg:grid-cols-2">
        {fxAnalytics && (
          <div className="glass-card rounded-xl hover:transform-none p-5 space-y-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-[var(--text-primary)]" />
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">FX Analytics</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { title: "Strongest", items: fxAnalytics.strongest ?? [] },
                { title: "Weakest", items: fxAnalytics.weakest ?? [] },
                { title: "Most Volatile", items: fxAnalytics.most_volatile ?? [] },
              ].map((section) => (
                <div key={section.title} className="rounded-lg border border-[var(--border-primary)] p-3">
                  <p className="text-xs font-medium text-[var(--text-muted)] mb-2">{section.title}</p>
                  <div className="space-y-1 text-xs">
                    {section.items.slice(0, 5).map((item, i) => (
                      <div key={i} className="flex justify-between text-[var(--text-primary)]">
                        <CurrencyBadge
                          currencyCode={String(item.target_currency ?? "—")}
                          countryCode={
                            item.country_code != null
                              ? String(item.country_code)
                              : undefined
                          }
                        />
                        <span style={{ color: sentimentClass("info") }}>
                          {item.exchange_rate != null
                            ? formatExchangeRate(
                                Number(item.exchange_rate),
                                String(item.country_code ?? item.target_currency ?? ""),
                              )
                            : "—"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {fxAnalytics.summary?.last_sync && (
              <p className="text-[10px] text-[var(--text-faint)]">
                Last sync: {formatDateTime(String(fxAnalytics.summary.last_sync))}
              </p>
            )}
          </div>
        )}

        <div className="glass-card rounded-xl hover:transform-none p-5 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-[var(--text-primary)]" />
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">Rate History (6 months)</h2>
            </div>
            {historyCurrencies.length > 0 && (
              <select
                value={historyCurrency}
                onChange={(e) => {
                  const next = e.target.value;
                  setHistoryCurrency(next);
                  void loadHistory(next);
                }}
                className="rounded-xl border border-[var(--border-hover)] bg-[var(--accent-faint)] px-3 py-2 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-active)] transition"
              >
                {historyCurrencies.map((cur) => (
                  <option key={cur} value={cur}>
                    {cur}
                  </option>
                ))}
              </select>
            )}
          </div>
          {history.length === 0 ? (
            <EmptyState icon={History} title="No history data" description="History builds after successful syncs." />
          ) : (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={history
                    .filter((h) => h.target_currency === historyCurrency)
                    .map((h) => ({
                      date: h.period_date,
                      rate: h.exchange_rate,
                    }))}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="var(--text-faint)" />
                  <YAxis tick={{ fontSize: 10 }} stroke="var(--text-faint)" />
                  <Tooltip {...chartTooltipProps} />
                  <Line type="monotone" dataKey="rate" stroke="var(--text-primary)" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Audit Logs */}
      <div className="glass-card rounded-xl hover:transform-none p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-[var(--text-primary)]" />
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Audit Logs</h2>
        </div>
        {auditLogs.length === 0 ? (
          <EmptyState icon={Shield} title="No audit entries" description="Config changes and admin actions will appear here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--border-primary)] text-[var(--text-muted)]">
                  {["Date", "Action", "Changes", "Admin"].map((h) => (
                    <th key={h} className="py-2 pr-4 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log) => (
                  <tr key={log.id} className="border-b border-[var(--border-primary)] last:border-0">
                    <td className="py-2 pr-4 text-[var(--text-muted)]">{formatDateTime(log.created_at)}</td>
                    <td className="py-2 pr-4 text-[var(--text-primary)]">{log.action}</td>
                    <td className="py-2 pr-4 text-[var(--text-muted)] font-mono truncate max-w-[240px]">
                      {JSON.stringify(log.changed_fields)}
                    </td>
                    <td className="py-2 text-[var(--text-faint)]">
                      {log.admin_email ?? log.admin_user_id ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="glass-card rounded-xl hover:transform-none p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ScrollText className="w-4 h-4 text-[var(--text-primary)]" />
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">API Logs</h2>
          </div>
          <div className="flex gap-2">
            {(["all", "success", "failed"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setLogFilter(f)}
                className={`px-2 py-1 rounded text-[10px] capitalize ${
                  logFilter === f ? "border border-[var(--border-active)]" : "border border-[var(--border-primary)]"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {logs.length === 0 ? (
          <EmptyState
            icon={ScrollText}
            title="No logs available"
            description="API activity logs will appear after connection tests and sync operations."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--border-primary)] text-[var(--text-muted)]">
                  {["Date", "Status", "Endpoint", "Response", "Code", "Error"].map((h) => (
                    <th key={h} className="py-2 pr-4 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-[var(--border-primary)] last:border-0">
                    <td className="py-2 pr-4 text-[var(--text-muted)]">
                      {formatDateTime(log.request_timestamp)}
                    </td>
                    <td
                      className="py-2 pr-4"
                      style={{ color: sentimentClass(log.success ? "positive" : "negative") }}
                    >
                      {log.success ? "Success" : "Failed"}
                    </td>
                    <td className="py-2 pr-4 text-[var(--text-primary)] font-mono truncate max-w-[200px]">
                      {log.endpoint}
                    </td>
                    <td className="py-2 pr-4" style={{ color: sentimentClass("info") }}>
                      {log.response_time_ms != null ? `${log.response_time_ms}ms` : "—"}
                    </td>
                    <td className="py-2 pr-4 text-[var(--text-muted)]">{log.status_code ?? "—"}</td>
                    <td className="py-2 text-[var(--text-muted)] truncate max-w-[180px]">
                      {log.error_message ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}