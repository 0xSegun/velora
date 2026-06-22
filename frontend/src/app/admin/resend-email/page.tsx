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
  Mail,
  Activity,
  ScrollText,
  X,
  Power,
  PowerOff,
  BarChart3,
  Globe,
  Users,
  Send,
  Radio,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { chartTooltipProps } from "@/components/charts/ChartTooltip";
import {
  resendAPI,
  type ResendAuditLog,
  type ResendConfig,
  type ResendStatistics,
} from "@/lib/api";
import { handleApiError } from "@/lib/errorHandler";
import { toast } from "@/lib/feedback";
import { formatDateTime } from "@/lib/dates";
import { apiHealthSentiment, sentimentClass } from "@/lib/financialColors";
import EmptyState from "@/components/ui/EmptyState";

interface ConfigForm {
  provider_name: string;
  api_key: string;
  from_email: string;
  reply_to: string;
  open_tracking: boolean;
  click_tracking: boolean;
}

interface HealthData {
  provider: string;
  status: string;
  is_active: boolean;
  response_time_ms?: number | null;
  last_sync?: string | null;
  error_count: number;
  success_count: number;
  success_rate?: number | null;
  from_email?: string | null;
  domains_verified?: number | null;
  domains_total?: number | null;
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

function eventColor(event: string): string {
  const colors: Record<string, string> = {
    delivered: "var(--text-primary)",
    opened: "#3b82f6",
    clicked: "#8b5cf6",
    bounced: "#ef4444",
    complained: "#f97316",
    failed: "#dc2626",
    scheduled: "#6b7280",
  };
  return colors[event] ?? "var(--text-muted)";
}

const EMPTY_STATS: ResendStatistics = {
  summary: {},
  event_breakdown: [],
  domains: [],
  recent_emails: [],
  contacts_sample: [],
  broadcasts: [],
  api_usage: [],
};

function normalizeResendStatistics(raw: unknown): ResendStatistics {
  if (!raw || typeof raw !== "object") return EMPTY_STATS;
  const r = raw as Record<string, unknown>;
  const summary =
    r.summary && typeof r.summary === "object" && !Array.isArray(r.summary)
      ? (r.summary as Record<string, unknown>)
      : {};
  return {
    summary,
    event_breakdown: Array.isArray(r.event_breakdown) ? r.event_breakdown : [],
    domains: Array.isArray(r.domains) ? r.domains : [],
    recent_emails: Array.isArray(r.recent_emails) ? r.recent_emails : [],
    contacts_sample: Array.isArray(r.contacts_sample) ? r.contacts_sample : [],
    broadcasts: Array.isArray(r.broadcasts) ? r.broadcasts : [],
    api_usage: Array.isArray(r.api_usage) ? r.api_usage : [],
  };
}

function summaryValue(summary: Record<string, unknown>, key: string): string {
  const value = summary[key];
  return value === null || value === undefined ? "—" : String(value);
}

export default function ResendEmailPage() {
  const [config, setConfig] = useState<ResendConfig | null>(null);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [stats, setStats] = useState<ResendStatistics | null>(null);
  const [logs, setLogs] = useState<ApiLog[]>([]);
  const [auditLogs, setAuditLogs] = useState<ResendAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [refreshingStats, setRefreshingStats] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    response_time_ms?: number | null;
  } | null>(null);
  const [testEmail, setTestEmail] = useState("");
  const [logFilter, setLogFilter] = useState<"all" | "success" | "failed">("all");
  const [form, setForm] = useState<ConfigForm>({
    provider_name: "Resend",
    api_key: "",
    from_email: "",
    reply_to: "",
    open_tracking: true,
    click_tracking: true,
  });

