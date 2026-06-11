'use client';

import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { authAPI } from '@/lib/api';
import { handleApiError } from '@/lib/errorHandler';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Verifying your email...');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Verification link is invalid or missing.');
      return;
    }

    authAPI
      .verifyEmail(token)
      .then(() => {
        setStatus('success');
        setMessage('Your email has been verified. You can sign in and use the full platform.');
      })
      .catch((err) => {
        setStatus('error');
        setMessage(
          handleApiError(
            err,
            'Verify email',
            'Verification failed. The link may have expired.',
            false,
          ),
        );
      });
  }, [token]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' as const }}
      className="max-w-md w-full mx-auto glass-panel rounded-2xl p-8 text-center"
    >
      <h1 className="text-2xl font-bold text-[var(--text-primary)]">Email Verification</h1>
      <p
        className={`mt-4 text-sm ${
          status === 'success'
            ? 'text-green-400'
            : status === 'error'
              ? 'text-red-400'
              : 'text-[var(--text-muted)]'
        }`}
      >
        {message}
      </p>

      {status !== 'loading' && (
        <Link
          href="/login"
          className="mt-8 inline-flex items-center justify-center rounded-xl bg-[var(--text-primary)] px-5 py-2.5 text-sm font-medium text-[var(--bg-primary)] transition hover:opacity-90"
        >
          Go to Sign In
        </Link>
      )}
    </motion.div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="text-center text-[var(--text-muted)]">Loading...</div>}>
      <VerifyEmailContent />
    </Suspense>
  );
}