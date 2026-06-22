"use client";

import { usePathname } from "next/navigation";
import {
  Menu,
  Sun,
  Moon,
  User,
  Settings,
  Shield,
  LogOut,
  ChevronDown,
  Bell,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import GlobalSearch from "@/components/search/GlobalSearch";
import NotificationCenter from "./NotificationCenter";
import { performLogout } from "@/lib/logout";
import { useAuthStore } from "@/store/authStore";
import { useThemeStore } from "@/store/themeStore";
import { isAnalystRole } from "@/lib/roles";

const pageTitles: Record<string, string> = {
  "/dashboard": "Overview",
  "/dashboard/predictions": "Predictions",
  "/dashboard/analytics": "Analytics",
  "/dashboard/countries": "My Countries",
  "/dashboard/news": "Economic News",
  "/dashboard/help": "Help Center",
  "/dashboard/research": "Research",
  "/dashboard/reports": "Reports",
  "/dashboard/settings": "Settings",
  "/dashboard/notifications": "Notifications",
  "/dashboard/profile": "Profile",
  "/analyst": "Overview",
  "/analyst/predictions": "Predictions",
  "/analyst/analytics": "Analytics",
  "/analyst/countries": "Countries",
  "/analyst/events": "Economic Events",
  "/analyst/research": "Research Center",
  "/analyst/reports": "Reports",
  "/analyst/scenarios": "Scenario Simulator",
  "/analyst/accuracy": "Accuracy",
  "/analyst/explainability": "Explainable AI",
  "/analyst/models": "Model Performance",
  "/analyst/data-sources": "Data Sources",
  "/analyst/api-status": "API Status",
  "/analyst/notifications": "Notifications",
};

const userMenuItems = [
  { label: "Profile", href: "/dashboard/profile", icon: User },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
  { label: "Notifications", href: "/dashboard/notifications", icon: Bell },
  { label: "Security", href: "/dashboard/settings", icon: Shield },
];

interface TopBarProps {
  onOpenMobileSidebar?: () => void;
}

export default function TopBar({ onOpenMobileSidebar }: TopBarProps) {
  const pathname = usePathname();
  const title = pageTitles[pathname] ?? (pathname.startsWith("/analyst") ? "Analyst" : "Dashboard");
  const { theme, toggleTheme, hasHydrated } = useThemeStore();
  const user = useAuthStore((s) => s.user);
  const searchScope =
    pathname.startsWith("/admin")
      ? "admin"
      : pathname.startsWith("/analyst") || isAnalystRole(user?.role)
        ? "analyst"
        : "dashboard";
  const initials = (user?.full_name ?? "U")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(e.target as Node)
      )
        setUserMenuOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <header className="glass-nav sticky top-0 z-10 border-b border-[var(--border-primary)] px-4 sm:px-6 print:hidden">
      <div className="flex h-16 items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onOpenMobileSidebar}
            className="btn-ghost rounded-xl p-2 lg:hidden"
            aria-label="Open navigation menu"
          >
            <Menu size={20} />
          </button>
          <div className="min-w-0">
            <h1
              id="topbar-title"
              className="text-xl font-bold text-[var(--text-primary)] truncate tracking-tight"
              style={{ fontFamily: "var(--font-display), sans-serif" }}
            >
              {title}
            </h1>
          </div>
        </div>

        <GlobalSearch
          scope={searchScope}
          role={user?.role}
          id="topbar-search"
          className="hidden w-80 md:block"
        />

        <div className="flex items-center gap-1.5">
          <NotificationCenter />

          <button
            id="theme-toggle"
            onClick={toggleTheme}
            className="btn-ghost rounded-xl p-2.5"
            aria-label="Toggle theme"
          >
            {!hasHydrated || theme === "dark" ? (
              <Sun className="w-[18px] h-[18px]" />
            ) : (
              <Moon className="w-[18px] h-[18px]" />
            )}
          </button>

          <div ref={userMenuRef} className="relative">
            <button
              id="topbar-user-avatar"
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-[var(--accent-faint)] transition-all cursor-pointer"
            >
              <div className="w-8 h-8 rounded-full bg-[var(--accent)] flex items-center justify-center text-[11px] font-bold text-white transition-all">
                {initials}
              </div>
              <ChevronDown
                size={14}
                className={`text-[var(--text-muted)] transition-transform hidden sm:block ${userMenuOpen ? "rotate-180" : ""}`}
              />
            </button>

            <AnimatePresence>
              {userMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.96 }}
                  transition={{ duration: 0.15 }}
                  className="glass-panel absolute right-0 top-12 z-50 w-56 overflow-hidden rounded-2xl shadow-2xl"
                >
                  <div className="px-4 py-3 border-b border-[var(--border-primary)]">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">
                      {user?.full_name ?? "Account"}
                    </p>
                    <p className="text-xs text-[var(--text-muted)] truncate">
                      {user?.email ?? ""}
                    </p>
                  </div>

                  <div className="py-1">
                    {userMenuItems.map((item) => (
                      <Link
                        key={item.label}
                        href={item.href}
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--accent-faint)] hover:text-[var(--text-primary)] transition-colors"
                      >
                        <item.icon size={15} className="text-[var(--text-muted)]" />
                        {item.label}
                      </Link>
                    ))}
                  </div>

                  <div className="border-t border-[var(--border-primary)] py-1">
                    <button
                      type="button"
                      onClick={() => {
                        setUserMenuOpen(false);
                        void performLogout("/");
                      }}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--accent-faint)] hover:text-[var(--text-primary)] transition-colors"
                    >
                      <LogOut size={15} />
                      Sign out
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <div className="border-t border-[var(--border-primary)] px-0 pb-3 pt-2 md:hidden">
        <GlobalSearch
          scope={searchScope}
          role={user?.role}
          id="topbar-search-mobile"
          className="w-full"
          compact
        />
      </div>
    </header>
  );
}