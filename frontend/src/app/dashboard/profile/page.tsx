'use client';

import { useEffect, useState } from 'react';
import { Camera, Shield, User } from 'lucide-react';
import { countriesAPI, usersAPI } from '@/lib/api';
import CountrySelect from '@/components/ui/CountrySelect';
import { CountryLabel } from '@/components/ui/CountryFlag';
import { useCountryContextStore } from '@/store/countryContextStore';
import { buildCountryOptions, type CountryOption } from '@/lib/countryOptions';
import { handleApiError } from '@/lib/errorHandler';
import { MESSAGES, toast } from '@/lib/feedback';
import { getPersonalizedGreeting } from '@/lib/greeting';
import FieldError from '@/components/ui/FieldError';
import { useAuthStore } from '@/store/authStore';

export default function ProfilePage() {
  const authUser = useAuthStore((s) => s.user);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const resetToHome = useCountryContextStore((s) => s.resetToHome);
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [countriesLoading, setCountriesLoading] = useState(true);
  const [fullName, setFullName] = useState(authUser?.full_name ?? '');
  const [email, setEmail] = useState(authUser?.email ?? '');
  const [institution, setInstitution] = useState(authUser?.institution ?? '');
  const [country, setCountry] = useState(authUser?.country ?? '');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [tfaEnabled, setTfaEnabled] = useState(false);
  const [sessions, setSessions] = useState([
    { id: '1', device: 'Current browser', lastActive: 'Just now', current: true },
    { id: '2', device: 'Mobile App', lastActive: '2h ago', current: false },
  ]);
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');

  useEffect(() => {
    countriesAPI
      .list()
      .then((data) => setCountries(buildCountryOptions(data.countries ?? [])))
      .catch(() => setCountries(buildCountryOptions()))
      .finally(() => setCountriesLoading(false));
  }, []);

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
      resetToHome(country);
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
            <label className="space-y-1.5 sm:col-span-2">
              <span className="text-xs text-[var(--text-muted)]">Home country</span>
              <CountrySelect
                countries={countries}
                value={country}
                onChange={setCountry}
                loading={countriesLoading}
                className="w-full"
              />
              {country ? (
                <p className="text-xs text-[var(--text-faint)]">
                  Default analysis uses{" "}
                  <CountryLabel code={country} />
                </p>
              ) : null}
            </label>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="mt-4 rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save changes'}
          </button>
        </section>
      </div>

      {/* Password Management */}
      <section className="glass-panel rounded-2xl p-6">
        <div className="mb-5 flex items-center gap-3">
          <Shield className="h-5 w-5 text-[var(--text-primary)]" />
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Password Management</h2>
        </div>
        <div className="max-w-md space-y-3">
          <input type="password" placeholder="Current password" className="w-full app-input" value={currentPass} onChange={e => setCurrentPass(e.target.value)} />
          <input type="password" placeholder="New password" className="w-full app-input" value={newPass} onChange={e => setNewPass(e.target.value)} />
          <input type="password" placeholder="Confirm new password" className="w-full app-input" value={confirmPass} onChange={e => setConfirmPass(e.target.value)} />
          <button
            onClick={async () => {
              if (!currentPass || !newPass || newPass !== confirmPass) {
                return toast.error('Please fill all fields and ensure new passwords match');
              }
              try {
                await usersAPI.changePassword({ current_password: currentPass, new_password: newPass });
                toast.success('Password updated successfully');
                setCurrentPass(''); setNewPass(''); setConfirmPass('');
              } catch (e) { handleApiError(e, 'Password'); }
            }}
            className="rounded-xl bg-[var(--accent)] px-5 py-2 text-sm font-medium text-white"
          >
            Update Password
          </button>
        </div>
      </section>

      {/* 2FA */}
      <section className="glass-panel rounded-2xl p-6">
        <div className="mb-4 flex items-center gap-3">
          <Shield className="h-5 w-5" />
          <h2 className="text-lg font-semibold">Two-Factor Authentication</h2>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm">Status: <span className="font-medium text-[var(--text-primary)]">{tfaEnabled ? 'Enabled' : 'Disabled'}</span></p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">Protect your account with an authenticator app.</p>
          </div>
          <button
            onClick={() => {
              const next = !tfaEnabled;
              setTfaEnabled(next);
              if (next) {
                const secret = Math.random().toString(36).slice(2, 10).toUpperCase();
                toast.success(`2FA enabled (demo secret: ${secret}). Use app to generate codes.`);
              } else {
                toast.success('2FA disabled');
              }
            }}
            className={`rounded-xl px-4 py-1.5 text-sm ${tfaEnabled ? 'border border-[var(--border-primary)]' : 'border border-[var(--border-active)] bg-[var(--accent-faint)]'}`}
          >
            {tfaEnabled ? 'Disable 2FA' : 'Enable 2FA'}
          </button>
        </div>
      </section>

      {/* Session Management */}
      <section className="glass-panel rounded-2xl p-6">
        <div className="mb-4 flex items-center gap-3">
          <Shield className="h-5 w-5" />
          <h2 className="text-lg font-semibold">Active Sessions</h2>
        </div>
        <div className="space-y-2 text-sm">
          {sessions.map((s) => (
            <div key={s.id} className="flex justify-between items-center p-3 bg-[var(--accent-faint)] rounded-lg">
              <div>{s.device} · {s.lastActive}</div>
              {s.current ? (
                <span className="text-[10px] px-2 py-0.5 bg-green-500/10 text-green-600 rounded">Active now</span>
              ) : (
                <button
                  onClick={() => {
                    setSessions(prev => prev.filter(x => x.id !== s.id));
                    toast.success('Session revoked');
                  }}
                  className="text-[10px] px-2 py-0.5 border border-[var(--border-primary)] rounded hover:bg-[var(--glass-bg-hover)]"
                >
                  Revoke
                </button>
              )}
            </div>
          ))}
          <button
            onClick={() => {
              setSessions(prev => prev.filter(s => s.current));
              toast.success('Other sessions revoked');
            }}
            className="mt-2 text-xs underline text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            Revoke all other sessions
          </button>
        </div>
      </section>
    </div>
  );
}