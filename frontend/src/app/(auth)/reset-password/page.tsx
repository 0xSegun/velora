'use client';

import { useState, FormEvent, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { authAPI } from '@/lib/api';
import { handleApiError } from '@/lib/errorHandler';
import { toast } from '@/lib/feedback';
import { validatePasswordField, validatePasswordMatch } from '@/lib/validation';
import FieldError from '@/components/ui/FieldError';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});

    if (!token) {
      setError('Reset link is invalid or missing. Request a new one.');
      return;
    }

    const passwordErr = validatePasswordField(password);
    const confirmErr = validatePasswordMatch(password, confirmPassword);
    if (passwordErr || confirmErr) {
      setFieldErrors({
        ...(passwordErr ? { password: passwordErr } : {}),
        ...(confirmErr ? { confirmPassword: confirmErr } : {}),
      });
      return;
    }

    setLoading(true);
    try {
      await authAPI.resetPassword(token, password);
      toast.success('Password reset successfully. You can sign in now.');
      router.push('/login');
    } catch (err) {
      const message = handleApiError(
        err,
        'Reset password',
        'Could not reset password. The link may have expired.',
        false,
      );
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' as const }}
      className="max-w-md w-full mx-auto glass-panel rounded-2xl p-8"
    >
      <h1 className="text-2xl font-bold text-[var(--text-primary)] text-center">Set a New Password</h1>
      <p className="text-[var(--text-muted)] text-sm mt-1 text-center">
        Choose a strong password for your account.
      </p>

      {error && (
        <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
            New Password
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[var(--glass-bg)] border border-[var(--border-hover)] rounded-xl px-4 py-2.5 pr-12 text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--border-active)] focus:ring-1 focus:ring-[var(--border-hover)] outline-none transition-colors duration-200"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
          <FieldError message={fieldErrors.password} />
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
            Confirm Password
          </label>
          <input
            id="confirmPassword"
            type={showPassword ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full bg-[var(--glass-bg)] border border-[var(--border-hover)] rounded-xl px-4 py-2.5 text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--border-active)] focus:ring-1 focus:ring-[var(--border-hover)] outline-none transition-colors duration-200"
          />
          <FieldError message={fieldErrors.confirmPassword} />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn-primary btn-shine w-full py-2.5 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Saving...' : 'Reset Password'}
        </button>
      </form>

      <p className="text-center text-sm text-[var(--text-muted)] mt-6">
        <Link href="/forgot-password" className="text-[var(--text-primary)] hover:text-[var(--text-secondary)]">
          Request a new reset link
        </Link>
      </p>
    </motion.div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="text-center text-[var(--text-muted)]">Loading...</div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}