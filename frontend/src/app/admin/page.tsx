'use client';

import { useEffect, useState, type ElementType } from 'react';
import { motion } from 'framer-motion';
import {
  Users, TrendingUp, Brain, Activity, BarChart3, DollarSign, LineChart, Newspaper,
  Landmark, BookOpen, Globe2,
} from 'lucide-react';
import Link from 'next/link';
import { formatDateTime } from '@/lib/dates';
import { sentimentClass } from '@/lib/financialColors';
import { adminAPI } from '@/lib/api';
import EmptyState from '@/components/ui/EmptyState';

interface ExchangeRateStatus {
  provider?: string;
  is_active?: boolean;
  status?: string;
  sync_status?: string;
  last_sync?: string | null;
  next_sync?: string | null;
  success_rate?: number | null;
  error_count?: number;
  api_key_set?: boolean;
}

interface FredStatus {
  provider?: string;
  is_active?: boolean;
  status?: string;
  sync_status?: string;
  last_sync?: string | null;
  indicators_enabled?: number;
  records_retrieved?: number;
  data_quality_score?: number | null;
  model_feature_count?: number;
  failover_warning?: string | null;
}

interface NewsStatus {
  provider?: string;
  is_active?: boolean;
  status?: string;
  sync_status?: string;
  last_sync?: string | null;
  next_sync?: string | null;
  success_rate?: number | null;
  articles_retrieved?: number;
  using_cached_data?: boolean;
}

interface IntegrationStatus {
  provider?: string;
  is_active?: boolean;
  status?: string;
  sync_status?: string;
  last_sync?: string | null;
  next_sync?: string | null;
  success_rate?: number | null;
  countries_synced?: number;
  using_cached_data?: boolean;
}

interface DashboardStats {
  users?: { total?: number; active?: number; new_last_30_days?: number };
  predictions?: { total?: number; last_30_days?: number };
  models?: { active?: number };
  data?: { total_data_points?: number };
  exchange_rate_status?: ExchangeRateStatus;
  fred_status?: FredStatus;
  news_status?: NewsStatus;
  imf_status?: IntegrationStatus;
  wikipedia_status?: IntegrationStatus;
  world_bank_status?: IntegrationStatus;
  trading_economics_status?: IntegrationStatus;
}

function statusColor(status?: string) {
  return sentimentClass(
    status === 'green' ? 'positive' : status === 'red' ? 'negative' : 'caution',
  );
}

