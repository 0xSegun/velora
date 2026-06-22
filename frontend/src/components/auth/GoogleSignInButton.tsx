'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';
import { authAPI } from '@/lib/api';
import { parseLoginError } from '@/lib/errorHandler';
import { toast, toastWelcomeBack } from '@/lib/feedback';
import { useAuthStore } from '@/store/authStore';
import { defaultHomeForRole } from '@/lib/roles';

export default function GoogleSignInButton() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    authAPI
      .getGoogleConfig()
      .then(({ data }) => setEnabled(Boolean(data?.enabled && data?.client_id)))
      .catch(() => setEnabled(false));
  }, []);

  const handleSuccess = useCallback(
    async (response: CredentialResponse) => {
      if (!response.credential) {
        toast.error('Google sign-in did not return a credential.');
        return;
      }
      setLoading(true);
      try {
        const { data } = await authAPI.googleLogin(response.credential);
        const payload = data as {
          access_token: string;
          refresh_token: string;
          user: {
            id: string;
            email: string;
            full_name: string;
            country: string;
            role: 'user' | 'admin' | 'analyst';
            avatar_url?: string;
            is_verified: boolean;
          };
        };
        login(payload.user, payload.access_token, payload.refresh_token);
        toastWelcomeBack(payload.user.full_name);
        router.push(defaultHomeForRole(payload.user.role));
      } catch (err) {
        const { message } = parseLoginError(err);
        toast.error(message);
      } finally {
        setLoading(false);
      }
    },
    [login, router],
  );

  if (!enabled) {
    return (
      <button
        type="button"
        disabled
        className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-xl bg-[var(--glass-bg)] border border-[var(--border-hover)] text-[var(--text-muted)] text-sm font-medium opacity-60 cursor-not-allowed"
        title="Configure Google OAuth in Admin → Authentication"
      >
        Continue with Google (not configured)
      </button>
    );
  }

  return (
    <div className={`w-full flex justify-center ${loading ? 'opacity-60 pointer-events-none' : ''}`}>
      <GoogleLogin
        onSuccess={handleSuccess}
        onError={() => toast.error('Google sign-in was cancelled or failed.')}
        theme="outline"
        size="large"
        width="100%"
        text="continue_with"
        shape="rectangular"
      />
    </div>
  );
}