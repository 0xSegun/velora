'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { authAPI } from '@/lib/api';
import { handleApiError } from '@/lib/errorHandler';
import { MESSAGES, toast } from '@/lib/feedback';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      await authAPI.forgotPassword(email.trim());
      setSent(true);
      toast.success('If your email is registered, a reset link has been sent.');
    } catch (err) {
      const message = handleApiError(
        err,
        'Forgot password',
        'Could not send reset email. Please try again.',
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
      <AnimatePresence mode="wait">
        {!sent ? (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            <div className="flex justify-center">
              <svg
                className="w-12 h-12 text-[var(--text-primary)]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"
                />
              </svg>
            </div>

            <h1 className="text-2xl font-bold text-[var(--text-primary)] mt-4 text-center">Forgot Password?</h1>
            <p className="text-[var(--text-muted)] text-sm mt-1 text-center">
              Enter your email and we&apos;ll send you a reset link.
            </p>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center"
              >
                {error}
              </motion.div>
            )}

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                  Email Address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full bg-[var(--glass-bg)] border border-[var(--border-hover)] rounded-xl px-4 py-2.5 text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--border-active)] focus:ring-1 focus:ring-[var(--border-hover)] outline-none transition-colors duration-200"
                />
              </div>

              <button
                id="forgot-password-submit-btn"
                type="submit"
                disabled={loading}
                className="w-full bg-[var(--text-primary)] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-[var(--bg-primary)] rounded-xl py-2.5 font-medium shadow-[0_0_20px_rgba(255,255,255,0.06)] transition-all duration-200 flex items-center justify-center gap-2"
              >
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>

            <div className="mt-6 text-center">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 text-[var(--text-primary)] hover:text-[var(--text-secondary)] text-sm font-medium transition-colors"
              >
                Back to Sign In
              </Link>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="success"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="text-center"
          >
            <div className="flex justify-center">
              <svg
                className="w-16 h-16 text-green-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                />
              </svg>
            </div>

            <h2 className="text-2xl font-bold text-[var(--text-primary)] mt-4">Check Your Email</h2>
            <p className="text-[var(--text-muted)] text-sm mt-2 max-w-sm mx-auto">
              {MESSAGES.auth.forgotPasswordSent}{' '}
              <span className="text-[var(--text-primary)] font-medium">{email}</span>.
            </p>
            <p className="mt-2 text-xs text-[var(--text-muted)]">
              In local development, check <code className="text-[var(--text-secondary)]">backend/logs/</code> for email previews.
            </p>

            <div className="mt-8">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 text-[var(--text-primary)] hover:text-[var(--text-secondary)] text-sm font-medium transition-colors"
              >
                Back to Sign In
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}