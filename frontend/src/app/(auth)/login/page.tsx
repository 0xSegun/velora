'use client';

import { useEffect, useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { authAPI } from '@/lib/api';
import { parseLoginError } from '@/lib/errorHandler';
import { toast, toastWelcomeBack } from '@/lib/feedback';
import { validateEmailField } from '@/lib/validation';
import FieldError from '@/components/ui/FieldError';
import GoogleSignInButton from '@/components/auth/GoogleSignInButton';
import { useAuthStore } from '@/store/authStore';
import { canAccessRoute, defaultHomeForRole } from '@/lib/roles';

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [rememberMe, setRememberMe] = useState(false);
  const [mfaChallenge, setMfaChallenge] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [adminCreds, setAdminCreds] = useState<{
    email: string;
    password: string;
    name: string;
  } | null>(null);

  useEffect(() => {
    authAPI
      .getDefaultAdmin()
      .then(({ data }) => {
        if (data?.email && data?.password) setAdminCreds(data);
      })
      .catch(() => {});
  }, []);

  const fillAdminCredentials = () => {
    if (!adminCreds) return;
    setEmail(adminCreds.email);
    setPassword(adminCreds.password);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});

    const emailErr = validateEmailField(email);
    if (emailErr) {
      setFieldErrors({ email: emailErr });
      return;
    }
    if (!password) {
      setFieldErrors({ password: 'This field is required.' });
      return;
    }

    setLoading(true);

    try {
      const { data } = await authAPI.login(email, password);
      const payload = data as {
        mfa_required?: boolean;
        challenge_token?: string;
        access_token?: string;
        refresh_token?: string;
        user?: {
          id: string;
          email: string;
          full_name: string;
          phone?: string;
          institution?: string;
          country: string;
          role: 'user' | 'admin' | 'analyst';
          avatar_url?: string;
          is_verified: boolean;
        };
      };
      if (payload.mfa_required && payload.challenge_token) {
        setMfaChallenge(payload.challenge_token);
        toast.info("Enter your authenticator code to continue");
        return;
      }
      if (!payload.access_token || !payload.refresh_token || !payload.user) {
        setError("Unexpected login response");
        return;
      }
      login(payload.user, payload.access_token, payload.refresh_token);
      toastWelcomeBack(payload.user.full_name);
      const redirect =
        typeof window !== 'undefined'
          ? new URLSearchParams(window.location.search).get('redirect')
          : null;
      const home = defaultHomeForRole(payload.user.role);
      if (redirect && canAccessRoute(payload.user.role, redirect)) {
        router.push(redirect);
      } else {
        router.push(home);
      }
    } catch (err) {
      const { message, type } = parseLoginError(err);
      setError(message);
      if (type === 'warning') toast.warning(message);
      else toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const completeMfaLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (!mfaChallenge || !mfaCode.trim()) return;
    setLoading(true);
    setError("");
    try {
      const { data } = await authAPI.mfaVerify(mfaChallenge, mfaCode.trim());
      const payload = data as {
        access_token: string;
        refresh_token: string;
        user: {
          id: string;
          email: string;
          full_name: string;
          country: string;
          role: 'user' | 'admin' | 'analyst';
          is_verified: boolean;
        };
      };
      login(payload.user, payload.access_token, payload.refresh_token);
      toastWelcomeBack(payload.user.full_name);
      router.push(defaultHomeForRole(payload.user.role));
    } catch (err) {
      const { message, type } = parseLoginError(err);
      setError(message);
      if (type === 'warning') toast.warning(message);
      else toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  if (mfaChallenge) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-panel max-w-md w-full mx-auto rounded-2xl p-8"
      >
        <h1 className="text-2xl font-bold text-[var(--text-primary)] text-center">Two-factor authentication</h1>
        <p className="text-[var(--text-muted)] text-sm mt-2 text-center">Enter the 6-digit code from your authenticator app</p>
        {error && (
          <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
            {error}
          </div>
        )}
        <form onSubmit={completeMfaLogin} className="mt-6 space-y-4">
          <input
            value={mfaCode}
            onChange={(e) => setMfaCode(e.target.value)}
            placeholder="000000"
            className="app-input w-full rounded-xl px-4 py-2.5 text-center text-lg tracking-widest"
            maxLength={8}
            autoFocus
          />
          <button type="submit" disabled={loading} className="btn-primary w-full py-2.5 rounded-xl">
            {loading ? "Verifying…" : "Verify & Sign In"}
          </button>
          <button
            type="button"
            onClick={() => { setMfaChallenge(null); setMfaCode(""); }}
            className="w-full text-sm text-[var(--text-muted)]"
          >
            Back to login
          </button>
        </form>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' as const }}
      className="glass-panel max-w-md w-full mx-auto rounded-2xl p-8"
    >
      {/* Logo */}
      <div className="text-center">
        <span className="text-2xl font-bold text-[var(--text-primary)]">🔮 Velora</span>
      </div>

      {/* Heading */}
      <h1 className="text-2xl font-bold text-[var(--text-primary)] mt-6 text-center">Welcome Back</h1>
      <p className="text-[var(--text-muted)] text-sm mt-1 text-center">Sign in to your account</p>

      {adminCreds && (
        <div className="glass-card mt-5 rounded-xl p-4 hover:transform-none">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Default admin access
          </p>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            <span className="text-[var(--text-muted)]">Email:</span>{' '}
            <span className="font-medium text-[var(--text-primary)]">{adminCreds.email}</span>
          </p>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            <span className="text-[var(--text-muted)]">Password:</span>{' '}
            <span className="font-medium text-[var(--text-primary)]">{adminCreds.password}</span>
          </p>
          <button
            type="button"
            onClick={fillAdminCredentials}
            className="mt-3 w-full rounded-lg border border-[var(--border-active)] bg-[var(--glass-bg)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] transition hover:bg-[var(--glass-bg-hover)]"
          >
            Use admin credentials
          </button>
        </div>
      )}

      {/* Error message */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center"
        >
          {error}
        </motion.div>
      )}

      <div className="mt-6" id="google-login-btn">
        <GoogleSignInButton />
      </div>

      {/* Divider */}
      <div className="flex items-center gap-3 my-6">
        <div className="flex-1 h-px bg-[var(--border-hover)]" />
        <span className="text-[var(--text-muted)] text-xs uppercase tracking-wider">or</span>
        <div className="flex-1 h-px bg-[var(--border-hover)]" />
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {/* Email */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
            Email Address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="app-input w-full rounded-xl px-4 py-2.5 text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:ring-1 focus:ring-[var(--border-hover)] outline-none"
            aria-invalid={!!fieldErrors.email}
          />
          <FieldError message={fieldErrors.email} />
        </div>

        {/* Password */}
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="app-input w-full rounded-xl px-4 py-2.5 pr-12 text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:ring-1 focus:ring-[var(--border-hover)] outline-none"
              aria-invalid={!!fieldErrors.password}
            />
            <button
              id="toggle-password-btn"
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            >
              {showPassword ? (
                /* EyeOff icon */
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                </svg>
              ) : (
                /* Eye icon */
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                </svg>
              )}
            </button>
          </div>
          <FieldError message={fieldErrors.password} />
        </div>

        {/* Remember me + Forgot password */}
        <div className="flex justify-between items-center mt-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              id="remember-me"
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded border-[var(--border-hover)] bg-[var(--glass-bg)] text-[var(--text-primary)] focus:ring-[var(--border-hover)] focus:ring-offset-0"
            />
            <span className="text-sm text-[var(--text-muted)]">Remember me</span>
          </label>
          <Link
            href="/forgot-password"
            className="text-[var(--accent)] hover:text-[var(--accent-hover)] text-sm transition-colors"
          >
            Forgot password?
          </Link>
        </div>

        {/* Submit button */}
        <button
          id="login-submit-btn"
          type="submit"
          disabled={loading}
          className="btn-primary btn-shine w-full mt-6 py-2.5 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Signing in...
            </>
          ) : (
            'Sign In'
          )}
        </button>
      </form>

      {/* Bottom link */}
      <p className="text-center text-sm text-[var(--text-muted)] mt-6">
        Don&apos;t have an account?{' '}
        <Link href="/register" className="text-[var(--text-primary)] hover:text-[var(--text-secondary)] font-medium transition-colors">
          Sign up
        </Link>
      </p>
    </motion.div>
  );
}
