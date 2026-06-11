"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Menu,
  X,
  ChevronDown,
  User,
  Settings,
  Shield,
  Activity,
  Key,
  LogOut,
  Sun,
  Moon,
  SlidersHorizontal,
} from "lucide-react";
import Link from "next/link";
import AuthGuard from "@/components/auth/AuthGuard";
import AdminSidebar from "@/components/admin/AdminSidebar";
import GlobalSearch from "@/components/search/GlobalSearch";
import NotificationCenter from "@/components/dashboard/NotificationCenter";
import AppAmbient from "@/components/ui/AppAmbient";
import { performLogout } from "@/lib/logout";
import { useAuthStore } from "@/store/authStore";
import { useThemeStore } from "@/store/themeStore";

const adminMenuItems = [
  { label: "Control Center", href: "/admin/control", icon: SlidersHorizontal },
  { label: "Admin Profile", href: "/admin/control#profile", icon: User },
  { label: "Account Settings", href: "/admin/control#account", icon: Settings },
  { label: "Security Settings", href: "/admin/control#security", icon: Shield },
  { label: "Activity Logs", href: "/admin/control#activity", icon: Activity },
  { label: "System Preferences", href: "/admin/control#account", icon: SlidersHorizontal },
  { label: "API Management", href: "/admin/control#api", icon: Key },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);
  const adminMenuRef = useRef<HTMLDivElement>(null);
  const { theme, toggleTheme, hasHydrated } = useThemeStore();
  const user = useAuthStore((s) => s.user);

  // Close admin menu on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (
        adminMenuRef.current &&
        !adminMenuRef.current.contains(e.target as Node)
      )
        setAdminMenuOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <AuthGuard requireAdmin>
    <div className="app-shell relative flex min-h-screen">
      <AppAmbient />
      {/* Desktop Sidebar */}
      <div className="app-shell-content relative z-20 hidden lg:block print:hidden">
        <AdminSidebar
          collapsed={!sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
        />
      </div>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden print:hidden"
              onClick={() => setMobileMenuOpen(false)}
            />
            <motion.div
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 z-50 lg:hidden"
            >
              <AdminSidebar
                collapsed={false}
                onToggle={() => setMobileMenuOpen(false)}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <div className="app-shell-content relative z-10 flex flex-1 flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="glass-nav sticky top-0 z-30 border-b border-[var(--border-primary)] px-4 sm:px-6 print:hidden">
          <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Mobile menu button */}
            <button
              id="admin-mobile-menu-toggle"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="rounded-lg p-2 text-[var(--text-muted)] transition hover:bg-[var(--accent-faint)] hover:text-[var(--text-primary)] lg:hidden"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>

            {/* Desktop collapse button */}
            <button
              id="admin-sidebar-toggle"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="hidden rounded-lg p-2 text-[var(--text-muted)] transition hover:bg-[var(--accent-faint)] hover:text-[var(--text-primary)] lg:block"
            >
              <Menu size={20} />
            </button>

            <GlobalSearch
              scope="admin"
              id="admin-topbar-search"
              className="hidden w-64 sm:block"
            />
          </div>

          <div className="flex items-center gap-3">
            {/* Notifications */}
            <NotificationCenter />

            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="rounded-lg p-2 text-[var(--text-muted)] transition hover:bg-[var(--accent-faint)] hover:text-[var(--text-primary)]"
              aria-label="Toggle theme"
            >
              {!hasHydrated || theme === "dark" ? (
                <Sun size={18} />
              ) : (
                <Moon size={18} />
              )}
            </button>

            {/* Admin User Dropdown */}
            <div ref={adminMenuRef} className="relative">
              <button
                id="admin-profile-btn"
                onClick={() => setAdminMenuOpen(!adminMenuOpen)}
                className="glass-card flex items-center gap-2 rounded-xl px-3 py-1.5 transition hover:transform-none hover:border-[var(--border-hover)]"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-neutral-500 to-neutral-700 text-xs font-bold text-[var(--text-primary)]">
                  A
                </div>
                <div className="hidden sm:block">
                  <p className="text-sm font-medium text-[var(--text-primary)]">
                    Admin
                  </p>
                </div>
                <ChevronDown
                  size={14}
                  className={`text-[var(--text-muted)] transition-transform ${adminMenuOpen ? "rotate-180" : ""}`}
                />
              </button>

              <AnimatePresence>
                {adminMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.96 }}
                    transition={{ duration: 0.15 }}
                    className="glass-panel absolute right-0 top-12 z-50 w-56 overflow-hidden rounded-xl shadow-2xl"
                  >
                    {/* Admin info */}
                    <div className="px-4 py-3 border-b border-[var(--border-primary)]">
                      <p className="text-sm font-semibold text-[var(--text-primary)]">
                        {user?.full_name ?? "Administrator"}
                      </p>
                      <p className="text-xs text-[var(--text-muted)]">
                        {user?.email ?? ""}
                      </p>
                    </div>

                    {/* Menu items */}
                    <div className="py-1">
                      {adminMenuItems.map((item) => (
                        <Link
                          key={item.label}
                          href={item.href}
                          onClick={() => setAdminMenuOpen(false)}
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--accent-faint)] hover:text-[var(--text-primary)] transition-colors"
                        >
                          <item.icon size={15} />
                          {item.label}
                        </Link>
                      ))}
                    </div>

                    {/* Theme toggle in menu */}
                    <div className="border-t border-[var(--border-primary)] py-1">
                      <button
                        onClick={toggleTheme}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--accent-faint)] hover:text-[var(--text-primary)] transition-colors"
                      >
                        {!hasHydrated || theme === "dark" ? (
                          <Sun size={15} />
                        ) : (
                          <Moon size={15} />
                        )}
                        {!hasHydrated || theme === "dark"
                          ? "Light Mode"
                          : "Dark Mode"}
                      </button>
                    </div>

                    {/* Logout */}
                    <div className="border-t border-[var(--border-primary)] py-1">
                      <button
                        type="button"
                        onClick={() => {
                          setAdminMenuOpen(false);
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

          <div className="border-t border-[var(--border-primary)] pb-3 pt-2 sm:hidden">
            <GlobalSearch
              scope="admin"
              id="admin-topbar-search-mobile"
              className="w-full"
              compact
            />
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" as const }}
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
    </AuthGuard>
  );
}
