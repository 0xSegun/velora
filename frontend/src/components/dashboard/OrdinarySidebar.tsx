"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Brain,
  Globe,
  Newspaper,
  FileText,
  Bell,
  HelpCircle,
  User,
  Settings,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useBranding } from "@/hooks/useSiteSettings";
import { useAuthStore } from "@/store/authStore";
import { useDashboardStore } from "@/store/dashboardStore";
import { cn } from "@/lib/utils";

const ICONS = {
  LayoutDashboard,
  Brain,
  Globe,
  Newspaper,
  FileText,
  Bell,
  HelpCircle,
} as const;

const navItems = [
  { label: "Overview", href: "/dashboard", icon: "LayoutDashboard" as const },
  { label: "Predictions", href: "/dashboard/predictions", icon: "Brain" as const },
  { label: "My Countries", href: "/dashboard/countries", icon: "Globe" as const },
  { label: "Intelligence Hub", href: "/dashboard/intelligence-hub", icon: "Brain" as const },
  { label: "Economic News", href: "/dashboard/news", icon: "Newspaper" as const },
  { label: "Reports", href: "/dashboard/reports", icon: "FileText" as const },
  { label: "Notifications", href: "/dashboard/notifications", icon: "Bell" as const },
  { label: "Help Center", href: "/dashboard/help", icon: "HelpCircle" as const },
];

const bottomItems = [
  { label: "Profile", href: "/dashboard/profile", icon: User },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
];

export default function OrdinarySidebar() {
  const pathname = usePathname();
  const { sidebarCollapsed, toggleSidebar, notifications } = useDashboardStore();
  const branding = useBranding();
  const user = useAuthStore((s) => s.user);
  const unread = notifications.filter((n) => !n.isRead).length;
  const initials = (user?.full_name ?? "U")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === href : pathname.startsWith(href);

  return (
    <aside
      className={cn(
        "glass-nav sticky top-0 z-30 flex h-screen shrink-0 flex-col overflow-y-auto",
        "border-r border-[var(--border-primary)] transition-all duration-300 print:hidden",
        sidebarCollapsed ? "w-[72px]" : "w-64",
      )}
    >
      <button
        onClick={toggleSidebar}
        className="absolute -right-3 top-20 z-20 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border border-[var(--border-primary)] glass hover:border-[var(--accent)]"
        aria-label="Toggle sidebar"
      >
        {sidebarCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
      </button>

      <div className="mb-1 flex items-center gap-3 p-5">
        {branding.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={branding.logoUrl} alt="" className="h-8 w-8 object-contain" />
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--accent-faint)] text-sm">
            📊
          </span>
        )}
        {!sidebarCollapsed && (
          <span className="whitespace-nowrap text-lg font-bold text-[var(--text-primary)]">
            {branding.siteName}
          </span>
        )}
      </div>

      {!sidebarCollapsed && (
        <p className="px-5 pb-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-faint)]">
          Personal Assistant
        </p>
      )}

      <nav className="flex-1 space-y-0.5 px-3">
        {navItems.map((item) => {
          const Icon = ICONS[item.icon];
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                sidebarCollapsed && "justify-center",
                active
                  ? "nav-item-active border border-[var(--accent)]/20"
                  : "text-[var(--text-muted)] hover:bg-[var(--accent-subtle)] hover:text-[var(--text-primary)]",
              )}
            >
              <Icon className={cn("h-[18px] w-[18px]", active && "text-[var(--accent)]")} />
              {!sidebarCollapsed && (
                <span className="flex items-center gap-1.5">
                  {item.label}
                  {item.label === "Notifications" && unread > 0 && (
                    <span className="rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[9px] text-white">
                      {unread > 9 ? "9+" : unread}
                    </span>
                  )}
                </span>
              )}
            </Link>
          );
        })}
        <div className="mx-2 my-3 h-px bg-[var(--border-primary)]" />
        {bottomItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition",
                sidebarCollapsed && "justify-center",
                active ? "text-[var(--text-primary)]" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]",
              )}
            >
              <Icon className="h-[18px] w-[18px]" />
              {!sidebarCollapsed && item.label}
            </Link>
          );
        })}
      </nav>

      <div className={cn("border-t border-[var(--border-primary)] p-4", sidebarCollapsed && "flex justify-center")}>
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--accent)] text-xs font-bold text-white">
            {initials}
          </div>
          {!sidebarCollapsed && (
            <div>
              <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{user?.full_name}</p>
              <span className="text-[10px] text-[var(--text-faint)]">Ordinary User</span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}