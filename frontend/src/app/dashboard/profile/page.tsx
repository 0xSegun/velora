'use client';

import { useEffect, useState } from 'react';
import { Camera, Shield, User } from 'lucide-react';
import { usersAPI } from '@/lib/api';
import { handleApiError } from '@/lib/errorHandler';
import { MESSAGES, toast } from '@/lib/feedback';
import { getPersonalizedGreeting } from '@/lib/greeting';
import FieldError from '@/components/ui/FieldError';
import { useAuthStore } from '@/store/authStore';

export default function ProfilePage() {
  const authUser = useAuthStore((s) => s.user);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const [fullName, setFullName] = useState(authUser?.full_name ?? '');
  const [email, setEmail] = useState(authUser?.email ?? '');
  const [institution, setInstitution] = useState(authUser?.institution ?? '');
  const [country, setCountry] = useState(authUser?.country ?? '');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    void usersAPI.getProfile().then(({ data }) => {
      const profile = data as {
        full_name: string;
        email: string;
        institution?: string;
        country: string;
      };
      setFullName(profile.full_name);
      setEmail(profile.email);
      setInstitution(profile.institution ?? '');
      setCountry(profile.country);
      updateProfile(profile);
    }).catch(() => {
      // Auth store remains source of truth when profile API is unavailable.
    });
  }, [updateProfile]);

  const handleSave = async () => {
    if (!fullName.trim()) {
      setErrors({ fullName: MESSAGES.validation.required });
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      await usersAPI.updateProfile({
        full_name: fullName,
        institution,
        country,
      });
      updateProfile({ full_name: fullName, institution, country });
      toast.success(MESSAGES.profile.updated);
    } catch (err) {
      handleApiError(err, 'Profile update', MESSAGES.profile.updateFailed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="glass-panel rounded-2xl p-6">
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--text-faint)]">User profile</p>
        <h1 className="mt-2 text-3xl font-bold text-[var(--text-primary)]">
          {getPersonalizedGreeting(fullName)}
        </h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Manage your account information, avatar, and security preferences.
        </p>
      </section>

      <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <section className="glass-panel rounded-2xl p-6">
          <div className="flex flex-col items-center text-center">
            <button
              className="flex h-28 w-28 items-center justify-center rounded-full border border-[var(--border-primary)] bg-[var(--accent-faint)]"
              aria-label="Upload profile picture"
            >
              <Camera className="h-7 w-7 text-[var(--text-muted)]" />
            </button>
            <h2 className="mt-4 text-lg font-semibold text-[var(--text-primary)]">{fullName || 'Account'}</h2>
            <p className="text-sm text-[var(--text-muted)]">{email}</p>
          </div>
        </section>

        <section className="glass-panel rounded-2xl p-6">
          <div className="mb-5 flex items-center gap-3">
            <User className="h-5 w-5 text-[var(--text-primary)]" />
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Account details</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-xs text-[var(--text-muted)]">Full name</span>
              <input
                className="w-full rounded-xl border border-[var(--border-primary)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)]"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                aria-invalid={!!errors.fullName}
              />
              <FieldError message={errors.fullName} />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs text-[var(--text-muted)]">Email address</span>
              <input
                className="w-full rounded-xl border border-[var(--border-primary)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-muted)]"
                value={email}
                readOnly
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs text-[var(--text-muted)]">Institution</span>
              <input
                className="w-full rounded-xl border border-[var(--border-primary)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)]"
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs text-[var(--text-muted)]">Country</span>
              <input
                className="w-full rounded-xl border border-[var(--border-primary)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)]"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
              />
            </label>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="mt-4 rounded-xl bg-[var(--text-primary)] px-5 py-2.5 text-sm font-medium text-[var(--bg-primary)] disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save changes'}
          </button>
        </section>
      </div>

      <section className="glass-panel rounded-2xl p-6">
        <div className="mb-5 flex items-center gap-3">
          <Shield className="h-5 w-5 text-[var(--text-primary)]" />
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Security</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {['Password management', 'Two-factor authentication', 'Session monitoring'].map((item) => (
            <div
              key={item}
              className="rounded-xl border border-[var(--border-primary)] bg-[var(--accent-faint)] p-4 text-sm text-[var(--text-secondary)]"
            >
              {item}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}