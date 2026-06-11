'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  Camera,
  Clock,
  Key,
  Lock,
  MonitorCheck,
  Moon,
  ServerCog,
  Shield,
  Smartphone,
  Sun,
  User,
} from 'lucide-react';
import { useThemeStore } from '@/store/themeStore';

const sessions = [
  { device: 'Chrome on Windows', location: 'Lagos, Nigeria', lastActive: 'Active now' },
  { device: 'Safari on iPad', location: 'Abuja, Nigeria', lastActive: '2 hours ago' },
  { device: 'Edge on Windows', location: 'London, UK', lastActive: 'Yesterday' },
];

const loginHistory = [
  { time: 'Today, 09:14 WAT', location: 'Lagos, Nigeria', device: 'Chrome / Windows', status: 'Success' },
  { time: 'Yesterday, 18:42 WAT', location: 'Abuja, Nigeria', device: 'Safari / iPad', status: 'Success' },
  { time: 'Jun 8, 11:03 WAT', location: 'London, UK', device: 'Edge / Windows', status: 'Success' },
  { time: 'Jun 5, 22:17 WAT', location: 'Unknown', device: 'Firefox / Linux', status: 'Blocked' },
];

const activity = [
  'Updated model deployment policy',
  'Reviewed API credential rotation',
  'Approved TS-Transformer training run',
  'Exported system health report',
];

const securityItems = [
  { label: 'Two-factor authentication', value: 'Enabled', icon: Shield },
  { label: 'Password rotation', value: 'Last changed 18 days ago', icon: Lock },
  { label: 'API key access', value: 'Restricted to admin role', icon: Key },
  { label: 'Security monitoring', value: 'No active alerts', icon: MonitorCheck },
];

