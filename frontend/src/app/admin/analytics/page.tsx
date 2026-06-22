'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  BarChart3,
  Download,
  Globe,
  RefreshCw,
  TrendingUp,
  Users,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { ChartTooltipContent } from '@/components/charts/ChartTooltip';
import { adminAPI, getAnalyticsWebSocketUrl } from '@/lib/api';
import { CountryLabel } from '@/components/ui/CountryFlag';
import EmptyState from '@/components/ui/EmptyState';
import { toast } from '@/lib/feedback';

interface AnalyticsPayload {
  has_data?: boolean;
  period_days?: number;
  users?: {
    total?: number;
    active?: number;
    new_registrations?: number;
    login_activity?: number;
    active_sessions?: number;
    growth_trend?: { date: string; count: number }[];
    by_country?: { code: string; name: string; users: number }[];
  };
  predictions?: {
    total?: number;
    period?: number;
    by_country?: { code: string; name: string; predictions: number }[];
    average_confidence?: number;
    confidence_trend?: { date: string; confidence: number }[];
    risk_distribution?: Record<string, number>;
  };
  models?: {
    deployments?: { name: string; version: string; accuracy?: number; rmse?: number; mae?: number; status: string }[];
    training_sessions?: number;
    datasets?: number;
  };
  reports?: { total?: number; views?: number; downloads?: number; categories?: Record<string, number> };
  system?: {
    api_requests?: number;
    api_failures?: number;
    api_success_rate?: number;
    data_points?: number;
    countries_tracked?: number;
  };
  countries?: {
    coverage?: { code: string; name: string; predictions: number; users: number }[];
  };
  engagement?: {
    page_views?: number;
    top_pages?: { path: string; views: number }[];
    events_by_type?: { event_type: string; count: number }[];
    activity_trend?: { date: string; events: number }[];
    registrations?: number;
    google_auth?: number;
    conversion_rate?: number;
  };
}

interface AnalyticsConfig {
  tracking_enabled?: boolean;
  retention_days?: number;
  modules?: Record<string, boolean>;
}

