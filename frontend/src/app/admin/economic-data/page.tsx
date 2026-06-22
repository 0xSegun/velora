'use client';

import { useCallback, useEffect, useState } from 'react';
import { Database, RefreshCw, Plug, Loader2, AlertCircle } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import { adminAPI } from '@/lib/api';
import { toast } from '@/lib/feedback';

interface SourceStat {
  source: string;
  records: number;
  last_data_date: string | null;
  last_sync_at: string | null;
}

interface ApiConnection {
  id: string;
  name: string;
  provider: string;
  is_active: boolean;
  health_status: string;
  refresh_frequency_hours: number;
  last_sync_at: string | null;
}

interface EconomicDataMgmt {
  sources: SourceStat[];
  api_connections: ApiConnection[];
  refresh_schedules: Record<string, string>;
  approved_providers: string[];
}

export default function AdminEconomicDataPage() {
  const [data, setData] = useState<EconomicDataMgmt | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: payload } = await adminAPI.getEconomicDataManagement();
      setData(payload as EconomicDataMgmt);
    } catch {
      const message =
        'Failed to load economic data management. Ensure the backend API and PostgreSQL database are running.';
      setError(message);
      setData(null);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const sync = async () => {
    setSyncing(true);
    try {
      await adminAPI.syncEconomicData();
      toast.success('Economic data sync completed.');
      await load();
    } catch {
      toast.error('Sync failed.');
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--text-muted)]" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHeader
          eyebrow="Data Management"
          title="Economic Data Management"
          description="Monitor sources, refresh schedules, and API connectivity."
          icon={Database}
        />
        <EmptyState
          variant="warning"
          icon={AlertCircle}
          title="Unable to load economic data"
          description={error ?? 'No data returned from the server.'}
          action={
            <button
              type="button"
              onClick={() => void load()}
              className="btn-primary px-5 py-2.5 text-sm"
            >
              Retry
            </button>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        eyebrow="Data Management"
        title="Economic Data Management"
        description="Monitor sources, refresh schedules, and API connectivity."
        icon={Database}
        actions={
          <button
            onClick={() => void sync()}
            disabled={syncing}
            className="btn-secondary px-4 py-2 text-sm"
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            Sync Now
          </button>
        }
      />

      <div className="glass-card rounded-xl hover:transform-none p-5">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
          <Database className="h-4 w-4" /> Active Data Sources
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border-primary)]">
                {['Source', 'Records', 'Last Data Date', 'Last Sync'].map((h) => (
                  <th key={h} className="pb-2 text-xs text-[var(--text-muted)]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data?.sources ?? []).map((s) => (
                <tr key={s.source} className="border-b border-[var(--border-primary)] last:border-0">
                  <td className="py-2 font-medium">{s.source}</td>
                  <td className="py-2">{s.records}</td>
                  <td className="py-2 text-[var(--text-muted)]">{s.last_data_date ?? '—'}</td>
                  <td className="py-2 text-[var(--text-muted)]">{s.last_sync_at ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="glass-card rounded-xl hover:transform-none p-5">
        <h2 className="mb-4 text-sm font-semibold text-[var(--text-primary)]">Refresh Schedules</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(data?.refresh_schedules ?? {}).map(([key, val]) => (
            <div key={key} className="rounded-lg bg-[var(--accent-faint)] px-3 py-2">
              <p className="text-xs capitalize text-[var(--text-muted)]">{key.replace(/_/g, ' ')}</p>
              <p className="text-sm font-medium text-[var(--text-primary)]">{val}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="glass-card rounded-xl hover:transform-none p-5">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
          <Plug className="h-4 w-4" /> API Connections
        </h2>
        {(data?.api_connections ?? []).length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">
            No economic API connections configured. Add sources in API Configuration.
          </p>
        ) : (
          <ul className="space-y-2">
            {data?.api_connections.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[var(--accent-faint)] px-3 py-2 text-sm"
              >
                <span className="font-medium text-[var(--text-primary)]">{c.name}</span>
                <span className="text-xs text-[var(--text-muted)]">
                  {c.provider} · {c.health_status} · every {c.refresh_frequency_hours}h
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-xs text-[var(--text-faint)]">
          Approved: {(data?.approved_providers ?? []).join(', ')}
        </p>
      </div>
    </div>
  );
}