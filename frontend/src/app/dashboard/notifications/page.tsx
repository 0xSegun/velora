'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell, Check, CheckCheck, Trash2, Search } from 'lucide-react';
import { useDashboardStore, type Notification } from '@/store/dashboardStore';
import { notificationsAPI } from '@/lib/api';
import { MESSAGES } from '@/lib/feedback';
import { NotificationTypeIcon } from '@/lib/notificationIcons';
import EmptyState from '@/components/ui/EmptyState';

const typeLabels: Record<string, string> = {
  success: 'Success',
  error: 'Error',
  prediction: 'Prediction',
  training: 'Training',
  dataset: 'Dataset',
  model: 'Model',
  system: 'System',
  security: 'Security',
  alert: 'Alert',
  warning: 'Warning',
  info: 'Info',
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function NotificationsPage() {
  const {
    notifications,
    setNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useDashboardStore();
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [mounted, setMounted] = useState(false);

  const syncNotifications = useCallback(async () => {
    try {
      const remote = await notificationsAPI.list();
      setNotifications(remote);
    } catch {
      // Retain local notifications when API is unavailable.
    }
  }, [setNotifications]);

  useEffect(() => {
    setMounted(true);
    void syncNotifications();
  }, [syncNotifications]);

  const categories = ['all', ...Array.from(new Set(notifications.map((n) => n.type)))];

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return notifications.filter((n) => {
      const matchFilter = filter === 'all' || n.type === filter;
      const matchSearch =
        !query ||
        n.title.toLowerCase().includes(query) ||
        n.message.toLowerCase().includes(query);
      return matchFilter && matchSearch;
    });
  }, [notifications, filter, search]);

  const unread = notifications.filter((n) => !n.isRead).length;

  const handleMarkAsRead = async (id: string) => {
    markAsRead(id);
    try {
      await notificationsAPI.markAsRead(id);
    } catch {
      // Optimistic update retained.
    }
  };

  const handleMarkAllAsRead = async () => {
    markAllAsRead();
    try {
      await notificationsAPI.markAllAsRead();
    } catch {
      // Optimistic update retained.
    }
  };

  const handleDelete = async (id: string) => {
    deleteNotification(id);
    try {
      await notificationsAPI.delete(id);
    } catch {
      // Optimistic update retained.
    }
  };

  if (notifications.length === 0) {
    return (
      <div className="space-y-6">
        <div className="glass-panel rounded-2xl p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--text-faint)]">Notification history</p>
          <h1 className="mt-2 text-3xl font-bold text-[var(--text-primary)]">Notifications</h1>
        </div>
        <EmptyState
          variant="warning"
          title={MESSAGES.notifications.empty}
          description="Prediction alerts, training updates, and system messages will appear here."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 glass-panel rounded-2xl p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--text-faint)]">Notification history</p>
          <h1 className="mt-2 text-3xl font-bold text-[var(--text-primary)]">Notifications</h1>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Review prediction alerts, training updates, account messages, and system announcements.
          </p>
        </div>
        <button
          onClick={handleMarkAllAsRead}
          disabled={unread === 0}
          className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-primary)] bg-[var(--text-primary)] px-4 py-2 text-sm font-medium text-[var(--bg-primary)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <CheckCheck size={16} /> Mark all read
        </button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notifications..."
            className="w-full glass-card rounded-xl hover:transform-none py-2 pl-9 pr-4 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-faint)]"
            aria-label="Search notifications"
          />
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
              filter === cat
                ? 'bg-[var(--text-primary)] text-[var(--bg-primary)]'
                : 'bg-[var(--accent-faint)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
            }`}
          >
            {cat === 'all' ? 'All' : typeLabels[cat] || cat}
          </button>
        ))}
      </div>

      <div className="grid gap-4">
        {filtered.map((notification: Notification) => (
          <article
            key={notification.id}
            className={`glass-panel rounded-2xl p-5 transition-colors hover:bg-[var(--accent-faint)] ${
              !notification.isRead ? 'border-l-2 border-l-[var(--text-primary)]' : ''
            }`}
          >
            <div className="flex items-start gap-4">
              <NotificationTypeIcon type={notification.type} className="mt-1 h-5 w-5 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm font-semibold text-[var(--text-primary)]">{notification.title}</h2>
                  <span className="rounded-full bg-[var(--accent-faint)] px-2 py-0.5 text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                    {typeLabels[notification.type] || notification.type}
                  </span>
                  {!notification.isRead && (
                    <span className="rounded-full bg-[var(--text-primary)] px-2 py-0.5 text-[10px] font-medium text-[var(--bg-primary)]">
                      New
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-[var(--text-muted)]">{notification.message}</p>
                <p className="mt-2 text-[10px] text-[var(--text-faint)]">
                  {mounted ? timeAgo(notification.createdAt) : 'Recent'}
                </p>
              </div>
              <div className="flex flex-shrink-0 items-center gap-1">
                {!notification.isRead && (
                  <button
                    onClick={() => handleMarkAsRead(notification.id)}
                    className="rounded-lg p-2 text-[var(--text-muted)] transition hover:bg-[var(--glass-bg-hover)] hover:text-[var(--text-primary)]"
                    title="Mark as read"
                  >
                    <Check size={14} />
                  </button>
                )}
                <button
                  onClick={() => handleDelete(notification.id)}
                  className="rounded-lg p-2 text-[var(--text-muted)] transition hover:bg-[var(--accent-faint)] hover:text-[var(--text-primary)]"
                  title="Delete"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </article>
        ))}

        {filtered.length === 0 && (
          <EmptyState
            variant="warning"
            title={MESSAGES.notifications.empty}
            description="No notifications match your current filter or search."
          />
        )}
      </div>

      <p className="text-xs text-[var(--text-faint)]">
        {unread} unread · {notifications.length} total
      </p>
    </div>
  );
}