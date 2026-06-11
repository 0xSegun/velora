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
import { getFirstName } from "@/lib/greeting";
import { useAuthStore } from "@/store/authStore";
import { useThemeStore } from "@/store/themeStore";

/* ---------- Page title map ---------- */
const pageTitles: Record<string, string> = {
  "/dashboard": "Overview",
  "/dashboard/predictions": "Predictions",
  "/dashboard/analytics": "Analytics",
  "/dashboard/countries": "Countries",
  "/dashboard/research": "Research",
  "/dashboard/reports": "Reports",
  "/dashboard/settings": "Settings",
  "/dashboard/notifications": "Notifications",
  "/dashboard/profile": "Profile",
};

/* ---------- User menu items ---------- */
const userMenuItems = [
  { label: "Profile", href: "/dashboard/profile", icon: User },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
  { label: "Notifications", href: "/dashboard/notifications", icon: Bell },
  { label: "Security", href: "/dashboard/settings", icon: Shield },
];

/* ---------- Component ---------- */
interface TopBarProps {
  onOpenMobileSidebar?: () => void;
}

export default function TopBar({ onOpenMobileSidebar }: TopBarProps) {
  const pathname = usePathname();
  const title = pageTitles[pathname] ?? "Dashboard";
  const { theme, toggleTheme, hasHydrated } = useThemeStore();
  const user = useAuthStore((s) => s.user);
  const firstName = getFirstName(user?.full_name);
  const initials = (user?.full_name ?? "U")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
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
    <header
      className="
        glass-nav sticky top-0 z-10
        border-b border-[var(--border-primary)] px-4 sm:px-6
        print:hidden
      "
    >
      <div className="flex h-16 items-center justify-between">
      {/* -- Left: page title -- */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenMobileSidebar}
          className="rounded-lg p-2 text-[var(--text-muted)] transition hover:bg-[var(--accent-faint)] hover:text-[var(--text-primary)] lg:hidden"
          aria-label="Open navigation menu"
        >
          <Menu size={20} />
        </button>
        <h1
          id="topbar-title"
          className="text-lg font-semibold text-[var(--text-primary)]"
        >
          {title}
        </h1>
      </div>

      <GlobalSearch
        scope="dashboard"
        id="topbar-search"
        className="hidden w-80 md:block"
      />

      <div className="flex items-center gap-2">
        {/* Notification bell */}
        <NotificationCenter />

        {/* Theme toggle */}
        <button
          id="theme-toggle"
          onClick={toggleTheme}
          className="p-2 rounded-lg hover:bg-[var(--accent-faint)] transition-colors"
          aria-label="Toggle theme"
        >
          {!hasHydrated || theme === "dark" ? (
            <Sun className="w-5 h-5 text-[var(--text-muted)]" />
          ) : (
            <Moon className="w-5 h-5 text-[var(--text-muted)]" />
          )}
        </button>

        {/* User avatar with dropdown */}
        <div ref={userMenuRef} className="relative">
          <button
            id="topbar-user-avatar"
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="
              flex items-center gap-2 rounded-xl px-2 py-1.5
              hover:bg-[var(--accent-faint)] transition-all cursor-pointer
            "
          >
            <div
              className="
              w-8 h-8 rounded-full
              bg-gradient-to-br from-neutral-600 to-neutral-800
              dark:from-neutral-300 dark:to-neutral-500
              flex items-center justify-center
              text-[11px] font-bold text-[var(--text-primary)] dark:text-black
              ring-2 ring-transparent hover:ring-[var(--border-hover)]
              transition-all
            "
            >
              {initials}
            </div>
            <ChevronDown
              size={14}
              className={`text-[var(--text-muted)] transition-transform ${userMenuOpen ? "rotate-180" : ""}`}
            />
          </button>

          <AnimatePresence>
            {userMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.96 }}
                transition={{ duration: 0.15 }}
                className="glass-panel absolute right-0 top-12 z-50 w-52 overflow-hidden rounded-xl shadow-2xl"
              >
                {/* User info */}
                <div className="px-4 py-3 border-b border-[var(--border-primary)]">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                    {user?.full_name ?? "Account"}
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {user?.email ?? ""}
                  </p>
                </div>

                {/* Menu items */}
                <div className="py-1">
                  {userMenuItems.map((item) => (
                    <Link
                      key={item.label}
                      href={item.href}
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--accent-faint)] hover:text-[var(--text-primary)] transition-colors"
                    >
                      <item.icon size={15} />
                      {item.label}
                    </Link>
                  ))}
                </div>

                {/* Logout */}
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
          scope="dashboard"
          id="topbar-search-mobile"
          className="w-full"
          compact
        />
      </div>
    </header>
  );
}
