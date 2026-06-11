import { MESSAGES } from "@/lib/feedback";

export type FieldErrors = Record<string, string>;

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function isStrongPassword(password: string): boolean {
  return (
    password.length >= 8 &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}

export function validateRequired(
  fields: Record<string, string>,
  labels?: Record<string, string>,
): FieldErrors {
  const errors: FieldErrors = {};
  for (const [key, value] of Object.entries(fields)) {
    if (!value?.trim()) {
      errors[key] = labels?.[key]
        ? `${labels[key]} is required`
        : MESSAGES.validation.required;
    }
  }
  return errors;
}

export function validateEmailField(email: string): string | null {
  if (!email.trim()) return MESSAGES.validation.required;
  if (!isValidEmail(email)) return MESSAGES.validation.invalidEmail;
  return null;
}

export function validatePasswordField(password: string): string | null {
  if (!password) return MESSAGES.validation.required;
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (!/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    return MESSAGES.validation.weakPassword;
  }
  return null;
}

export function validatePasswordMatch(
  password: string,
  confirm: string,
): string | null {
  if (password !== confirm) return MESSAGES.validation.passwordMismatch;
  return null;
}