export default function AdminAnalyticsPage() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<AnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [liveEvents, setLiveEvents] = useState<string[]>([]);
  const [config, setConfig] = useState<AnalyticsConfig | null>(null);
  const [configSaving, setConfigSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { data: payload } = await adminAPI.getComprehensiveAnalytics(days);
      setData(payload as AnalyticsPayload);
    } catch {
      setData(null);
      setLoadError('Failed to load analytics. Ensure the backend is running and you are signed in as an admin.');
      toast.error('Failed to load analytics.');
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    void load();
    adminAPI.getAnalyticsConfig().then(({ data }) => setConfig(data as AnalyticsConfig)).catch(() => {});
  }, [load]);

  useEffect(() => {
    const url = getAnalyticsWebSocketUrl();
    if (!url) return;
    const ws = new WebSocket(url);
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as { event_type?: string };
        if (msg.event_type) {
          setLiveEvents((prev) => [`${msg.event_type} — ${new Date().toLocaleTimeString()}`, ...prev].slice(0, 8));
          void load();
        }
      } catch {
        /* ignore */
      }
    };
    return () => ws.close();
  }, [load]);

  const metrics = useMemo(
    () => [
      { label: 'Total Users', value: data?.users?.total ?? 0, icon: Users },
      { label: 'Predictions', value: data?.predictions?.total ?? 0, icon: TrendingUp },
      { label: 'Active Sessions', value: data?.users?.active_sessions ?? 0, icon: Activity },
      { label: 'Countries', value: data?.system?.countries_tracked ?? 0, icon: Globe },
    ],
    [data],
  );

  const downloadBlob = (blob: Blob, filename: string) => {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const exportCsv = async () => {
    const { data: blob } = await adminAPI.exportAnalyticsCsv(days);
    downloadBlob(blob as Blob, `analytics_${days}d.csv`);
    toast.success('CSV exported.');
  };

  const exportJson = async () => {
    const { data: blob } = await adminAPI.exportAnalyticsJson(days);
    downloadBlob(blob as Blob, `analytics_${days}d.json`);
    toast.success('JSON exported.');
  };

  const resetAnalytics = async () => {
    if (!confirm('Reset all analytics events? Users, predictions, and reports are kept.')) return;
    await adminAPI.resetAnalytics();
    toast.success('Analytics reset.');
    await load();
  };

  if (!loading && loadError) {
    return (
      <EmptyState
        icon={BarChart3}
        title="Failed to load analytics"
        description={loadError}
        action={
          <button
            onClick={() => void load()}
            className="rounded-xl border border-[var(--border-hover)] bg-[var(--accent-faint)] px-4 py-2 text-sm text-[var(--text-primary)] transition hover:bg-[var(--glass-bg-hover)]"
          >
            Retry
          </button>
        }
      />
    );
  }

  if (!loading && data && !data.has_data) {
    return (
      <EmptyState
        icon={BarChart3}
        title="No analytics data available yet."
        description="Real metrics will appear as users register, sign in, and generate predictions."
      />
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Platform Analytics</h1>
          <p className="text-sm text-[var(--text-muted)]">Real-time metrics from genuine platform activity only.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="rounded-lg border border-[var(--border-primary)] bg-[var(--glass-bg)] px-3 py-2 text-sm text-[var(--text-primary)]"
          >
            {[7, 30, 90, 365].map((d) => (
              <option key={d} value={d}>{d} days</option>
            ))}
          </select>
          <button onClick={() => void load()} className="rounded-lg border border-[var(--border-primary)] p-2">
            <RefreshCw className="h-4 w-4" />
          </button>
          <button onClick={() => void exportCsv()} className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-primary)] px-3 py-2 text-xs">
            <Download className="h-3 w-3" /> CSV
          </button>
          <button onClick={() => void exportJson()} className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-primary)] px-3 py-2 text-xs">
            <Download className="h-3 w-3" /> JSON
          </button>
          <button onClick={() => void resetAnalytics()} className="rounded-lg border border-[var(--border-primary)] px-3 py-2 text-xs text-[var(--text-muted)]">
            Reset
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {metrics.map((m, i) => (
          <motion.div
            key={m.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="glass-card rounded-xl hover:transform-none p-5"
          >
            <m.icon className="mb-2 h-4 w-4 text-[var(--text-primary)]" />
            <p className="text-xs text-[var(--text-muted)]">{m.label}</p>
            <p className="text-2xl font-bold text-[var(--text-primary)]">{loading ? '—' : m.value}</p>
          </motion.div>
        ))}
      </div>

      {liveEvents.length > 0 && (
        <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--accent-faint)] p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Live activity</p>
          <ul className="mt-2 space-y-1 text-xs text-[var(--text-secondary)]">
            {liveEvents.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="glass-card rounded-xl hover:transform-none p-5">
          <h3 className="mb-4 text-sm font-semibold text-[var(--text-primary)]">User Growth</h3>
          {(data?.users?.growth_trend?.length ?? 0) > 0 ? (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data?.users?.growth_trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                  <Tooltip content={<ChartTooltipContent />} />
                  <Area type="monotone" dataKey="count" name="Registrations" stroke="var(--chart-primary)" fill="var(--accent-faint)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-[var(--text-muted)]">No registration trend data yet.</p>
          )}
        </div>

        <div className="glass-card rounded-xl hover:transform-none p-5">
          <h3 className="mb-4 text-sm font-semibold text-[var(--text-primary)]">Predictions by Country</h3>
          {(data?.predictions?.by_country?.length ?? 0) > 0 ? (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.predictions?.by_country}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" />
                  <XAxis dataKey="code" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                  <Tooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="predictions" name="Predictions" fill="var(--chart-primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-[var(--text-muted)]">No prediction data yet.</p>
          )}
        </div>
      </div>

      <div className="glass-card rounded-xl hover:transform-none p-5">
        <h3 className="mb-4 text-sm font-semibold text-[var(--text-primary)]">Country Coverage</h3>
        <div className="space-y-2">
          {(data?.countries?.coverage ?? []).slice(0, 10).map((c) => (
            <div key={c.code} className="flex items-center justify-between rounded-lg bg-[var(--accent-faint)] px-3 py-2">
              <CountryLabel code={c.code} name={c.name} flagSize="sm" />
              <span className="text-xs text-[var(--text-muted)]">
                {c.predictions} predictions · {c.users} users
              </span>
            </div>
          ))}
          {(data?.countries?.coverage?.length ?? 0) === 0 && (
            <p className="text-sm text-[var(--text-muted)]">No country analytics yet.</p>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="glass-card rounded-xl hover:transform-none p-4">
          <p className="text-xs text-[var(--text-muted)]">Page Views</p>
          <p className="text-xl font-bold text-[var(--text-primary)]">{data?.engagement?.page_views ?? 0}</p>
        </div>
        <div className="glass-card rounded-xl hover:transform-none p-4">
          <p className="text-xs text-[var(--text-muted)]">Conversion Rate</p>
          <p className="text-xl font-bold text-[var(--text-primary)]">{data?.engagement?.conversion_rate ?? 0}%</p>
        </div>
        <div className="glass-card rounded-xl hover:transform-none p-4">
          <p className="text-xs text-[var(--text-muted)]">API Success Rate</p>
          <p className="text-xl font-bold text-[var(--text-primary)]">{data?.system?.api_success_rate ?? 100}%</p>
        </div>
        <div className="glass-card rounded-xl hover:transform-none p-4">
          <p className="text-xs text-[var(--text-muted)]">Report Downloads</p>
          <p className="text-xl font-bold text-[var(--text-primary)]">{data?.reports?.downloads ?? 0}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="glass-card rounded-xl p-5">
          <h3 className="mb-4 text-sm font-semibold text-[var(--text-primary)]">Top Pages</h3>
          <div className="space-y-2">
            {(data?.engagement?.top_pages ?? []).map((p) => (
              <div key={p.path} className="flex justify-between rounded-lg bg-[var(--accent-faint)] px-3 py-2 text-xs">
                <span className="text-[var(--text-secondary)]">{p.path}</span>
                <span className="text-[var(--text-muted)]">{p.views} views</span>
              </div>
            ))}
            {(data?.engagement?.top_pages?.length ?? 0) === 0 && (
              <p className="text-sm text-[var(--text-muted)]">No page views recorded yet.</p>
            )}
          </div>
        </div>
        <div className="glass-card rounded-xl p-5">
          <h3 className="mb-4 text-sm font-semibold text-[var(--text-primary)]">Events by Type</h3>
          <div className="space-y-2">
            {(data?.engagement?.events_by_type ?? []).map((e) => (
              <div key={e.event_type} className="flex justify-between rounded-lg bg-[var(--accent-faint)] px-3 py-2 text-xs">
                <span className="text-[var(--text-secondary)]">{e.event_type}</span>
                <span className="font-medium text-[var(--text-primary)]">{e.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {(data?.engagement?.activity_trend?.length ?? 0) > 0 && (
        <div className="glass-card rounded-xl p-5">
          <h3 className="mb-4 text-sm font-semibold text-[var(--text-primary)]">Activity Trend</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.engagement?.activity_trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                <Tooltip content={<ChartTooltipContent />} />
                <Area type="monotone" dataKey="events" name="Events" stroke="var(--chart-primary)" fill="var(--accent-faint)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {config && (
        <div className="glass-card rounded-xl p-5">
          <h3 className="mb-4 text-sm font-semibold text-[var(--text-primary)]">Analytics Configuration</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
              <input
                type="checkbox"
                checked={config.tracking_enabled ?? true}
                onChange={(e) => setConfig({ ...config, tracking_enabled: e.target.checked })}
              />
              Tracking enabled
            </label>
            <div>
              <label className="text-xs text-[var(--text-muted)]">Retention (days)</label>
              <input
                type="number"
                min={7}
                max={365}
                value={config.retention_days ?? 90}
                onChange={(e) => setConfig({ ...config, retention_days: Number(e.target.value) })}
                className="mt-1 w-full rounded-lg border border-[var(--border-primary)] bg-[var(--glass-bg)] px-3 py-2 text-sm"
              />
            </div>
          </div>
          <button
            disabled={configSaving}
            onClick={async () => {
              setConfigSaving(true);
              try {
                await adminAPI.updateAnalyticsConfig(config as Record<string, unknown>);
                toast.success('Analytics config saved.');
              } catch {
                toast.error('Failed to save config.');
              } finally {
                setConfigSaving(false);
              }
            }}
            className="mt-4 rounded-lg border border-[var(--border-primary)] px-4 py-2 text-xs text-[var(--text-primary)]"
          >
            {configSaving ? 'Saving…' : 'Save Config'}
          </button>
        </div>
      )}
    </div>
  );
}