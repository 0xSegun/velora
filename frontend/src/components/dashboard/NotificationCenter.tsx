"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import {
  Bell,
  Trash2,
  Check,
  CheckCheck,
  ExternalLink,
  Search,
} from "lucide-react";
import { useDashboardStore, type Notification } from "@/store/dashboardStore";
import { getNotificationsWebSocketUrl, notificationsAPI } from "@/lib/api";
import { MESSAGES } from "@/lib/feedback";
import { NotificationTypeIcon } from "@/lib/notificationIcons";

function isNotification(value: unknown): value is Notification {
  return Boolean(
    value && typeof value === "object" && "id" in value && "title" in value,
  );
}

const typeLabels: Record<string, string> = {
  success: "Success",
  error: "Error",
  prediction: "Prediction",
  training: "Training",
  dataset: "Dataset",
  model: "Model",
  system: "System",
  security: "Security",
  alert: "Alert",
  warning: "Warning",
  info: "Info",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [mounted, setMounted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const {
    notifications,
    setNotifications,
    addNotification,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useDashboardStore();
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const syncNotifications = useCallback(async () => {
    try {
      const remoteNotifications = await notificationsAPI.list();
      setNotifications(remoteNotifications);
    } catch {
      // Keep local state when API is unavailable.
    }
  }, [setNotifications]);

  useEffect(() => {
    setMounted(true);
    void syncNotifications();

    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [syncNotifications]);

  function playNotificationSound() {
    try {
      const audio = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = 880;
      gain.gain.value = 0.08;
      const filter = audio.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 1200;
      oscillator.connect(filter);
      filter.connect(gain);
      gain.connect(audio.destination);
      oscillator.start();
      setTimeout(() => { oscillator.stop(); audio.close(); }, 220);
    } catch {}
  }

  useEffect(() => {
    const wsUrl = getNotificationsWebSocketUrl();
    if (!wsUrl) return;

    const socket = new WebSocket(wsUrl);
    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as unknown;
        const notification =
          payload && typeof payload === "object" && "notification" in payload
            ? (payload as { notification?: unknown }).notification
            : payload;
        if (isNotification(notification)) {
          addNotification(notification);
          if (!notification.isRead) playNotificationSound();
        }
      } catch {
        // Ignore malformed payloads.
      }
    };

    return () => socket.close();
  }, [addNotification]);

  const categories = useMemo(
    () => ["all", ...Array.from(new Set(notifications.map((n) => n.type)))],
    [notifications],
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return notifications.filter((n) => {
      const matchFilter = filter === "all" || n.type === filter;
      const matchSearch =
        !query ||
        n.title.toLowerCase().includes(query) ||
        n.message.toLowerCase().includes(query);
      return matchFilter && matchSearch;
    });
  }, [notifications, filter, search]);

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

  return (
    <div ref={ref} className="relative">
      <button
        id="notification-bell"
        onClick={() => setOpen((prev) => !prev)}
        className="relative p-2 rounded-lg hover:bg-[var(--accent-faint)] transition-colors"
        aria-label="Notifications"
        aria-expanded={open}
      >
        <Bell className="w-5 h-5 text-[var(--text-muted)]" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--accent)] text-[9px] font-bold text-white ring-2 ring-[var(--bg-primary)]">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.2 }}
            className="glass-panel absolute right-0 top-12 z-50 w-[calc(100vw-2rem)] max-w-sm overflow-hidden rounded-xl shadow-2xl sm:w-96"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-primary)]">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                Notifications
                {unreadCount > 0 && (
                  <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--accent-faint)] text-[var(--text-secondary)]">
                    {unreadCount} new
                  </span>
                )}
              </h3>
              <button
                id="mark-all-read"
                onClick={handleMarkAllAsRead}
                disabled={unreadCount === 0}
                className="flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors disabled:cursor-not-allowed disabled:opacity-40"
              >
                <CheckCheck size={13} />
                Mark all read
              </button>
            </div>

            <div className="px-3 py-2 border-b border-[var(--border-primary)]">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-faint)]" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search notifications..."
                  className="w-full rounded-lg border border-[var(--border-primary)] bg-[var(--accent-faint)] py-1.5 pl-8 pr-3 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:border-[var(--border-active)] focus:outline-none"
                  aria-label="Search notifications"
                />
              </div>
            </div>

            <div className="flex gap-1 px-3 py-2 border-b border-[var(--border-primary)] overflow-x-auto">
              {categories.map((cat: string) => (
                <button
                  key={cat}
                  onClick={() => setFilter(cat)}
                  className={`px-2.5 py-1 text-[10px] font-medium rounded-full whitespace-nowrap transition-all ${
                    filter === cat
                      ? "bg-[var(--accent)] text-white"
                      : "bg-[var(--accent-faint)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                  }`}
                >
                  {cat === "all" ? "All" : typeLabels[cat] || cat}
                </button>
              ))}
            </div>

            <div className="max-h-80 overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2 px-4 text-center">
                  <Bell className="w-8 h-8 text-[#CA8A04]" />
                  <p className="text-xs text-[var(--text-muted)]">
                    {MESSAGES.notifications.empty}
                  </p>
                </div>
              ) : (
                filtered.map((n) => (
                  <div
                    key={n.id}
                    className={`group flex items-start gap-3 px-4 py-3 hover:bg-[var(--accent-faint)] transition-colors ${
                      !n.isRead
                        ? "border-l-2 border-l-[var(--text-primary)]"
                        : "border-l-2 border-transparent"
                    }`}
                  >
                    <NotificationTypeIcon
                      type={n.type}
                      className="mt-1 h-4 w-4 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                          {n.title}
                        </p>
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[var(--accent-faint)] text-[var(--text-muted)] flex-shrink-0">
                          {typeLabels[n.type] || n.type}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--text-muted)] truncate">
                        {n.message}
                      </p>
                      <p className="text-[10px] text-[var(--text-faint)] mt-1">
                        {mounted ? timeAgo(n.createdAt) : "Recent"}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-1">
                      {!n.isRead && (
                        <button
                          onClick={() => handleMarkAsRead(n.id)}
                          className="p-1 rounded hover:bg-[var(--glass-bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                          title="Mark as read"
                        >
                          <Check size={13} />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(n.id)}
                        className="p-1 rounded hover:bg-[var(--accent-faint)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                        title="Delete"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="border-t border-[var(--border-primary)] px-4 py-2.5">
              <Link
                href="/dashboard/notifications"
                onClick={() => setOpen(false)}
                className="flex items-center justify-center gap-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              >
                View all notifications
                <ExternalLink size={12} />
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}