export default function AdminControlCenterPage() {
  const { theme, toggleTheme, hasHydrated } = useThemeStore();
  const [profileImage, setProfileImage] = useState<string | null>(null);

  const handleProfileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setProfileImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass-panel rounded-2xl p-6 backdrop-blur-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--text-faint)]">Admin Control Center</p>
            <h1 className="mt-2 text-3xl font-bold text-[var(--text-primary)]">Administrator workspace</h1>
            <p className="mt-2 max-w-2xl text-sm text-[var(--text-muted)]">
              Manage profile, security, sessions, preferences, and platform access from one audited control surface.
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-[var(--border-primary)] bg-[var(--accent-faint)] p-3">
            {profileImage ? (
              <img src={profileImage} alt="Admin profile" className="h-12 w-12 rounded-full object-cover" />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--text-primary)] text-sm font-bold text-[var(--bg-primary)]">A</div>
            )}
            <div>
              <p className="text-sm font-semibold text-[var(--text-primary)]">Administrator</p>
              <p className="text-xs text-[var(--text-muted)]">admin@velora.ai</p>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section id="profile" className="glass-panel rounded-2xl p-6">
          <div className="mb-5 flex items-center gap-3">
            <User className="h-5 w-5 text-[var(--text-primary)]" />
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Admin profile</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-[auto_1fr]">
            <label className="group relative flex h-24 w-24 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border border-[var(--border-primary)] bg-[var(--accent-faint)] transition hover:border-[var(--border-hover)]">
              {profileImage ? (
                <img src={profileImage} alt="Profile preview" className="h-full w-full object-cover" />
              ) : (
                <Camera className="h-6 w-6 text-[var(--text-muted)] group-hover:text-[var(--text-primary)]" />
              )}
              <input type="file" accept="image/*" className="sr-only" onChange={handleProfileUpload} />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                ['Full name', 'Administrator'],
                ['Email', 'admin@velora.ai'],
                ['Role', 'Platform Admin'],
                ['Timezone', 'Africa/Lagos'],
              ].map(([label, value]) => (
                <label key={label} className="space-y-1.5">
                  <span className="text-xs text-[var(--text-muted)]">{label}</span>
                  <input className="w-full rounded-xl border border-[var(--border-primary)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)]" defaultValue={value} />
                </label>
              ))}
            </div>
          </div>
        </section>

        <section id="account" className="glass-panel rounded-2xl p-6">
          <div className="mb-5 flex items-center gap-3">
            <ServerCog className="h-5 w-5 text-[var(--text-primary)]" />
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Account preferences</h2>
          </div>
          <div className="space-y-3">
            {['Theme preference sync', 'Email system digests', 'Model training alerts', 'Dataset upload notifications'].map((item, index) => (
              <label key={item} className="flex items-center justify-between rounded-xl border border-[var(--border-primary)] bg-[var(--accent-faint)] px-4 py-3">
                <span className="text-sm text-[var(--text-secondary)]">{item}</span>
                <input type="checkbox" defaultChecked={index !== 1} className="h-4 w-4 accent-black dark:accent-white" />
              </label>
            ))}
            <button
              onClick={toggleTheme}
              className="flex w-full items-center justify-between rounded-xl border border-[var(--border-primary)] bg-[var(--accent-faint)] px-4 py-3 text-sm text-[var(--text-secondary)] transition hover:border-[var(--border-hover)]"
            >
              <span>Theme preference</span>
              <span className="flex items-center gap-2 text-[var(--text-primary)]">
                {!hasHydrated || theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                {!hasHydrated || theme === 'dark' ? 'Dark mode' : 'Light mode'}
              </span>
            </button>
          </div>
        </section>
      </div>

      <section id="security" className="glass-panel rounded-2xl p-6">
        <div className="mb-5 flex items-center gap-3">
          <Lock className="h-5 w-5 text-[var(--text-primary)]" />
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Change password</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {['Current password', 'New password', 'Confirm new password'].map((label) => (
            <label key={label} className="space-y-1.5">
              <span className="text-xs text-[var(--text-muted)]">{label}</span>
              <input type="password" className="w-full rounded-xl border border-[var(--border-primary)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)]" placeholder="••••••••" />
            </label>
          ))}
        </div>
        <button className="mt-4 rounded-xl bg-[var(--text-primary)] px-5 py-2.5 text-sm font-medium text-[var(--bg-primary)] transition hover:opacity-90">
          Update password
        </button>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {securityItems.map((item) => (
          <div key={item.label} className="glass-panel rounded-2xl p-5">
            <item.icon className="mb-4 h-5 w-5 text-[var(--text-primary)]" />
            <p className="text-sm font-medium text-[var(--text-primary)]">{item.label}</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">{item.value}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="glass-panel rounded-2xl p-6">
          <div className="mb-5 flex items-center gap-3">
            <Smartphone className="h-5 w-5 text-[var(--text-primary)]" />
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Session management</h2>
          </div>
          <div className="space-y-3">
            {sessions.map((session) => (
              <div key={session.device} className="flex items-center justify-between rounded-xl border border-[var(--border-primary)] bg-[var(--accent-faint)] px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-[var(--text-primary)]">{session.device}</p>
                  <p className="text-xs text-[var(--text-muted)]">{session.location}</p>
                </div>
                <span className="text-xs text-[var(--text-muted)]">{session.lastActive}</span>
              </div>
            ))}
          </div>
        </section>

        <section id="activity" className="glass-panel rounded-2xl p-6">
          <div className="mb-5 flex items-center gap-3">
            <Activity className="h-5 w-5 text-[var(--text-primary)]" />
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Activity logs</h2>
          </div>
          <div className="space-y-3">
            {activity.map((item, index) => (
              <div key={item} className="flex gap-3 rounded-xl border border-[var(--border-primary)] bg-[var(--accent-faint)] px-4 py-3">
                <Clock className="mt-0.5 h-4 w-4 text-[var(--text-muted)]" />
                <div>
                  <p className="text-sm text-[var(--text-primary)]">{item}</p>
                  <p className="text-xs text-[var(--text-muted)]">{index + 1}h ago</p>
                </div>
              </div>
            ))}
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
              <tr className="border-b border-[var(--border-primary)] text-xs uppercase tracking-wider text-[var(--text-faint)]">
                <th className="pb-3 pr-4 font-medium">Time</th>
                <th className="pb-3 pr-4 font-medium">Location</th>
                <th className="pb-3 pr-4 font-medium">Device</th>
                <th className="pb-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {loginHistory.map((entry) => (
                <tr key={entry.time} className="border-b border-[var(--border-primary)] last:border-0">
                  <td className="py-3 pr-4 text-[var(--text-secondary)]">{entry.time}</td>
                  <td className="py-3 pr-4 text-[var(--text-muted)]">{entry.location}</td>
                  <td className="py-3 pr-4 text-[var(--text-muted)]">{entry.device}</td>
                  <td className="py-3 text-[var(--text-primary)]">{entry.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section id="api" className="glass-panel rounded-2xl p-6">
        <div className="mb-4 flex items-center gap-3">
          <Key className="h-5 w-5 text-[var(--text-primary)]" />
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">API management</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {['FRED API', 'Resend Email', 'Internal Prediction API'].map((item) => (
            <div key={item} className="rounded-xl border border-[var(--border-primary)] bg-[var(--accent-faint)] p-4">
              <p className="text-sm font-medium text-[var(--text-primary)]">{item}</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">Credential configured and access scoped.</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}