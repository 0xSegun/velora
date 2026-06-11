"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Brain,
  BarChart3,
  Globe,
  FileText,
  Bell,
  Settings,
  User,
  ChevronLeft,
  ChevronRight,
  FlaskConical,
  Sparkles,
  Target,
  Microscope,
} from "lucide-react";
import { useBranding } from "@/hooks/useSiteSettings";
import { getFirstName } from "@/lib/greeting";
import { useAuthStore } from "@/store/authStore";
import { useDashboardStore } from "@/store/dashboardStore";

/* ---------- Navigation config ---------- */
interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { label: "Predictions", href: "/dashboard/predictions", icon: Brain },
  { label: "Intelligence", href: "/dashboard/intelligence", icon: Sparkles },
  { label: "Explainability", href: "/dashboard/explainability", icon: Microscope },
  { label: "Scenarios", href: "/dashboard/scenarios", icon: Target },
  { label: "Accuracy", href: "/dashboard/accuracy", icon: BarChart3 },
  { label: "Countries", href: "/dashboard/countries", icon: Globe },
  { label: "Research", href: "/dashboard/research", icon: FlaskConical },
  { label: "Reports", href: "/dashboard/reports", icon: FileText },
  { label: "Notifications", href: "/dashboard/notifications", icon: Bell },
];

const bottomItems: NavItem[] = [
  { label: "Profile", href: "/dashboard/profile", icon: User },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
];

/* ---------- Component ---------- */
export default function Sidebar() {
  const pathname = usePathname();
  const { sidebarCollapsed, toggleSidebar } = useDashboardStore();
  const branding = useBranding();
  const user = useAuthStore((s) => s.user);
  const firstName = getFirstName(user?.full_name);
  const initials = (user?.full_name ?? "U")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === href : pathname.startsWith(href);

  return (
    <aside
      className={`
        glass-nav sticky top-0 z-30 flex h-screen shrink-0 flex-col overflow-y-auto
        border-r border-[var(--border-primary)]
        transition-all duration-300 ease-in-out print:hidden
        ${sidebarCollapsed ? "w-[72px]" : "w-64"}
      `}
    >
      {/* -- Collapse toggle -- */}
      <button
        id="sidebar-collapse-toggle"
        onClick={toggleSidebar}
        className="
          absolute -right-3 top-20 z-20
          w-6 h-6 rounded-full
          glass-panel border border-[var(--border-primary)]
          flex items-center justify-center
          cursor-pointer hover:border-[var(--border-hover)]
          transition-colors duration-200
        "
        aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {sidebarCollapsed ? (
          <ChevronRight className="w-3 h-3 text-[var(--text-muted)]" />
        ) : (
          <ChevronLeft className="w-3 h-3 text-[var(--text-muted)]" />
        )}
      </button>

      {/* -- Logo -- */}
      <div className="flex items-center gap-3 p-5 mb-2">
        {branding.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={branding.logoUrl} alt="" className="h-8 w-8 shrink-0 object-contain" />
        ) : (
          <span className="text-2xl shrink-0">📊</span>
        )}
        <AnimatePresence>
          {!sidebarCollapsed && (
            <motion.span
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="text-lg font-bold gradient-text whitespace-nowrap"
            >
              {branding.siteName}
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* -- Main navigation -- */}
      <nav className="flex-1 px-3 space-y-1">
        {navItems.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              id={`nav-${item.label.toLowerCase()}`}
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm
                transition-all duration-200
                ${sidebarCollapsed ? "justify-center" : ""}
                ${
                  active
                    ? "text-[var(--text-primary)] bg-[var(--accent-faint)] border-l-2 border-[var(--text-primary)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-faint)] border-l-2 border-transparent"
                }
              `}
            >
              <Icon className="w-[18px] h-[18px] flex-shrink-0" />
              <AnimatePresence>
                {!sidebarCollapsed && (
                  <motion.span
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: "auto" }}
                    exit={{ opacity: 0, width: 0 }}
                    transition={{ duration: 0.2 }}
                    className="whitespace-nowrap overflow-hidden"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>
          );
        })}

        {/* Separator */}
        <div className="h-px bg-[var(--border-primary)] my-2" />

        {bottomItems.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              id={`nav-${item.label.toLowerCase()}`}
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm
                transition-all duration-200
                ${sidebarCollapsed ? "justify-center" : ""}
                ${
                  active
                    ? "text-[var(--text-primary)] bg-[var(--accent-faint)] border-l-2 border-[var(--text-primary)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-faint)] border-l-2 border-transparent"
                }
              `}
            >
              <Icon className="w-[18px] h-[18px] flex-shrink-0" />
              <AnimatePresence>
                {!sidebarCollapsed && (
                  <motion.span
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: "auto" }}
                    exit={{ opacity: 0, width: 0 }}
                    transition={{ duration: 0.2 }}
                    className="whitespace-nowrap overflow-hidden"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>
          );
        })}
      </nav>

      {/* -- User section -- */}
      <div
        className={`p-4 border-t border-[var(--border-primary)] ${sidebarCollapsed ? "flex justify-center" : ""}`}
      >
        <div className={`flex items-center gap-3`}>
          {/* Avatar */}
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-neutral-500 to-neutral-700 flex items-center justify-center text-xs font-bold text-[var(--text-primary)] flex-shrink-0">
            {initials}
          </div>
          <AnimatePresence>
            {!sidebarCollapsed && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                  {user?.full_name ?? "User"}
                </p>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--accent-faint)] text-[var(--text-secondary)] font-medium">
                  Pro
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </aside>
  );
}
