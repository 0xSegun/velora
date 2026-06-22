"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Activity,
  Clock,
  Key,
  Link2,
  Loader2,
  Lock,
  MonitorCheck,
  Shield,
  Smartphone,
  Sun,
  Moon,
  User,
} from "lucide-react";
import { useThemeStore } from "@/store/themeStore";
import { authAPI, integrationsAPI, securityAPI } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { toast } from "@/lib/feedback";
import { formatDateTime } from "@/lib/dates";


interface SecurityOverview {
  mfa_enabled: boolean;
  password_changed_at: string | null;
  active_sessions: number;
  failed_logins_24h: number;
  successful_logins_24h: number;
  security_alerts: Array<{ severity: string; message: string }>;
  recent_audit: Array<{ id: string; action: string; created_at: string }>;
}

interface SessionRow {
  id: string;
  device_label: string;
  ip_address: string | null;
  last_active_at: string;
  is_current: boolean;
}

interface LoginRow {
  id: string;
  created_at: string;
  device_label: string | null;
  ip_address: string | null;
  status: string;
}

export default function AdminControlCenterPage() {
  const { theme, toggleTheme, hasHydrated } = useThemeStore();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const [overview, setOverview] = useState<SecurityOverview | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loginHistory, setLoginHistory] = useState<LoginRow[]>([]);
  const [integrationCount, setIntegrationCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  const [mfaSetup, setMfaSetup] = useState<{
    secret: string;
    provisioning_uri: string;
    backup_codes: string[];
  } | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaLoading, setMfaLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ovRes, sessRes, histRes, intRes] = await Promise.all([
        securityAPI.getOverview(),
        securityAPI.getSessions(),
        securityAPI.getLoginHistory(),
        integrationsAPI.list(),
      ]);
      setOverview(ovRes.data as SecurityOverview);
      setSessions((sessRes.data as SessionRow[]) ?? []);
      setLoginHistory((histRes.data as LoginRow[]) ?? []);
      setIntegrationCount((intRes.data as { total: number }).total ?? 0);
    } catch {
      toast.error("Failed to load control center data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handlePasswordChange = async () => {
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }
    setChangingPassword(true);
    try {
      await securityAPI.changePassword(currentPassword, newPassword);
      toast.success("Password updated. Please sign in again.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      logout();
    } catch {
      toast.error("Password update failed");
    } finally {
      setChangingPassword(false);
    }
  };

  const handleMfaSetup = async () => {
    setMfaLoading(true);
    try {
      const { data } = await securityAPI.setupMfa();
      setMfaSetup(data as typeof mfaSetup);
      toast.success("Scan the QR URI with your authenticator app");
    } catch {
      toast.error("MFA setup failed");
    } finally {
      setMfaLoading(false);
    }
  };

  const handleMfaEnable = async () => {
    if (!mfaCode.trim()) return;
    setMfaLoading(true);
    try {
      await securityAPI.enableMfa(mfaCode.trim());
      toast.success("Two-factor authentication enabled");
      setMfaSetup(null);
      setMfaCode("");
      await load();
    } catch {
      toast.error("Invalid code — MFA not enabled");
    } finally {
      setMfaLoading(false);
    }
  };

  const handleMfaDisable = async () => {
    if (!currentPassword || !mfaCode.trim()) {
      toast.error("Enter password and authenticator code");
      return;
    }
    setMfaLoading(true);
    try {
      await securityAPI.disableMfa(currentPassword, mfaCode.trim());
      toast.success("Two-factor authentication disabled");
      setMfaCode("");
      await load();
    } catch {
      toast.error("Could not disable MFA");
    } finally {
      setMfaLoading(false);
    }
  };

  const handleRevokeSession = async (id: string) => {
    try {
      await securityAPI.revokeSession(id);
      toast.success("Session revoked");
      await load();
    } catch {
      toast.error("Failed to revoke session");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--text-muted)]" />
      </div>
    );
  }

  const displayName = user?.full_name ?? "Administrator";
  const displayEmail = user?.email ?? "";

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass-panel rounded-2xl p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--text-faint)]">Admin Control Center</p>
            <h1 className="mt-2 text-3xl font-bold text-[var(--text-primary)]">Administrator workspace</h1>
            <p className="mt-2 max-w-2xl text-sm text-[var(--text-muted)]">
              Security monitoring, MFA, sessions, and platform access from one audited surface.
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-[var(--border-primary)] bg-[var(--accent-faint)] p-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--accent)] text-sm font-bold text-white">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--text-primary)]">{displayName}</p>
              <p className="text-xs text-[var(--text-muted)]">{displayEmail}</p>
            </div>
          </div>
        </div>
      </motion.div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Two-factor authentication",
            value: overview?.mfa_enabled ? "Enabled" : "Disabled",
            icon: Shield,
          },
          {
            label: "Active sessions",
            value: String(overview?.active_sessions ?? 0),
            icon: Smartphone,
          },
          {
            label: "Logins (24h)",
            value: `${overview?.successful_logins_24h ?? 0} ok / ${overview?.failed_logins_24h ?? 0} failed`,
            icon: MonitorCheck,
          },
          {
            label: "Platform APIs",
            value: `${integrationCount} integrations`,
            icon: Key,
          },
        ].map((item) => (
          <div key={item.label} className="glass-panel rounded-2xl p-5">
            <item.icon className="mb-4 h-5 w-5 text-[var(--text-primary)]" />
            <p className="text-sm font-medium text-[var(--text-primary)]">{item.label}</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">{item.value}</p>
          </div>
        ))}
      </section>

      {(overview?.security_alerts?.length ?? 0) > 0 && (
        <section className="glass-panel rounded-2xl p-6">
          <h2 className="mb-3 text-lg font-semibold text-[var(--text-primary)]">Security alerts</h2>
          <div className="space-y-2">
            {overview?.security_alerts.map((alert) => (
              <p key={alert.message} className="rounded-xl border border-[var(--border-primary)] bg-[var(--accent-faint)] px-4 py-3 text-sm text-[var(--text-secondary)]">
                {alert.message}
              </p>
            ))}
          </div>
        </section>
      )}

      <section id="security" className="glass-panel rounded-2xl p-6">
        <div className="mb-5 flex items-center gap-3">
          <Shield className="h-5 w-5 text-[var(--text-primary)]" />
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Two-factor authentication</h2>
        </div>
        {overview?.mfa_enabled ? (
          <div className="space-y-3">
            <p className="text-sm text-[var(--text-muted)]">MFA is active on this account.</p>
            <div className="flex flex-wrap gap-3">
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Password"
                className="app-input rounded-xl px-3 py-2 text-sm"
              />
              <input
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
                placeholder="Authenticator code"
                className="app-input rounded-xl px-3 py-2 text-sm"
              />
              <button
                type="button"
                disabled={mfaLoading}
                onClick={() => void handleMfaDisable()}
                className="rounded-xl border px-4 py-2 text-sm"
              >
                Disable MFA
              </button>
            </div>
          </div>
        ) : mfaSetup ? (
          <div className="space-y-3">
            <p className="text-xs text-[var(--text-muted)] break-all">Setup URI: {mfaSetup.provisioning_uri}</p>
            <p className="text-xs text-[var(--text-muted)]">Secret: {mfaSetup.secret}</p>
            <p className="text-xs text-[var(--text-muted)]">Backup codes: {mfaSetup.backup_codes.join(", ")}</p>
            <input
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value)}
              placeholder="Enter 6-digit code to confirm"
              className="app-input w-full max-w-xs rounded-xl px-3 py-2 text-sm"
            />
            <button
              type="button"
              disabled={mfaLoading}
              onClick={() => void handleMfaEnable()}
              className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm text-white"
            >
              Confirm & Enable
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={mfaLoading}
            onClick={() => void handleMfaSetup()}
            className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm text-white"
          >
            Set up authenticator app
          </button>
        )}
      </section>

      <section className="glass-panel rounded-2xl p-6">
        <div className="mb-5 flex items-center gap-3">
          <Lock className="h-5 w-5 text-[var(--text-primary)]" />
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Change password</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <label className="space-y-1.5">
            <span className="text-xs text-[var(--text-muted)]">Current password</span>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="app-input w-full rounded-xl px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs text-[var(--text-muted)]">New password</span>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="app-input w-full rounded-xl px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs text-[var(--text-muted)]">Confirm new password</span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="app-input w-full rounded-xl px-3 py-2 text-sm"
            />
          </label>
        </div>
        <button
          type="button"
          disabled={changingPassword}
          onClick={() => void handlePasswordChange()}
          className="mt-4 rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-white"
        >
          {changingPassword ? "Updating…" : "Update password"}
        </button>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="glass-panel rounded-2xl p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Smartphone className="h-5 w-5 text-[var(--text-primary)]" />
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Session management</h2>
            </div>
            <button
              type="button"
              onClick={() => void securityAPI.revokeOtherSessions().then(() => load())}
              className="text-xs text-[var(--text-muted)] underline"
            >
              Revoke others
            </button>
          </div>
          <div className="space-y-3">
            {sessions.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">No active sessions</p>
            ) : (
              sessions.map((session) => (
                <div key={session.id} className="flex items-center justify-between rounded-xl border border-[var(--border-primary)] bg-[var(--accent-faint)] px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">
                      {session.device_label}
                      {session.is_current ? " (current)" : ""}
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">{session.ip_address ?? "Unknown IP"}</p>
                  </div>
                  {!session.is_current && (
                    <button
                      type="button"
                      onClick={() => void handleRevokeSession(session.id)}
                      className="text-xs text-red-500"
                    >
                      Revoke
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </section>

        <section id="activity" className="glass-panel rounded-2xl p-6">
          <div className="mb-5 flex items-center gap-3">
            <Activity className="h-5 w-5 text-[var(--text-primary)]" />
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Security audit log</h2>
          </div>
          <div className="space-y-3">
            {(overview?.recent_audit ?? []).length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">No audit events yet</p>
            ) : (
              overview?.recent_audit.map((item) => (
                <div key={item.id} className="flex gap-3 rounded-xl border border-[var(--border-primary)] bg-[var(--accent-faint)] px-4 py-3">
                  <Clock className="mt-0.5 h-4 w-4 text-[var(--text-muted)]" />
                  <div>
                    <p className="text-sm text-[var(--text-primary)]">{item.action.replace(/_/g, " ")}</p>
                    <p className="text-xs text-[var(--text-muted)]">{formatDateTime(item.created_at)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <section className="glass-panel rounded-2xl p-6">
        <div className="mb-5 flex items-center gap-3">
          <MonitorCheck className="h-5 w-5 text-[var(--text-primary)]" />
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Login history</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border-primary)] text-xs uppercase text-[var(--text-faint)]">
                <th className="pb-3 pr-4">Time</th>
                <th className="pb-3 pr-4">Device</th>
                <th className="pb-3 pr-4">IP</th>
                <th className="pb-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {loginHistory.map((entry) => (
                <tr key={entry.id} className="border-b border-[var(--border-primary)] last:border-0">
                  <td className="py-3 pr-4 text-[var(--text-secondary)]">{formatDateTime(entry.created_at)}</td>
                  <td className="py-3 pr-4 text-[var(--text-muted)]">{entry.device_label ?? "—"}</td>
                  <td className="py-3 pr-4 text-[var(--text-muted)]">{entry.ip_address ?? "—"}</td>
                  <td className="py-3 text-[var(--text-primary)]">{entry.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section id="api" className="glass-panel rounded-2xl p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link2 className="h-5 w-5 text-[var(--text-primary)]" />
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">API management</h2>
          </div>
          <Link href="/admin/api-config" className="text-xs text-[var(--accent)] underline">
            Open API Configuration Center
          </Link>
        </div>
        <p className="text-sm text-[var(--text-muted)]">
          {integrationCount} platform integrations (FRED, IMF, World Bank, News, Wikipedia, Trading Economics, Exchange Rate, Resend, Google OAuth) are managed from the unified configuration center.
        </p>
      </section>

      <section className="glass-panel rounded-2xl p-6">
        <div className="mb-4 flex items-center gap-3">
          <User className="h-5 w-5 text-[var(--text-primary)]" />
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Preferences</h2>
        </div>
        <button
          type="button"
          onClick={toggleTheme}
          className="flex w-full items-center justify-between rounded-xl border border-[var(--border-primary)] bg-[var(--accent-faint)] px-4 py-3 text-sm"
        >
          <span>Theme</span>
          <span className="flex items-center gap-2">
            {!hasHydrated || theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            {!hasHydrated || theme === "dark" ? "Dark" : "Light"}
          </span>
        </button>
      </section>
    </div>
  );
}