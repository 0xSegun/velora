"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Brain,
  BarChart3,
  Globe,
  Calendar,
  FlaskConical,
  FileText,
  Target,
  Activity,
  Microscope,
  Cpu,
  Database,
  Plug,
  Bell,
  User,
  Settings,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { useBranding } from "@/hooks/useSiteSettings";
import { useAuthStore } from "@/store/authStore";
import { useDashboardStore } from "@/store/dashboardStore";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Overview", href: "/analyst", icon: LayoutDashboard },
  { label: "Intelligence Hub", href: "/analyst/intelligence-hub", icon: Sparkles },
  { label: "Predictions", href: "/analyst/predictions", icon: Brain },
  { label: "Analytics", href: "/analyst/analytics", icon: BarChart3 },
  { label: "Countries", href: "/analyst/countries", icon: Globe },
  { label: "Economic Events", href: "/analyst/events", icon: Calendar },
  { label: "Research Center", href: "/analyst/research", icon: FlaskConical },
  { label: "Reports", href: "/analyst/reports", icon: FileText },
  { label: "Scenario Simulator", href: "/analyst/scenarios", icon: Target },
  { label: "Accuracy", href: "/analyst/accuracy", icon: Activity },
  { label: "Explainable AI", href: "/analyst/explainability", icon: Microscope },
  { label: "Model Performance", href: "/analyst/models", icon: Cpu },
  { label: "Data Sources", href: "/analyst/data-sources", icon: Database },
  { label: "API Status", href: "/analyst/api-status", icon: Plug },
  { label: "Notifications", href: "/analyst/notifications", icon: Bell },
];

const bottomItems = [
  { label: "Profile", href: "/dashboard/profile", icon: User },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
];

export default function AnalystSidebar() {
  const pathname = usePathname();
  const { sidebarCollapsed, toggleSidebar, notifications } = useDashboardStore();
  const branding = useBranding();
  const user = useAuthStore((s) => s.user);
  const unread = notifications.filter((n) => !n.isRead).length;

  const isActive = (href: string) =>
    href === "/analyst" ? pathname === href : pathname.startsWith(href);

  return (
    <aside
      className={cn(
        "glass-nav sticky top-0 z-30 flex h-screen shrink-0 flex-col overflow-y-auto",
        "border-r border-[var(--border-primary)] transition-all duration-300 print:hidden",
        sidebarCollapsed ? "w-[72px]" : "w-[64px] min-w-[16rem] w-64",
      )}
    >
      <button
        onClick={toggleSidebar}
        className="absolute -right-3 top-20 z-20 flex h-6 w-6 items-center justify-center rounded-full border border-[var(--border-primary)] glass"
        aria-label="Toggle sidebar"
      >
        {sidebarCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
      </button>

      <div className="flex items-center gap-3 p-5">
        {!sidebarCollapsed && (
          <div>
            <p className="text-lg font-bold text-[var(--text-primary)]">{branding.siteName}</p>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--accent)]">
              Analyst Workspace
            </p>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition",
                sidebarCollapsed && "justify-center",
                active
                  ? "nav-item-active border border-[var(--accent)]/20 text-[var(--text-primary)]"
                  : "text-[var(--text-muted)] hover:bg-[var(--accent-subtle)]",
              )}
            >
              <Icon className={cn("h-4 w-4 shrink-0", active && "text-[var(--accent)]")} />
              {!sidebarCollapsed && (
                <span className="truncate">
                  {item.label}
                  {item.label === "Notifications" && unread > 0 ? ` (${unread})` : ""}
                </span>
              )}
            </Link>
          );
        })}
        <div className="mx-2 my-3 h-px bg-[var(--border-primary)]" />
        {bottomItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            <item.icon className="h-4 w-4" />
            {!sidebarCollapsed && item.label}
          </Link>
        ))}
      </nav>

      {!sidebarCollapsed && user && (
        <div className="border-t border-[var(--border-primary)] p-4 text-xs text-[var(--text-muted)]">
          <p className="font-medium text-[var(--text-primary)]">{user.full_name}</p>
          <p>Analyst · {user.institution || "Independent"}</p>
        </div>
      )}
    </aside>
  );
}