  const applyConfig = useCallback((cfg: ResendConfig) => {
    setConfig(cfg);
    setForm({
      provider_name: cfg.provider_name,
      api_key: "",
      from_email: cfg.from_email ?? "",
      reply_to: cfg.reply_to ?? "",
      open_tracking: cfg.open_tracking,
      click_tracking: cfg.click_tracking,
    });
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const { data } = await resendAPI.getStatistics();
      setStats(normalizeResendStatistics(data));
    } catch (err) {
      handleApiError(err, "Resend statistics", undefined, false);
      setStats(EMPTY_STATS);
    }
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const configRes = await resendAPI.getConfig();
      const cfg = configRes.data as ResendConfig;
      applyConfig(cfg);

      const [healthRes, auditRes, logsRes, statsRes] = await Promise.allSettled([
        resendAPI.getHealth(),
        resendAPI.getAuditLogs({ limit: 25 }),
        resendAPI.getLogs({ limit: 50 }),
        resendAPI.getStatistics(),
      ]);

      if (healthRes.status === "fulfilled") {
        setHealth(healthRes.value.data as HealthData);
      }
      if (auditRes.status === "fulfilled") {
        setAuditLogs(
          Array.isArray(auditRes.value.data)
            ? (auditRes.value.data as ResendAuditLog[])
            : [],
        );
      }
      if (logsRes.status === "fulfilled") {
        setLogs(Array.isArray(logsRes.value.data) ? (logsRes.value.data as ApiLog[]) : []);
      }
      if (statsRes.status === "fulfilled") {
        setStats(normalizeResendStatistics(statsRes.value.data));
      } else {
        setStats(EMPTY_STATS);
      }
    } catch (err) {
      const message = handleApiError(
        err,
        "Resend config load",
        "Failed to load Resend email configuration.",
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

  const loadLogs = useCallback(async (filter: "all" | "success" | "failed") => {
    const params =
      filter === "all"
        ? { limit: 50 }
        : { limit: 50, status: filter === "success" ? "success" : "failed" };
    const logsRes = await resendAPI.getLogs(params);
    setLogs(Array.isArray(logsRes.data) ? (logsRes.data as ApiLog[]) : []);
  }, []);

  useEffect(() => {
    void loadLogs(logFilter);
  }, [logFilter, loadLogs]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        provider_name: form.provider_name.trim(),
        from_email: form.from_email.trim() || null,
        reply_to: form.reply_to.trim() || null,
        open_tracking: form.open_tracking,
        click_tracking: form.click_tracking,
      };
      if (form.api_key.trim()) {
        payload.api_key = form.api_key.trim();
      }
      const { data } = await resendAPI.updateConfig(payload);
      applyConfig(data as ResendConfig);
      toast.success("Resend configuration saved.");
      setSuccess("Configuration saved successfully.");
      void loadStats();
      void resendAPI.getHealth().then((res) => setHealth(res.data as HealthData)).catch(() => undefined);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      const message = handleApiError(err, "Resend config save", "Failed to save configuration.", false);
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const payload = form.api_key.trim() ? { api_key: form.api_key.trim() } : undefined;
      const { data } = await resendAPI.testConnection(payload);
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

  const handleSendTest = async () => {
    if (!testEmail.trim()) {
      toast.error("Enter a recipient email address.");
      return;
    }
    setSendingTest(true);
    try {
      const payload: { to: string; api_key?: string } = { to: testEmail.trim() };
      if (form.api_key.trim()) payload.api_key = form.api_key.trim();
      const { data } = await resendAPI.sendTestEmail(payload);
      const result = data as { success: boolean; message: string };
      if (result.success) {
        toast.success(result.message);
        setSuccess(result.message);
        await loadStats();
      } else {
        toast.error(result.message);
      }
      setTimeout(() => setSuccess(null), 4000);
    } catch (err) {
      handleApiError(err, "Send test email", "Failed to send test email.");
    } finally {
      setSendingTest(false);
    }
  };

  const handleRefreshStats = async () => {
    setRefreshingStats(true);
    try {
      await loadStats();
      const healthRes = await resendAPI.getHealth();
      setHealth(healthRes.data as HealthData);
      toast.success("Statistics refreshed.");
    } catch (err) {
      handleApiError(err, "Refresh stats", "Failed to refresh statistics.");
    } finally {
      setRefreshingStats(false);
    }
  };

  const handleToggle = async (enable: boolean) => {
    setToggling(true);
    try {
      if (enable) {
        await resendAPI.enable();
        toast.success("Resend email API enabled.");
      } else {
        await resendAPI.disable();
        toast.success("Resend email API disabled.");
      }
      await loadAll();
    } catch (err) {
      handleApiError(err, "Toggle Resend API", "Failed to update API status.");
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
  const safeStats = normalizeResendStatistics(stats);
  const summary = safeStats.summary;
  const statsNotice =
    typeof summary.notice === "string" && summary.notice.trim()
      ? summary.notice.trim()
      : null;
  const chartData = safeStats.event_breakdown
    .filter((item): item is { event: string; count: number } =>
      Boolean(item && typeof item === "object" && "event" in item),
    )
    .map((item) => ({
      name: String(item.event),
      count: Number(item.count) || 0,
      fill: eventColor(String(item.event)),
    }));

  const statCards = [
    { label: "Emails (sample)", value: summaryValue(summary, "total_emails_fetched"), icon: Mail },
    { label: "Delivered", value: summaryValue(summary, "delivered"), icon: CheckCircle2 },
    { label: "Opened", value: summaryValue(summary, "opened"), icon: Activity },
    { label: "Bounced", value: summaryValue(summary, "bounced"), icon: XCircle },
    {
      label: "Domains",
      value: `${summary.domains_verified ?? 0}/${summary.domains_total ?? 0}`,
      icon: Globe,
    },
    { label: "Contacts", value: summaryValue(summary, "contacts_fetched"), icon: Users },
    { label: "Broadcasts", value: summaryValue(summary, "broadcasts_total"), icon: Radio },
    {
      label: "Success Rate",
      value: health?.success_rate != null ? `${health.success_rate}%` : "—",
      icon: BarChart3,
    },
  ];

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
            Resend Email API
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Connect Resend, send transactional email, and view delivery statistics
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => void handleRefreshStats()}
            disabled={refreshingStats}
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-hover)] bg-[var(--accent-faint)] px-4 py-2.5 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--glass-bg-hover)] disabled:opacity-40 transition"
          >
            {refreshingStats ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Refresh Stats
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

      {statsNotice && (
        <div className="flex items-start gap-2 rounded-xl border border-[var(--border-primary)] bg-[var(--accent-faint)] px-4 py-3 text-sm text-[var(--text-muted)]">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <p>{statsNotice}</p>
        </div>
      )}

      {/* Stats overview */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 lg:grid-cols-8">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="glass-card rounded-xl hover:transform-none p-4">
              <div className="flex items-center gap-2 text-[var(--text-faint)]">
                <Icon className="w-3.5 h-3.5" />
                <p className="text-[10px] uppercase tracking-wider">{card.label}</p>
              </div>
              <p className="mt-2 text-lg font-semibold text-[var(--text-primary)]">{card.value}</p>
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Configuration */}
        <div className="glass-card rounded-xl hover:transform-none p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-[var(--text-primary)]" />
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">API Configuration</h2>
          </div>

          <div>
            <label htmlFor="provider" className="mb-1.5 block text-sm font-medium text-[var(--text-muted)]">
              Provider Name
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
              API Endpoint
            </label>
            <p className="rounded-xl border border-[var(--border-hover)] bg-[var(--accent-faint)] px-4 py-2.5 text-sm font-mono text-[var(--text-muted)]">
              https://api.resend.com
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
              placeholder={config?.api_key_set ? "••••••••" : "re_xxxxxxxx"}
              className="w-full rounded-xl border border-[var(--border-hover)] bg-[var(--accent-faint)] px-4 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-active)] transition"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="from-email" className="mb-1.5 block text-sm font-medium text-[var(--text-muted)]">
                From Email
              </label>
              <input
                id="from-email"
                type="text"
                autoComplete="off"
                value={form.from_email}
                onChange={(e) => setForm((f) => ({ ...f, from_email: e.target.value }))}
                placeholder="noreply@yourdomain.com or Velora <noreply@yourdomain.com>"
                className="w-full rounded-xl border border-[var(--border-hover)] bg-[var(--accent-faint)] px-4 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-active)] transition"
              />
            </div>
            <div>
              <label htmlFor="reply-to" className="mb-1.5 block text-sm font-medium text-[var(--text-muted)]">
                Reply-To (optional)
              </label>
              <input
                id="reply-to"
                type="email"
                value={form.reply_to}
                onChange={(e) => setForm((f) => ({ ...f, reply_to: e.target.value }))}
                placeholder="support@yourdomain.com"
                className="w-full rounded-xl border border-[var(--border-hover)] bg-[var(--accent-faint)] px-4 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-active)] transition"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm text-[var(--text-muted)] cursor-pointer">
              <input
                type="checkbox"
                checked={form.open_tracking}
                onChange={(e) => setForm((f) => ({ ...f, open_tracking: e.target.checked }))}
                className="rounded"
              />
              Open tracking
            </label>
            <label className="flex items-center gap-2 text-sm text-[var(--text-muted)] cursor-pointer">
              <input
                type="checkbox"
                checked={form.click_tracking}
                onChange={(e) => setForm((f) => ({ ...f, click_tracking: e.target.checked }))}
                className="rounded"
              />
              Click tracking
            </label>
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

          <div className="flex gap-2 pt-2 flex-wrap">
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

          <div className="border-t border-[var(--border-primary)] pt-4 space-y-3">
            <p className="text-sm font-medium text-[var(--text-muted)]">Send Test Email</p>
            <div className="flex gap-2">
              <input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="recipient@example.com"
                className="flex-1 rounded-xl border border-[var(--border-hover)] bg-[var(--accent-faint)] px-4 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-active)] transition"
              />
              <button
                onClick={() => void handleSendTest()}
                disabled={sendingTest}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-xl border border-[var(--border-primary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-faint)] disabled:opacity-40 transition"
              >
                {sendingTest ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Send
              </button>
            </div>
          </div>
        </div>

        {/* Health */}
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
                { label: "From Email", value: health.from_email ?? "—" },
                { label: "Domains Verified", value: `${health.domains_verified ?? 0} / ${health.domains_total ?? 0}` },
                { label: "Error Count", value: String(health.error_count) },
                { label: "Success Rate", value: health.success_rate != null ? `${health.success_rate}%` : "—" },
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

      {/* Event breakdown chart */}
      {chartData.length > 0 && (
        <div className="glass-card rounded-xl hover:transform-none p-5 space-y-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-[var(--text-primary)]" />
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Email Event Breakdown</h2>
            <span className="text-xs text-[var(--text-faint)]">(from recent sent emails)</span>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" />
                <XAxis dataKey="name" tick={{ fill: "var(--text-faint)", fontSize: 11 }} />
                <YAxis tick={{ fill: "var(--text-faint)", fontSize: 11 }} allowDecimals={false} />
<Tooltip {...chartTooltipProps} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Domains */}
      <div className="glass-card rounded-xl hover:transform-none p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-[var(--text-primary)]" />
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Verified Domains</h2>
        </div>
        {safeStats.domains.length === 0 ? (
          <EmptyState title="No domains" description="Add and verify a domain in your Resend account." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[var(--text-faint)] border-b border-[var(--border-primary)]">
                  <th className="pb-2 pr-4">Domain</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2 pr-4">Region</th>
                  <th className="pb-2">Created</th>
                </tr>
              </thead>
              <tbody>
                {safeStats.domains.map((d) => (
                  <tr key={String(d.id)} className="border-b border-[var(--border-primary)]/50">
                    <td className="py-2 pr-4 text-[var(--text-primary)] font-medium">{String(d.name ?? "—")}</td>
                    <td className="py-2 pr-4">
                      <span
                        className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                        style={{
                          color: sentimentClass(d.status === "verified" ? "positive" : "caution"),
                          backgroundColor: sentimentClass(d.status === "verified" ? "positive" : "caution", "bg"),
                        }}
                      >
                        {String(d.status ?? "—")}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-[var(--text-muted)]">{String(d.region ?? "—")}</td>
                    <td className="py-2 text-[var(--text-muted)]">{formatDateTime(String(d.created_at ?? ""))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent emails */}
      <div className="glass-card rounded-xl hover:transform-none p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Mail className="w-4 h-4 text-[var(--text-primary)]" />
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Recent Sent Emails</h2>
        </div>
        {safeStats.recent_emails.length === 0 ? (
          <EmptyState title="No emails yet" description="Sent emails will appear here once you start sending." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[var(--text-faint)] border-b border-[var(--border-primary)]">
                  <th className="pb-2 pr-4">Subject</th>
                  <th className="pb-2 pr-4">To</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2">Sent</th>
                </tr>
              </thead>
              <tbody>
                {safeStats.recent_emails.map((e) => (
                  <tr key={String(e.id)} className="border-b border-[var(--border-primary)]/50">
                    <td className="py-2 pr-4 text-[var(--text-primary)] max-w-[200px] truncate">
                      {String(e.subject ?? "—")}
                    </td>
                    <td className="py-2 pr-4 text-[var(--text-muted)] max-w-[160px] truncate">
                      {Array.isArray(e.to) ? (e.to as string[]).join(", ") : String(e.to ?? "—")}
                    </td>
                    <td className="py-2 pr-4">
                      <span className="text-[var(--text-muted)]">{String(e.last_event ?? "—")}</span>
                    </td>
                    <td className="py-2 text-[var(--text-muted)]">{formatDateTime(String(e.created_at ?? ""))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Contacts */}
        <div className="glass-card rounded-xl hover:transform-none p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[var(--text-primary)]" />
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Contacts</h2>
          </div>
          {safeStats.contacts_sample.length === 0 ? (
            <EmptyState title="No contacts" description="Marketing contacts from Resend will appear here." />
          ) : (
            <div className="space-y-2">
              {safeStats.contacts_sample.slice(0, 10).map((c) => (
                <div
                  key={String(c.id)}
                  className="flex items-center justify-between rounded-lg border border-[var(--border-primary)] px-3 py-2 text-xs"
                >
                  <div>
                    <p className="text-[var(--text-primary)]">{String(c.email ?? "—")}</p>
                    <p className="text-[var(--text-faint)]">
                      {[c.first_name, c.last_name].filter(Boolean).join(" ") || "—"}
                    </p>
                  </div>
                  {c.unsubscribed ? (
                    <span className="text-[var(--text-faint)]">Unsubscribed</span>
                  ) : (
                    <span className="text-[var(--text-muted)]">Active</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Broadcasts */}
        <div className="glass-card rounded-xl hover:transform-none p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-[var(--text-primary)]" />
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Broadcasts</h2>
          </div>
          {safeStats.broadcasts.length === 0 ? (
            <EmptyState title="No broadcasts" description="Marketing broadcasts from Resend will appear here." />
          ) : (
            <div className="space-y-2">
              {safeStats.broadcasts.slice(0, 10).map((b) => (
                <div
                  key={String(b.id)}
                  className="flex items-center justify-between rounded-lg border border-[var(--border-primary)] px-3 py-2 text-xs"
                >
                  <div>
                    <p className="text-[var(--text-primary)]">{String(b.name ?? "Untitled")}</p>
                    <p className="text-[var(--text-faint)]">{formatDateTime(String(b.created_at ?? ""))}</p>
                  </div>
                  <span className="text-[var(--text-muted)]">{String(b.status ?? "—")}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Resend API usage from provider */}
      {safeStats.api_usage.length > 0 && (
        <div className="glass-card rounded-xl hover:transform-none p-5 space-y-4">
          <div className="flex items-center gap-2">
            <ScrollText className="w-4 h-4 text-[var(--text-primary)]" />
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Resend API Activity</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[var(--text-faint)] border-b border-[var(--border-primary)]">
                  <th className="pb-2 pr-4">Endpoint</th>
                  <th className="pb-2 pr-4">Method</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2">Time</th>
                </tr>
              </thead>
              <tbody>
                {safeStats.api_usage.map((log) => (
                  <tr key={String(log.id)} className="border-b border-[var(--border-primary)]/50">
                    <td className="py-2 pr-4 text-[var(--text-muted)] font-mono">{String(log.endpoint ?? "—")}</td>
                    <td className="py-2 pr-4 text-[var(--text-muted)]">{String(log.method ?? "—")}</td>
                    <td className="py-2 pr-4">
                      <span
                        style={{
                          color: sentimentClass(
                            Number(log.response_status) < 400 ? "positive" : "negative",
                          ),
                        }}
                      >
                        {String(log.response_status ?? "—")}
                      </span>
                    </td>
                    <td className="py-2 text-[var(--text-muted)]">{formatDateTime(String(log.created_at ?? ""))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Internal proxy logs */}
      <div className="glass-card rounded-xl hover:transform-none p-5 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <ScrollText className="w-4 h-4 text-[var(--text-primary)]" />
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Proxy Request Logs</h2>
          </div>
          <div className="flex gap-1">
            {(["all", "success", "failed"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setLogFilter(f)}
                className={`px-3 py-1 text-xs rounded-lg transition ${
                  logFilter === f
                    ? "bg-[var(--accent-faint)] text-[var(--text-primary)]"
                    : "text-[var(--text-faint)] hover:text-[var(--text-muted)]"
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>
        {logs.length === 0 ? (
          <EmptyState title="No logs" description="API proxy requests will be logged here." />
        ) : (
          <div className="overflow-x-auto max-h-64 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-[var(--bg-secondary)]">
                <tr className="text-left text-[var(--text-faint)] border-b border-[var(--border-primary)]">
                  <th className="pb-2 pr-4">Endpoint</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2 pr-4">Time (ms)</th>
                  <th className="pb-2">Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-[var(--border-primary)]/50">
                    <td className="py-2 pr-4 text-[var(--text-muted)] font-mono">{log.endpoint}</td>
                    <td className="py-2 pr-4">
                      <span style={{ color: sentimentClass(log.success ? "positive" : "negative") }}>
                        {log.success ? "OK" : log.status_code ?? "ERR"}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-[var(--text-muted)]">
                      {log.response_time_ms != null ? `${log.response_time_ms}` : "—"}
                    </td>
                    <td className="py-2 text-[var(--text-muted)]">{formatDateTime(log.request_timestamp)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Audit logs */}
      {auditLogs.length > 0 && (
        <div className="glass-card rounded-xl hover:transform-none p-5 space-y-4">
          <div className="flex items-center gap-2">
            <ScrollText className="w-4 h-4 text-[var(--text-primary)]" />
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Audit Trail</h2>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {auditLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-start justify-between gap-4 rounded-lg border border-[var(--border-primary)] px-3 py-2 text-xs"
              >
                <div>
                  <p className="font-medium text-[var(--text-primary)]">{log.action}</p>
                  <p className="text-[var(--text-faint)]">{log.admin_email ?? "System"}</p>
                </div>
                <p className="text-[var(--text-muted)] shrink-0">{formatDateTime(log.created_at)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}