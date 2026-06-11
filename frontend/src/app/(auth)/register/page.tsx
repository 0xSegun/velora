'use client';

import { useState, FormEvent, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { authAPI } from '@/lib/api';
import { MESSAGES, toast } from '@/lib/feedback';
import { handleApiError } from '@/lib/errorHandler';
import {
  validateEmailField,
  validatePasswordField,
  validatePasswordMatch,
} from '@/lib/validation';
import FieldError from '@/components/ui/FieldError';
import GoogleSignInButton from '@/components/auth/GoogleSignInButton';

/** Calculate password strength: 0-4 based on criteria */
function calcPasswordStrength(password: string): number {
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  return score;
}

const strengthLabels = ['', 'Weak', 'Medium', 'Strong', 'Very Strong'];
const strengthWidths = ['w-0', 'w-1/4', 'w-2/4', 'w-3/4', 'w-full'];
const strengthColors = ['bg-transparent', 'bg-red-500', 'bg-amber-500', 'bg-green-500', 'bg-green-500'];

const COUNTRY_OPTIONS = [
  'Nigeria',
  'Ghana',
  'South Africa',
  'Kenya',
  'USA',
  'UK',
  'Canada',
  'India',
  'China',
  'Brazil',
  'Germany',
  'France',
  'Japan',
  'Australia',
  'Other',
];

const COUNTRY_CODES: Record<string, string> = {
  Nigeria: 'NG',
  Ghana: 'GH',
  'South Africa': 'ZA',
  Kenya: 'KE',
  USA: 'US',
  UK: 'GB',
  Canada: 'CA',
  India: 'IN',
  China: 'CN',
  Brazil: 'BR',
  Germany: 'DE',
  France: 'FR',
  Japan: 'JP',
  Australia: 'AU',
  Other: 'NG',
};

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [institution, setInstitution] = useState('');
  const [country, setCountry] = useState('Nigeria');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const passwordStrength = useMemo(() => calcPasswordStrength(password), [password]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!fullName.trim()) newErrors.fullName = MESSAGES.validation.required;
    const emailErr = validateEmailField(email);
    if (emailErr) newErrors.email = emailErr;
    const passwordErr = validatePasswordField(password);
    if (passwordErr) newErrors.password = passwordErr;
    const matchErr = validatePasswordMatch(password, confirmPassword);
    if (matchErr) newErrors.confirmPassword = matchErr;
    if (!termsAccepted) newErrors.terms = 'You must accept the terms of service';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      await authAPI.register({
        email,
        password,
        full_name: fullName,
        phone: phone || undefined,
        institution: institution || undefined,
        country: COUNTRY_CODES[country] ?? 'NG',
      });
      toast.success(MESSAGES.auth.registerSuccess);
      setTimeout(() => router.push('/login'), 2500);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number } };
      if (axiosErr.response?.status === 409) {
        toast.warning('This email is already registered. Try signing in instead.');
        setErrors({ email: 'This email is already registered.' });
      } else {
        const message = handleApiError(err, 'Registration', 'Registration failed. Please try again.', false);
        toast.error(message);
        setErrors({ form: message });
      }
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'w-full bg-[var(--glass-bg)] border border-[var(--border-hover)] rounded-xl px-4 py-2.5 text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--border-active)] focus:ring-1 focus:ring-[var(--border-hover)] outline-none transition-colors duration-200';

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' as const }}
      className="max-w-lg w-full mx-auto glass-panel rounded-2xl p-8"
    >
      <div className="text-center">
        <span className="text-2xl font-bold text-[var(--text-primary)]">🔮 Velora</span>
      </div>

      <h1 className="text-2xl font-bold text-[var(--text-primary)] mt-6 text-center">Create Your Account</h1>
      <p className="text-[var(--text-muted)] text-sm mt-1 text-center">
        Join thousands of researchers and economists
      </p>

      {errors.form && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 p-3 rounded-xl bg-[#DC2626]/10 border border-[#DC2626]/20 text-[#DC2626] text-sm text-center"
          role="alert"
        >
          {errors.form}
        </motion.div>
      )}

      <div className="mt-6" id="google-register-btn">
        <GoogleSignInButton />
      </div>

      <div className="flex items-center gap-3 my-6">
        <div className="flex-1 h-px bg-[var(--border-hover)]" />
        <span className="text-[var(--text-muted)] text-xs uppercase tracking-wider">or</span>
        <div className="flex-1 h-px bg-[var(--border-hover)]" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="fullName" className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
            Full Name <span className="text-[#DC2626]">*</span>
          </label>
          <input
            id="fullName"
            name="fullName"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="John Doe"
            className={inputClass}
            aria-invalid={!!errors.fullName}
          />
          <FieldError message={errors.fullName} />
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
            Email Address <span className="text-[#DC2626]">*</span>
          </label>
          <input
            id="email"
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className={inputClass}
            aria-invalid={!!errors.email}
          />
          <FieldError message={errors.email} />
        </div>

        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
            Phone Number
          </label>
          <div className="relative flex">
            <span className="inline-flex items-center px-3 rounded-l-xl border border-r-0 border-[var(--border-hover)] bg-[var(--glass-bg)] text-[var(--text-muted)] text-sm">
              +234
            </span>
            <input
              id="phone"
              name="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="801 234 5678"
              className="flex-1 bg-[var(--glass-bg)] border border-[var(--border-hover)] rounded-r-xl px-4 py-2.5 text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--border-active)] focus:ring-1 focus:ring-[var(--border-hover)] outline-none transition-colors duration-200"
            />
          </div>
        </div>

        <div>
          <label htmlFor="institution" className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
            Institution
          </label>
          <input
            id="institution"
            name="institution"
            type="text"
            value={institution}
            onChange={(e) => setInstitution(e.target.value)}
            placeholder="e.g. University of Lagos"
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="country" className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
            Country
          </label>
          <select
            id="country"
            name="country"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="w-full bg-[var(--glass-bg)] border border-[var(--border-hover)] rounded-xl px-4 py-2.5 text-[var(--text-primary)] focus:border-[var(--border-active)] focus:ring-1 focus:ring-[var(--border-hover)] outline-none transition-colors duration-200 appearance-none cursor-pointer"
            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%2394a3b8' viewBox='0 0 16 16'%3E%3Cpath d='M7.247 11.14 2.451 5.658C1.885 5.013 2.345 4 3.204 4h9.592a1 1 0 0 1 .753 1.659l-4.796 5.48a1 1 0 0 1-1.506 0z'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center' }}
          >
            {COUNTRY_OPTIONS.map((c: string) => (
              <option key={c} value={c} className="bg-[var(--bg-secondary)] text-[var(--text-primary)]">
                {c}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
            Password <span className="text-[#DC2626]">*</span>
          </label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className={`${inputClass} pr-12`}
              aria-invalid={!!errors.password}
            />
            <button
              id="toggle-password-register"
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                </svg>
              )}
            </button>
          </div>
          {password && (
            <div className="mt-2">
              <div className="h-1 w-full bg-[var(--border-hover)] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${strengthWidths[passwordStrength]} ${strengthColors[passwordStrength]}`}
                />
              </div>
              <p className={`text-xs mt-1 ${passwordStrength <= 1 ? 'text-[#DC2626]' : passwordStrength === 2 ? 'text-[#CA8A04]' : 'text-[#16A34A]'}`}>
                {strengthLabels[passwordStrength]}
              </p>
            </div>
          )}
          <FieldError message={errors.password} variant={passwordStrength <= 2 && password ? 'warning' : 'error'} />
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
            Confirm Password <span className="text-[#DC2626]">*</span>
          </label>
          <div className="relative">
            <input
              id="confirmPassword"
              name="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className={`${inputClass} pr-12`}
              aria-invalid={!!errors.confirmPassword}
            />
            <button
              id="toggle-confirm-password"
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
            >
              {showConfirmPassword ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                </svg>
              )}
            </button>
          </div>
          <FieldError message={errors.confirmPassword} />
        </div>

        <div className="flex items-start gap-2 mt-2">
          <input
            id="terms"
            name="terms"
            type="checkbox"
            checked={termsAccepted}
            onChange={(e) => setTermsAccepted(e.target.checked)}
            className="w-4 h-4 mt-0.5 rounded border-[var(--border-hover)] bg-[var(--glass-bg)] text-[var(--text-primary)] focus:ring-[var(--border-hover)] focus:ring-offset-0"
          />
          <label htmlFor="terms" className="text-sm text-[var(--text-muted)]">
            I agree to the{' '}
            <Link href="/terms" className="text-[var(--text-primary)] hover:text-[var(--text-secondary)] transition-colors">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link href="/privacy" className="text-[var(--text-primary)] hover:text-[var(--text-secondary)] transition-colors">
              Privacy Policy
            </Link>
          </label>
        </div>
        <FieldError message={errors.terms} />

        <button
          id="register-submit-btn"
          type="submit"
          disabled={loading}
          className="w-full mt-6 bg-[var(--text-primary)] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-[var(--bg-primary)] rounded-xl py-2.5 font-medium shadow-[0_0_20px_rgba(255,255,255,0.06)] transition-all duration-200 flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Creating account...
            </>
          ) : (
            'Create Account'
          )}
        </button>
      </form>

      <p className="text-center text-sm text-[var(--text-muted)] mt-6">
        Already have an account?{' '}
        <Link href="/login" className="text-[var(--text-primary)] hover:text-[var(--text-secondary)] font-medium transition-colors">
          Sign in
        </Link>
      </p>
    </motion.div>
  );
}