function IntegrationStatusCard({
  title,
  icon: Icon,
  href,
  status,
  metrics,
}: {
  title: string;
  icon: ElementType;
  href: string;
  status?: IntegrationStatus;
  metrics: { label: string; value: string }[];
}) {
  if (!status) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-panel rounded-2xl p-5"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-[var(--text-primary)]" />
          <div>
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h2>
            <p className="text-xs text-[var(--text-muted)]">{status.provider}</p>
          </div>
        </div>
        <Link href={href} className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition">
          Manage →
        </Link>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-xs">
        {metrics.map((m) => (
          <div key={m.label}>
            <p className="text-[var(--text-faint)]">{m.label}</p>
            <p
              className="text-[var(--text-muted)]"
              style={m.label === 'Status' ? { color: statusColor(status.status) } : undefined}
            >
              {m.value}
            </p>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void adminAPI
      .getDashboard()
      .then(({ data }) => setStats(data as DashboardStats))
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, []);

  const cards = [
    { label: 'Total Users', value: stats?.users?.total, icon: Users },
    { label: 'Total Predictions', value: stats?.predictions?.total, icon: TrendingUp },
    { label: 'Active Models', value: stats?.models?.active, icon: Brain },
    { label: 'Data Points', value: stats?.data?.total_data_points, icon: Activity },
  ];

  if (!loading && !stats) {
    return (
      <EmptyState
        icon={BarChart3}
        title="No system metrics available"
        description="Admin dashboard metrics will populate once users, predictions, and models exist in the database."
      />
    );
  }

  return (
    <div className="space-y-6">
      <section className="glass-panel rounded-2xl p-6">
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--text-faint)]">System Monitoring</p>
        <h1 className="mt-2 text-3xl font-bold text-[var(--text-primary)]">Admin Dashboard</h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Platform health, usage metrics, and operational overview.
        </p>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-panel rounded-2xl p-5"
          >
            <card.icon className="mb-3 h-5 w-5 text-[var(--text-primary)]" />
            <p className="text-xs text-[var(--text-muted)]">{card.label}</p>
            <p className="mt-1 text-2xl font-bold text-[var(--text-primary)]">
              {loading ? '—' : card.value ?? '0'}
            </p>
          </motion.div>
        ))}
      </div>

      {stats?.fred_status && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel rounded-2xl p-5"
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <LineChart className="h-5 w-5 text-[var(--text-primary)]" />
              <div>
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">FRED API Status</h2>
                <p className="text-xs text-[var(--text-muted)]">{stats.fred_status.provider}</p>
              </div>
            </div>
            <Link href="/admin/fred-api" className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition">
              Manage →
            </Link>
          </div>
          {stats.fred_status.failover_warning && (
            <p className="mt-3 text-xs text-amber-400">{stats.fred_status.failover_warning}</p>
          )}
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5 text-xs">
            <div>
              <p className="text-[var(--text-faint)]">Status</p>
              <p style={{
                color: sentimentClass(
                  stats.fred_status.status === 'green' ? 'positive'
                    : stats.fred_status.status === 'red' ? 'negative' : 'caution',
                ),
              }}>
                {stats.fred_status.status ?? '—'}
              </p>
            </div>
            <div>
              <p className="text-[var(--text-faint)]">Last Sync</p>
              <p className="text-[var(--text-muted)]">{formatDateTime(stats.fred_status.last_sync ?? null)}</p>
            </div>
            <div>
              <p className="text-[var(--text-faint)]">Indicators</p>
              <p className="text-[var(--text-muted)]">{stats.fred_status.indicators_enabled ?? 0}</p>
            </div>
            <div>
              <p className="text-[var(--text-faint)]">Records</p>
              <p className="text-[var(--text-muted)]">{stats.fred_status.records_retrieved ?? 0}</p>
            </div>
            <div>
              <p className="text-[var(--text-faint)]">Model Features</p>
              <p className="text-[var(--text-muted)]">{stats.fred_status.model_feature_count ?? 0}</p>
            </div>
          </div>
        </motion.div>
      )}

      {stats?.exchange_rate_status && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel rounded-2xl p-5"
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-[var(--text-primary)]" />
              <div>
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">Exchange Rate Status</h2>
                <p className="text-xs text-[var(--text-muted)]">{stats.exchange_rate_status.provider}</p>
              </div>
            </div>
            <Link
              href="/admin/exchange-rate-api"
              className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"
            >
              Manage →
            </Link>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-xs">
            <div>
              <p className="text-[var(--text-faint)]">Status</p>
              <p style={{
                color: sentimentClass(
                  stats.exchange_rate_status.status === 'green' ? 'positive'
                    : stats.exchange_rate_status.status === 'red' ? 'negative'
                      : 'caution',
                ),
              }}>
                {stats.exchange_rate_status.status ?? '—'}
              </p>
            </div>
            <div>
              <p className="text-[var(--text-faint)]">Last Sync</p>
              <p className="text-[var(--text-muted)]">{formatDateTime(stats.exchange_rate_status.last_sync ?? null)}</p>
            </div>
            <div>
              <p className="text-[var(--text-faint)]">Next Sync</p>
              <p className="text-[var(--text-muted)]">{formatDateTime(stats.exchange_rate_status.next_sync ?? null)}</p>
            </div>
            <div>
              <p className="text-[var(--text-faint)]">Success Rate</p>
              <p className="text-[var(--text-muted)]">
                {stats.exchange_rate_status.success_rate != null
                  ? `${stats.exchange_rate_status.success_rate}%`
                  : '—'}
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {stats?.news_status && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel rounded-2xl p-5"
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Newspaper className="h-5 w-5 text-[var(--text-primary)]" />
              <div>
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">News API Status</h2>
                <p className="text-xs text-[var(--text-muted)]">{stats.news_status.provider}</p>
              </div>
            </div>
            <Link
              href="/admin/news-api"
              className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"
            >
              Manage →
            </Link>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-xs">
            <div>
              <p className="text-[var(--text-faint)]">Status</p>
              <p style={{ color: statusColor(stats.news_status.status) }}>
                {stats.news_status.status ?? '—'}
              </p>
            </div>
            <div>
              <p className="text-[var(--text-faint)]">Last Sync</p>
              <p className="text-[var(--text-muted)]">{formatDateTime(stats.news_status.last_sync ?? null)}</p>
            </div>
            <div>
              <p className="text-[var(--text-faint)]">Articles Stored</p>
              <p className="text-[var(--text-muted)]">{stats.news_status.articles_retrieved ?? 0}</p>
            </div>
            <div>
              <p className="text-[var(--text-faint)]">Data Source</p>
              <p className="text-[var(--text-muted)]">
                {stats.news_status.using_cached_data ? 'Cached seed data' : 'Live feed'}
              </p>
            </div>
          </div>
        </motion.div>
      )}

      <IntegrationStatusCard
        title="IMF API Status"
        icon={Landmark}
        href="/admin/imf-api"
        status={stats?.imf_status}
        metrics={[
          { label: 'Status', value: stats?.imf_status?.status ?? '—' },
          { label: 'Last Sync', value: formatDateTime(stats?.imf_status?.last_sync ?? null) },
          { label: 'Countries', value: String(stats?.imf_status?.countries_synced ?? 0) },
          {
            label: 'Success Rate',
            value: stats?.imf_status?.success_rate != null ? `${stats.imf_status.success_rate}%` : '—',
          },
        ]}
      />

      <IntegrationStatusCard
        title="Wikipedia API Status"
        icon={BookOpen}
        href="/admin/wikipedia-api"
        status={stats?.wikipedia_status}
        metrics={[
          { label: 'Status', value: stats?.wikipedia_status?.status ?? '—' },
          { label: 'Last Sync', value: formatDateTime(stats?.wikipedia_status?.last_sync ?? null) },
          { label: 'Countries', value: String(stats?.wikipedia_status?.countries_synced ?? 0) },
          {
            label: 'Data Source',
            value: stats?.wikipedia_status?.using_cached_data ? 'Cached' : 'Live',
          },
        ]}
      />

      <IntegrationStatusCard
        title="World Bank API Status"
        icon={Globe2}
        href="/admin/world-bank-api"
        status={stats?.world_bank_status}
        metrics={[
          { label: 'Status', value: stats?.world_bank_status?.status ?? '—' },
          { label: 'Last Sync', value: formatDateTime(stats?.world_bank_status?.last_sync ?? null) },
          { label: 'Countries', value: String(stats?.world_bank_status?.countries_synced ?? 0) },
          {
            label: 'Success Rate',
            value: stats?.world_bank_status?.success_rate != null
              ? `${stats.world_bank_status.success_rate}%`
              : '—',
          },
        ]}
      />

      <IntegrationStatusCard
        title="Trading Economics API Status"
        icon={BarChart3}
        href="/admin/trading-economics-api"
        status={stats?.trading_economics_status}
        metrics={[
          { label: 'Status', value: stats?.trading_economics_status?.status ?? '—' },
          { label: 'Last Sync', value: formatDateTime(stats?.trading_economics_status?.last_sync ?? null) },
          { label: 'Countries', value: String(stats?.trading_economics_status?.countries_synced ?? 0) },
          {
            label: 'Success Rate',
            value: stats?.trading_economics_status?.success_rate != null
              ? `${stats.trading_economics_status.success_rate}%`
              : '—',
          },
        ]}
      />
    </div>
  );
}