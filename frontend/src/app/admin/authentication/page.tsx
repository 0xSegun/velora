'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Key, Save, Shield, TestTube } from 'lucide-react';
import { adminAPI } from '@/lib/api';
import { toast } from '@/lib/feedback';

export default function AdminAuthenticationPage() {
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [redirectUri, setRedirectUri] = useState('');
  const [status, setStatus] = useState('not_configured');
  const [hasSecret, setHasSecret] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await adminAPI.getGoogleOAuth();
      const cfg = data as {
        client_id?: string;
        client_secret?: string;
        enabled?: boolean;
        redirect_uri?: string;
        status?: string;
        has_secret?: boolean;
      };
      setClientId(cfg.client_id ?? '');
      setClientSecret(cfg.has_secret ? '***' : '');
      setHasSecret(Boolean(cfg.has_secret));
      setEnabled(cfg.enabled ?? false);
      setRedirectUri(cfg.redirect_uri ?? '');
      setStatus(cfg.status ?? 'not_configured');
    } catch {
      toast.error('Could not load Google OAuth settings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      await adminAPI.updateGoogleOAuth({
        client_id: clientId,
        client_secret: clientSecret,
        enabled,
        redirect_uri: redirectUri,
      });
      toast.success('Google OAuth configuration saved.');
      await load();
    } catch {
      toast.error('Failed to save Google OAuth configuration.');
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    try {
      const { data } = await adminAPI.testGoogleOAuth();
      const result = data as { ok?: boolean; message?: string };
      if (result.ok) toast.success(result.message ?? 'Connection OK');
      else toast.warning(result.message ?? 'Connection check failed');
    } catch {
      toast.error('Connection test failed.');
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-faint)]">Authentication Settings</p>
        <h1 className="mt-2 text-2xl font-bold text-[var(--text-primary)]">Google OAuth Configuration</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Manage Google Sign-In without editing source code. Changes apply immediately.
        </p>
      </div>

      <div className="glass-panel rounded-2xl p-6 space-y-5">
        <div className="flex items-center justify-between rounded-xl border border-[var(--border-primary)] bg-[var(--accent-faint)] px-4 py-3">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-[var(--text-primary)]" />
            <span className="text-sm text-[var(--text-secondary)]">OAuth Status</span>
          </div>
          <span className="text-sm font-medium capitalize text-[var(--text-primary)]">{status.replace('_', ' ')}</span>
        </div>

        {loading ? (
          <p className="text-sm text-[var(--text-muted)]">Loading configuration...</p>
        ) : (
          <>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[var(--text-muted)]">Google Client ID</label>
              <input
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="w-full rounded-xl border border-[var(--border-hover)] bg-[var(--accent-faint)] px-4 py-2.5 text-sm text-[var(--text-primary)]"
                placeholder="xxxx.apps.googleusercontent.com"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[var(--text-muted)]">Google Client Secret</label>
              <input
                type="password"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                className="w-full rounded-xl border border-[var(--border-hover)] bg-[var(--accent-faint)] px-4 py-2.5 text-sm text-[var(--text-primary)]"
                placeholder={hasSecret ? 'Leave as *** to keep existing secret' : 'Enter client secret'}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[var(--text-muted)]">Redirect URI</label>
              <input
                value={redirectUri}
                onChange={(e) => setRedirectUri(e.target.value)}
                className="w-full rounded-xl border border-[var(--border-hover)] bg-[var(--accent-faint)] px-4 py-2.5 text-sm text-[var(--text-primary)]"
              />
              <p className="mt-1 text-xs text-[var(--text-muted)]">Add this URI in Google Cloud Console → OAuth credentials.</p>
            </div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-[var(--border-hover)]"
              />
              <span className="text-sm text-[var(--text-secondary)]">Enable Google Login</span>
            </label>
          </>
        )}

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            onClick={() => void save()}
            disabled={saving || loading}
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
          >
            <Save className="h-4 w-4" /> Save Configuration
          </button>
          <button
            onClick={() => void testConnection()}
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-active)] px-4 py-2.5 text-sm text-[var(--text-primary)]"
          >
            <TestTube className="h-4 w-4" /> Test Connection
          </button>
          <button
            onClick={() => setEnabled(false)}
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-primary)] px-4 py-2.5 text-sm text-[var(--text-muted)]"
          >
            <Key className="h-4 w-4" /> Disable Google Login
          </button>
        </div>
      </div>
    </motion.div>
  );
}