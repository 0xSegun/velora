"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Pencil,
  Trash2,
  Play,
  RefreshCw,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Plug,
  Activity,
  ScrollText,
  X,
  Save,
} from "lucide-react";
import { apiConfigsAPI, type ApiConfigRecord } from "@/lib/api";
import { handleApiError } from "@/lib/errorHandler";
import { MESSAGES, toast } from "@/lib/feedback";
import { formatDateTime } from "@/lib/dates";
import { apiHealthSentiment, sentimentClass } from "@/lib/financialColors";
import ConfirmDeleteModal from "@/components/ui/ConfirmDeleteModal";
import EmptyState from "@/components/ui/EmptyState";

type ApiConfig = ApiConfigRecord;

interface ConfigForm {
  name: string;
  provider: string;
  api_type: string;
  base_url: string;
  endpoint_url: string;
  api_key: string;
  secret_key: string;
  client_id: string;
  client_secret: string;
  bearer_token: string;
  custom_headers: string;
  refresh_frequency_hours: number;
  source_priority: number;
  country_filters: string;
  report_categories: string;
  is_active: boolean;
}

const EMPTY_FORM: ConfigForm = {
  name: "",
  provider: "",
  api_type: "economic",
  base_url: "",
  endpoint_url: "",
  api_key: "",
  secret_key: "",
  client_id: "",
  client_secret: "",
  bearer_token: "",
  custom_headers: "",
  refresh_frequency_hours: 24,
  source_priority: 1,
  country_filters: "",
  report_categories: "",
  is_active: true,
};

function healthBadge(status: string) {
  const sentiment = apiHealthSentiment(status);
  const normalized = status.toLowerCase();
  const icon =
    sentiment === "positive"
      ? CheckCircle2
      : sentiment === "caution"
        ? AlertCircle
        : XCircle;
  return {
    icon,
    style: {
      color: sentimentClass(sentiment),
      backgroundColor: sentimentClass(sentiment, "bg"),
    },
    label: normalized === "healthy" ? "Healthy" : normalized === "degraded" ? "Warning" : normalized === "down" ? "Offline" : status,
  };
}

