'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Users, TrendingUp, Brain, Activity, BarChart3, DollarSign } from 'lucide-react';
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

interface DashboardStats {
  users?: { total?: number; active?: number; new_last_30_days?: number };
  predictions?: { total?: number; last_30_days?: number };
  models?: { active?: number };
  data?: { total_data_points?: number };
  exchange_rate_status?: ExchangeRateStatus;
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
    </div>
  );
}