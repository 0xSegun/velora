import { create } from "zustand";

export type NotificationType =
  | "success"
  | "error"
  | "info"
  | "warning"
  | "alert"
  | "prediction"
  | "training"
  | "dataset"
  | "model"
  | "system"
  | "security";

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  createdAt: string;
}

interface DashboardState {
  sidebarCollapsed: boolean;
  activeCountry: string;
  dateRange: { start: string; end: string };
  refreshInterval: number;
  notifications: Notification[];
  toggleSidebar: () => void;
  setActiveCountry: (code: string) => void;
  setDateRange: (range: { start: string; end: string }) => void;
  setNotifications: (notifications: Notification[]) => void;
  addNotification: (n: Notification) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  deleteNotification: (id: string) => void;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  sidebarCollapsed: false,
  activeCountry: "NG",
  dateRange: {
    start: "2024-01-01",
    end: "2024-12-31",
  },
  refreshInterval: 30000,
  notifications: [],
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setActiveCountry: (code) => set({ activeCountry: code }),
  setDateRange: (range) => set({ dateRange: range }),
  setNotifications: (notifications) => set({ notifications }),
  addNotification: (n) =>
    set((s) => ({
      notifications: [
        n,
        ...s.notifications.filter((existing) => existing.id !== n.id),
      ],
    })),
  markAsRead: (id) =>
    set((s) => ({
      notifications: s.notifications.map((n) =>
        n.id === id ? { ...n, isRead: true } : n,
      ),
    })),
  markAllAsRead: () =>
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, isRead: true })),
    })),
  deleteNotification: (id) =>
    set((s) => ({
      notifications: s.notifications.filter((n) => n.id !== id),
    })),
}));