function parseList(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function ApiConfigPage() {
  const [configs, setConfigs] = useState<ApiConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ConfigForm>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedLogs, setSelectedLogs] = useState<ApiConfig | null>(null);
  const [testResult, setTestResult] = useState<{
    id: string;
    success: boolean;
    message: string;
    response_time_ms?: number | null;
    diagnostics?: Record<string, unknown>;
  } | null>(null);
  const [healthOverview, setHealthOverview] = useState<{
    total: number;
    active: number;
    healthy: number;
    warning: number;
    offline: number;
    apis: Array<Record<string, unknown>>;
  } | null>(null);
  const [logFilter, setLogFilter] = useState<"all" | "success" | "failed">("all");
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadConfigs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [listRes, healthRes] = await Promise.all([
        apiConfigsAPI.list(),
        apiConfigsAPI.health(),
      ]);
      setConfigs(Array.isArray(listRes.data) ? listRes.data : []);
      setHealthOverview(healthRes.data as typeof healthOverview);
    } catch {
      setError("Failed to load API configurations.");
      setConfigs([]);
      setHealthOverview(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfigs();
  }, [loadConfigs]);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
    setError(null);
  };

  const openEdit = (config: ApiConfig) => {
    setEditingId(config.id);
    setForm({
      name: config.name,
      provider: config.provider,
      api_type: config.api_type,
      base_url: config.base_url ?? "",
      endpoint_url: config.endpoint_url,
      api_key: "",
      secret_key: "",
      client_id: "",
      client_secret: "",
      bearer_token: "",
      custom_headers: JSON.stringify(config.custom_headers ?? {}, null, 0),
      refresh_frequency_hours: config.refresh_frequency_hours,
      source_priority: config.source_priority,
      country_filters: config.country_filters.join(", "),
      report_categories: config.report_categories.join(", "),
      is_active: config.is_active,
    });
    setShowForm(true);
    setError(null);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.provider.trim() || !form.endpoint_url.trim()) {
      setError("Name, provider, and endpoint URL are required.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      let customHeaders: Record<string, string> = {};
      if (form.custom_headers.trim()) {
        try {
          customHeaders = JSON.parse(form.custom_headers) as Record<string, string>;
        } catch {
          setError("Custom headers must be valid JSON.");
          setSaving(false);
          return;
        }
      }

      const credentials: Record<string, string> = {};
      if (form.secret_key.trim()) credentials.secret_key = form.secret_key.trim();
      if (form.client_id.trim()) credentials.client_id = form.client_id.trim();
      if (form.client_secret.trim()) credentials.client_secret = form.client_secret.trim();
      if (form.bearer_token.trim()) credentials.bearer_token = form.bearer_token.trim();

      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        provider: form.provider.trim(),
        api_type: form.api_type,
        base_url: form.base_url.trim() || null,
        endpoint_url: form.endpoint_url.trim(),
        refresh_frequency_hours: form.refresh_frequency_hours,
        source_priority: form.source_priority,
        country_filters: parseList(form.country_filters),
        report_categories: parseList(form.report_categories),
        is_active: form.is_active,
        custom_headers: customHeaders,
        credentials,
      };
      if (form.api_key.trim()) {
        payload.api_key = form.api_key.trim();
      }

      if (editingId) {
        await apiConfigsAPI.update(editingId, payload);
        toast.success(MESSAGES.admin.apiUpdated);
        setSuccess(MESSAGES.admin.apiUpdated);
      } else {
        await apiConfigsAPI.create(payload);
        toast.success(MESSAGES.admin.apiAdded);
        setSuccess(MESSAGES.admin.apiAdded);
      }

      closeForm();
      await loadConfigs();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      const message = handleApiError(
        err,
        "API config save",
        "Failed to save configuration. Please check your inputs.",
        false,
      );
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setError(null);
    try {
      await apiConfigsAPI.delete(deleteTarget.id);
      toast.success(MESSAGES.admin.apiDeleted);
      setSuccess(MESSAGES.admin.apiDeleted);
      setDeleteTarget(null);
      await loadConfigs();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      handleApiError(err, "API config delete", "Failed to delete configuration.");
    } finally {
      setDeleting(false);
    }
  };

  const handleTest = async (id: string) => {
    setTestingId(id);
    setTestResult(null);
    setError(null);
    try {
      const { data } = await apiConfigsAPI.test(id);
      const result = data as {
        success: boolean;
        message: string;
        health_status: string;
        response_time_ms?: number | null;
        diagnostics?: Record<string, unknown>;
      };
      setTestResult({
        id,
        success: result.success,
        message: result.message,
        response_time_ms: result.response_time_ms,
        diagnostics: result.diagnostics,
      });
      if (result.success) {
        toast.success("API connection successful.");
      } else if (result.message.toLowerCase().includes("high")) {
        toast.warning(MESSAGES.admin.apiWarning);
      } else {
        toast.error(MESSAGES.admin.apiConnectionFailed);
      }
      await loadConfigs();
    } catch {
      setTestResult({
        id,
        success: false,
        message: "Connection test failed.",
      });
      toast.error(MESSAGES.admin.apiConnectionFailed);
    } finally {
      setTestingId(null);
    }
  };

  const handleSync = async (id: string) => {
    setSyncingId(id);
    try {
      const { data } = await apiConfigsAPI.sync(id);
      const result = data as { success: boolean; message: string };
      if (result.success) toast.success("API sync successful.");
      else toast.error(result.message);
      await loadConfigs();
    } catch {
      toast.error("API sync failed.");
    } finally {
      setSyncingId(null);
    }
  };

  const handleRefreshReports = async () => {
    setRefreshing(true);
    setError(null);
    try {
      const { data } = await apiConfigsAPI.refreshReports();
      const result = data as { synced?: number };
      const msg = `Reports refreshed. ${result.synced ?? 0} items synced.`;
      setSuccess(msg);
      toast.success(MESSAGES.reports.generated);
      await loadConfigs();
      setTimeout(() => setSuccess(null), 4000);
    } catch (err) {
      handleApiError(err, "Refresh reports", "Failed to refresh reports.", false);
      setError("Failed to refresh reports.");
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--text-muted)]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--text-faint)]">
            Admin
          </p>
          <h1 className="mt-1 text-2xl font-bold text-[var(--text-primary)] sm:text-3xl">
            API Configuration Center
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Manage external data sources, test connections, and sync reports
          </p>
        </div>
        <div className="flex gap-2">
          <button
            id="refresh-reports-btn"
            onClick={handleRefreshReports}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-hover)] bg-[var(--accent-faint)] px-4 py-2.5 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--glass-bg-hover)] disabled:opacity-40 transition"
          >
            {refreshing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Refresh Reports
          </button>
          <button
            id="add-api-config-btn"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent-faint)] border border-[var(--border-hover)] px-4 py-2.5 text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--glass-bg-hover)] transition"
          >
            <Plus className="w-4 h-4" />
            Add API
          </button>
        </div>
      </motion.div>

      {/* Alerts */}
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
            <button onClick={() => setError(null)} className="ml-auto">
              <X className="w-4 h-4" />
            </button>
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

      {/* Config List */}
      {configs.length === 0 ? (
        <EmptyState
          icon={Plug}
          title="No API configurations"
          description="Add your first external data source to begin ingesting economic data and reports."
          action={
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-xl bg-[var(--accent-faint)] border border-[var(--border-hover)] text-[var(--text-primary)] hover:bg-[var(--glass-bg-hover)] transition"
            >
              <Plus className="w-4 h-4" />
              Add API
            </button>
          }
        />
      ) : (
        <div className="grid gap-4">
          {configs.map((config, i) => {
            const health = healthBadge(config.health_status);
            const HealthIcon = health.icon;
            const testFeedback =
              testResult?.id === config.id ? testResult : null;

            return (
              <motion.div
                key={config.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="glass-card rounded-xl hover:transform-none p-5"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="text-base font-semibold text-[var(--text-primary)]">
                        {config.name}
                      </h3>
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
                        style={health.style}
                      >
                        <HealthIcon className="w-3 h-3" />
                        {health.label}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          config.is_active
                            ? "bg-[var(--accent-faint)] text-[var(--text-primary)]"
                            : "bg-[var(--accent-faint)] text-[var(--text-muted)]"
                        }`}
                      >
                        {config.is_active ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-[var(--text-muted)]">
                      {config.provider} · {config.api_type}
                    </p>
                    <p className="mt-1 text-xs text-[var(--text-faint)] font-mono truncate">
                      {config.endpoint_url}
                    </p>

                    <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div>
                        <p className="text-[var(--text-faint)]">API Key</p>
                        <p className="text-[var(--text-muted)]">
                          {config.api_key_set ? "Configured" : "Not set"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[var(--text-faint)]">Refresh</p>
                        <p className="text-[var(--text-muted)]">
                          Every {config.refresh_frequency_hours}h
                        </p>
                      </div>
                      <div>
                        <p className="text-[var(--text-faint)]">Last Tested</p>
                        <p className="text-[var(--text-muted)]">
                          {formatDateTime(config.last_tested_at)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[var(--text-faint)]">Last Sync</p>
                        <p className="text-[var(--text-muted)]">
                          {formatDateTime(config.last_sync_at)}
                        </p>
                      </div>
                    </div>

                    {testFeedback && (
                      <div className="mt-2 text-xs">
                        <p style={{ color: sentimentClass(testFeedback.success ? "positive" : "negative") }}>
                          {testFeedback.success ? "Connection Successful" : "Connection Failed"}: {testFeedback.message}
                        </p>
                        {testFeedback.response_time_ms != null && (
                          <p className="text-[var(--text-faint)]">
                            Response: {testFeedback.response_time_ms}ms
                          </p>
                        )}
                      </div>
                    )}
                    {config.health_metrics && (
                      <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
                        <div>
                          <p className="text-[var(--text-faint)]">Response Time</p>
                          <p style={{ color: sentimentClass("info") }}>
                            {config.health_metrics.response_time_ms != null
                              ? `${config.health_metrics.response_time_ms}ms`
                              : "—"}
                          </p>
                        </div>
                        <div>
                          <p className="text-[var(--text-faint)]">Error Rate</p>
                          <p style={{
                            color: sentimentClass(
                              (config.health_metrics.error_rate ?? 0) > 20 ? "negative"
                                : (config.health_metrics.error_rate ?? 0) > 5 ? "caution" : "positive",
                            ),
                          }}>
                            {config.health_metrics.error_rate ?? 0}%
                          </p>
                        </div>
                        <div>
                          <p className="text-[var(--text-faint)]">Usage</p>
                          <p className="text-[var(--text-muted)]">{config.health_metrics.usage_count ?? 0}</p>
                        </div>
                        <div>
                          <p className="text-[var(--text-faint)]">Last Failed</p>
                          <p className="text-[var(--text-muted)]">
                            {formatDateTime(config.last_failed_sync_at ?? null)}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      id={`sync-${config.id}`}
                      onClick={() => void handleSync(config.id)}
                      disabled={syncingId === config.id}
                      title="Refresh API"
                      className="p-2 rounded-lg border border-[var(--border-primary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-faint)] disabled:opacity-40 transition"
                    >
                      {syncingId === config.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      id={`test-${config.id}`}
                      onClick={() => handleTest(config.id)}
                      disabled={testingId === config.id}
                      title="Test connection"
                      className="p-2 rounded-lg border border-[var(--border-primary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-faint)] disabled:opacity-40 transition"
                    >
                      {testingId === config.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      id={`logs-${config.id}`}
                      onClick={() => setSelectedLogs(config)}
                      title="View logs"
                      className="p-2 rounded-lg border border-[var(--border-primary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-faint)] transition"
                    >
                      <ScrollText className="w-4 h-4" />
                    </button>
                    <button
                      id={`edit-${config.id}`}
                      onClick={() => openEdit(config)}
                      title="Edit"
                      className="p-2 rounded-lg border border-[var(--border-primary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-faint)] transition"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      id={`delete-${config.id}`}
                      onClick={() =>
                        setDeleteTarget({ id: config.id, name: config.name })
                      }
                      title="Delete"
                      className="p-2 rounded-lg border border-[var(--border-primary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-faint)] transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* API Health Dashboard */}
      {healthOverview && (
        <div className="glass-card rounded-xl hover:transform-none p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-[var(--text-primary)]" />
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">API Health Dashboard</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: "Total APIs", value: healthOverview.total, sentiment: "info" as const },
              { label: "Active", value: healthOverview.active, sentiment: "info" as const },
              { label: "Healthy", value: healthOverview.healthy, sentiment: "positive" as const },
              { label: "Warning", value: healthOverview.warning, sentiment: "caution" as const },
              { label: "Offline", value: healthOverview.offline, sentiment: "negative" as const },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-lg border border-[var(--border-primary)] p-3"
                style={{ backgroundColor: sentimentClass(stat.sentiment, "bg") }}
              >
                <p className="text-[10px] uppercase tracking-wider text-[var(--text-faint)]">{stat.label}</p>
                <p className="text-xl font-bold mt-1" style={{ color: sentimentClass(stat.sentiment) }}>
                  {stat.value}
                </p>
              </div>
            ))}
          </div>
          {healthOverview.apis.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[var(--border-primary)] text-[var(--text-muted)]">
                    {["API", "Status", "Response", "Error Rate", "Last Sync", "Usage"].map((h) => (
                      <th key={h} className="py-2 pr-4 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {healthOverview.apis.map((api) => {
                    const status = String(api.status ?? "unknown");
                    const sent = apiHealthSentiment(status);
                    return (
                      <tr key={String(api.id)} className="border-b border-[var(--border-primary)] last:border-0">
                        <td className="py-2 pr-4 text-[var(--text-primary)]">{String(api.name)}</td>
                        <td className="py-2 pr-4" style={{ color: sentimentClass(sent) }}>{status}</td>
                        <td className="py-2 pr-4" style={{ color: sentimentClass("info") }}>
                          {api.response_time_ms != null ? `${api.response_time_ms}ms` : "—"}
                        </td>
                        <td className="py-2 pr-4" style={{
                          color: sentimentClass(
                            Number(api.error_rate) > 20 ? "negative" : Number(api.error_rate) > 5 ? "caution" : "positive",
                          ),
                        }}>
                          {api.error_rate != null ? `${api.error_rate}%` : "—"}
                        </td>
                        <td className="py-2 pr-4 text-[var(--text-muted)]">
                          {api.last_successful_sync ? formatDateTime(String(api.last_successful_sync)) : "—"}
                        </td>
                        <td className="py-2 text-[var(--text-muted)]">{String(api.usage_count ?? 0)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Add/Edit Form Modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={closeForm}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg glass-panel rounded-2xl p-6 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-[var(--text-primary)]">
                  {editingId ? "Edit API Configuration" : "Add API Configuration"}
                </h2>
                <button
                  onClick={closeForm}
                  className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                {[
                  { id: "name", label: "Name", key: "name" as const },
                  { id: "provider", label: "Provider", key: "provider" as const },
                  {
                    id: "endpoint",
                    label: "Endpoint URL",
                    key: "endpoint_url" as const,
                  },
                ].map((field) => (
                  <div key={field.id}>
                    <label
                      htmlFor={`form-${field.id}`}
                      className="mb-1.5 block text-sm font-medium text-[var(--text-muted)]"
                    >
                      {field.label}
                    </label>
                    <input
                      id={`form-${field.id}`}
                      type="text"
                      value={form[field.key]}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, [field.key]: e.target.value }))
                      }
                      className="w-full rounded-xl border border-[var(--border-hover)] bg-[var(--accent-faint)] px-4 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-active)] transition"
                    />
                  </div>
                ))}

                <div>
                  <label
                    htmlFor="form-api-type"
                    className="mb-1.5 block text-sm font-medium text-[var(--text-muted)]"
                  >
                    API Type
                  </label>
                  <select
                    id="form-api-type"
                    value={form.api_type}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, api_type: e.target.value }))
                    }
                    className="w-full rounded-xl border border-[var(--border-hover)] bg-[var(--accent-faint)] px-4 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-active)] transition"
                  >
                    <option value="economic">Economic Data</option>
                    <option value="reports">Reports</option>
                    <option value="news">News</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="form-base-url" className="mb-1.5 block text-sm font-medium text-[var(--text-muted)]">
                    Base URL
                  </label>
                  <input
                    id="form-base-url"
                    type="text"
                    value={form.base_url}
                    onChange={(e) => setForm((f) => ({ ...f, base_url: e.target.value }))}
                    placeholder="https://api.example.com"
                    className="w-full rounded-xl border border-[var(--border-hover)] bg-[var(--accent-faint)] px-4 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-active)] transition"
                  />
                </div>

                {[
                  { id: "api-key", label: "API Key", key: "api_key" as const },
                  { id: "secret-key", label: "Secret Key", key: "secret_key" as const },
                  { id: "client-id", label: "Client ID", key: "client_id" as const },
                  { id: "client-secret", label: "Client Secret", key: "client_secret" as const },
                  { id: "bearer-token", label: "Bearer Token", key: "bearer_token" as const },
                ].map((field) => (
                  <div key={field.id}>
                    <label htmlFor={`form-${field.id}`} className="mb-1.5 block text-sm font-medium text-[var(--text-muted)]">
                      {field.label} {editingId && field.key === "api_key" && "(leave blank to keep existing)"}
                    </label>
                    <input
                      id={`form-${field.id}`}
                      type="password"
                      value={form[field.key]}
                      onChange={(e) => setForm((f) => ({ ...f, [field.key]: e.target.value }))}
                      placeholder="••••••••"
                      className="w-full rounded-xl border border-[var(--border-hover)] bg-[var(--accent-faint)] px-4 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-active)] transition"
                    />
                  </div>
                ))}

                <div>
                  <label htmlFor="form-custom-headers" className="mb-1.5 block text-sm font-medium text-[var(--text-muted)]">
                    Custom Headers (JSON)
                  </label>
                  <input
                    id="form-custom-headers"
                    type="text"
                    value={form.custom_headers}
                    onChange={(e) => setForm((f) => ({ ...f, custom_headers: e.target.value }))}
                    placeholder='{"X-Custom": "value"}'
                    className="w-full rounded-xl border border-[var(--border-hover)] bg-[var(--accent-faint)] px-4 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-active)] transition"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="form-refresh"
                      className="mb-1.5 block text-sm font-medium text-[var(--text-muted)]"
                    >
                      Refresh (hours)
                    </label>
                    <input
                      id="form-refresh"
                      type="number"
                      min={1}
                      max={168}
                      value={form.refresh_frequency_hours}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          refresh_frequency_hours: Number(e.target.value),
                        }))
                      }
                      className="w-full rounded-xl border border-[var(--border-hover)] bg-[var(--accent-faint)] px-4 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-active)] transition"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="form-priority"
                      className="mb-1.5 block text-sm font-medium text-[var(--text-muted)]"
                    >
                      Priority
                    </label>
                    <input
                      id="form-priority"
                      type="number"
                      min={1}
                      max={100}
                      value={form.source_priority}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          source_priority: Number(e.target.value),
                        }))
                      }
                      className="w-full rounded-xl border border-[var(--border-hover)] bg-[var(--accent-faint)] px-4 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-active)] transition"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="form-countries"
                    className="mb-1.5 block text-sm font-medium text-[var(--text-muted)]"
                  >
                    Country Filters (comma-separated)
                  </label>
                  <input
                    id="form-countries"
                    type="text"
                    value={form.country_filters}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, country_filters: e.target.value }))
                    }
                    placeholder="NG, US, GB"
                    className="w-full rounded-xl border border-[var(--border-hover)] bg-[var(--accent-faint)] px-4 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-active)] transition"
                  />
                </div>

                <div>
                  <label
                    htmlFor="form-categories"
                    className="mb-1.5 block text-sm font-medium text-[var(--text-muted)]"
                  >
                    Report Categories (comma-separated)
                  </label>
                  <input
                    id="form-categories"
                    type="text"
                    value={form.report_categories}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        report_categories: e.target.value,
                      }))
                    }
                    placeholder="inflation, monetary-policy"
                    className="w-full rounded-xl border border-[var(--border-hover)] bg-[var(--accent-faint)] px-4 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-active)] transition"
                  />
                </div>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, is_active: e.target.checked }))
                    }
                    className="rounded border-[var(--border-hover)]"
                  />
                  <span className="text-sm text-[var(--text-muted)]">Active</span>
                </label>
              </div>

              <div className="mt-6 flex gap-3 justify-end">
                <button
                  onClick={closeForm}
                  className="px-4 py-2 text-sm rounded-xl border border-[var(--border-primary)] text-[var(--text-muted)] hover:bg-[var(--accent-faint)] transition"
                >
                  Cancel
                </button>
                <button
                  id="save-api-config-btn"
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-xl bg-[var(--accent-faint)] border border-[var(--border-hover)] text-[var(--text-primary)] hover:bg-[var(--glass-bg-hover)] disabled:opacity-40 transition"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {editingId ? "Update" : "Create"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Logs Modal */}
      <AnimatePresence>
        {selectedLogs && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setSelectedLogs(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg glass-panel rounded-2xl p-6 max-h-[80vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-[var(--text-primary)]">
                    Logs — {selectedLogs.name}
                  </h2>
                  <p className="text-xs text-[var(--text-muted)]">
                    {selectedLogs.provider}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedLogs(null)}
                  className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mb-3 flex gap-2">
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
              {selectedLogs.logs.length === 0 ? (
                <EmptyState
                  icon={ScrollText}
                  title="No logs available"
                  description="Activity logs will appear here after connection tests and sync operations."
                />
              ) : (
                <div className="space-y-2 font-mono text-xs">
                  {selectedLogs.logs
                    .filter((log) => {
                      if (logFilter === "all") return true;
                      if (logFilter === "success") return log.success === true;
                      return log.success === false;
                    })
                    .map((log, i) => (
                    <div
                      key={i}
                      className="rounded-lg border border-[var(--border-primary)] p-3"
                      style={{
                        backgroundColor: sentimentClass(log.success ? "positive" : "negative", "bg"),
                      }}
                    >
                      {Object.entries(log).map(([key, value]) => (
                        <p key={key} className="text-[var(--text-muted)]">
                          <span className="text-[var(--text-faint)]">{key}:</span>{" "}
                          {String(value)}
                        </p>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmDeleteModal
        open={!!deleteTarget}
        itemName={deleteTarget?.name}
        loading={deleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}