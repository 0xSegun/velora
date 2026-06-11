"use client";

import React from "react";
import Link from "next/link";
import { useBranding } from "@/hooks/useSiteSettings";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Users,
  Brain,
  PenTool,
  BarChart3,
  Settings,
  Image,
  Zap,
  LogOut,
  ChevronLeft,
  FlaskConical,
  GitBranch,
  SlidersHorizontal,
  Plug,
  Shield,
  Database,
  Calendar,
  Target,
  DollarSign,
  Mail,
} from "lucide-react";

interface AdminSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const platformItems = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/admin" },
  { label: "Control Center", icon: SlidersHorizontal, href: "/admin/control" },
  { label: "API Configuration", icon: Plug, href: "/admin/api-config" },
  { label: "Exchange Rate API", icon: DollarSign, href: "/admin/exchange-rate-api" },
  { label: "Resend Email API", icon: Mail, href: "/admin/resend-email" },
  { label: "Economic Data", icon: Database, href: "/admin/economic-data" },
  { label: "Authentication", icon: Shield, href: "/admin/authentication" },
  { label: "Users", icon: Users, href: "/admin/users" },
  { label: "CMS", icon: PenTool, href: "/admin/cms" },
  { label: "Brand Assets", icon: Image, href: "/admin/branding" },
  { label: "Analytics", icon: BarChart3, href: "/admin/analytics" },
  { label: "Settings", icon: Settings, href: "/admin/settings" },
];

const aiItems = [
  { label: "Training Center", icon: Brain, href: "/admin/training" },
  { label: "Model Versions", icon: GitBranch, href: "/admin/models" },
  { label: "Economic Events", icon: Calendar, href: "/admin/economic-events" },
  { label: "Intelligence Config", icon: Target, href: "/admin/intelligence" },
  { label: "Research Mode", icon: FlaskConical, href: "/admin/research" },
];

export default function AdminSidebar({
  collapsed,
  onToggle,
}: AdminSidebarProps) {
  const pathname = usePathname();
  const branding = useBranding();

  const isActive = (href: string) => {
    if (href === "/admin") return pathname === "/admin";
    return pathname.startsWith(href);
  };

  const renderNavItem = (item: {
    label: string;
    icon: React.ElementType;
    href: string;
  }) => {
    const active = isActive(item.href);
    const Icon = item.icon;

    return (
      <Link key={item.href} href={item.href}>
        <motion.div
          whileHover={{ x: 2 }}
          whileTap={{ scale: 0.98 }}
          className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
            active
              ? "bg-[var(--accent-faint)] text-[var(--text-primary)]"
              : "text-[var(--text-muted)] hover:bg-[var(--glass-bg)] hover:text-[var(--text-primary)]"
          }`}
        >
          {active && (
            <motion.div
              layoutId="admin-sidebar-active"
              className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-[var(--text-primary)]"
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
            />
          )}

          <Icon
            size={20}
            className={`shrink-0 transition ${
              active
                ? "text-[var(--text-primary)]"
                : "text-[var(--text-faint)] group-hover:text-[var(--text-primary)]"
            }`}
          />

          {!collapsed && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {item.label}
            </motion.span>
          )}

          {collapsed && (
            <div className="glass-panel absolute left-full z-50 ml-2 hidden rounded-lg px-2.5 py-1 text-xs font-medium text-[var(--text-primary)] shadow-xl group-hover:block">
              {item.label}
            </div>
          )}
        </motion.div>
      </Link>
    );
  };

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 72 : 260 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className="glass-nav relative flex h-screen flex-col border-r border-[var(--border-primary)] print:hidden"
    >
      {/* Logo Section */}
      <div className="flex h-16 items-center justify-between border-b border-[var(--border-primary)] px-4">
        <Link
          href="/admin"
          className="flex items-center gap-2.5 overflow-hidden"
        >
          {branding.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={branding.logoUrl} alt="" className="h-9 w-9 shrink-0 rounded-xl object-contain" />
          ) : (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--text-primary)] shadow-[var(--glow)]">
              <Zap size={18} className="text-[var(--bg-primary)]" />
            </div>
          )}
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="flex items-center gap-2"
            >
              <span className="text-lg font-bold text-[var(--text-primary)]">
                {branding.siteName}
              </span>
              <span className="rounded-md bg-[var(--accent-faint)] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                Admin
              </span>
            </motion.div>
          )}
        </Link>

        <button
          id="admin-sidebar-collapse-btn"
          onClick={onToggle}
          className="hidden rounded-lg p-1.5 text-[var(--text-faint)] transition hover:bg-[var(--accent-faint)] hover:text-[var(--text-primary)] lg:block"
        >
          <motion.div
            animate={{ rotate: collapsed ? 180 : 0 }}
            transition={{ duration: 0.3 }}
          >
            <ChevronLeft size={16} />
          </motion.div>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {/* Platform Section */}
        <div className="space-y-1">
          {!collapsed && (
            <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-faint)]">
              Platform
            </p>
          )}
          {platformItems.map(renderNavItem)}
        </div>

        {/* AI Engine Section */}
        <div className="mt-6 space-y-1">
          {!collapsed && (
            <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-faint)]">
              AI Engine
            </p>
          )}
          {collapsed && (
            <div className="my-3 h-px bg-[var(--border-primary)]" />
          )}
          {aiItems.map(renderNavItem)}
        </div>
      </nav>

      {/* Bottom section */}
      <div className="border-t border-[var(--border-primary)] p-3">
        <Link href="/">
          <motion.div
            whileHover={{ x: 2 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-[var(--text-muted)] transition hover:bg-[var(--glass-bg)] hover:text-[var(--text-primary)]"
          >
            <LogOut size={20} className="shrink-0 text-[var(--text-faint)]" />
            {!collapsed && <span>Back to App</span>}
          </motion.div>
        </Link>

        {!collapsed && (
          <div className="glass-card mt-3 rounded-xl p-3 hover:transform-none">
            <p className="text-xs font-medium text-[var(--text-primary)]">
              Admin Mode Active
            </p>
            <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">
              Changes affect all users
            </p>
          </div>
        )}
      </div>
    </motion.aside>
  );
}
