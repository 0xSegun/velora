import { AxiosError } from "axios";
import { MESSAGES, toast } from "@/lib/feedback";

type ErrorDetail = string | { msg?: string }[] | Record<string, unknown>;

function cleanValidationMessage(message: string): string {
  return message.replace(/^Value error,\s*/i, "").trim();
}

function extractDetail(detail: unknown): string | null {
  if (typeof detail === "string") return cleanValidationMessage(detail);
  if (Array.isArray(detail)) {
    const msgs = detail
      .map((item) =>
        item && typeof item === "object" && "msg" in item
          ? cleanValidationMessage(String((item as { msg?: string }).msg ?? ""))
          : "",
      )
      .filter(Boolean);
    return msgs.length ? msgs.join(". ") : null;
  }
  return null;
}

export function logError(context: string, error: unknown) {
  if (process.env.NODE_ENV !== "production") {
    console.error(`[Velora] ${context}`, error);
  }
}

export function parseApiError(
  error: unknown,
  fallback: string = MESSAGES.network.generic,
): string {
  if (!error || typeof error !== "object") return fallback;

  const axiosErr = error as AxiosError<{ detail?: ErrorDetail }>;

  if (!axiosErr.response) {
    if (axiosErr.code === "ECONNABORTED") return MESSAGES.network.timeout;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      return MESSAGES.network.offline;
    }
    return MESSAGES.network.serverOffline;
  }

  const status = axiosErr.response.status;
  const detail = extractDetail(axiosErr.response.data?.detail);

  if (status === 401) return MESSAGES.auth.loginFailed;
  if (status === 403) {
    if (detail?.toLowerCase().includes("deactivated")) {
      return MESSAGES.auth.accountDeactivated;
    }
    if (detail?.toLowerCase().includes("administrator")) {
      return MESSAGES.auth.accessDenied;
    }
    return detail ?? MESSAGES.auth.accessDenied;
  }
  if (status === 404) return detail ?? "The requested resource was not found.";
  if (status === 409) return detail ?? "This resource already exists.";
  if (status === 422) return detail ?? "Please check your input and try again.";
  if (status === 502) {
    return detail ?? "The email service API is unreachable. Check your API key and try again.";
  }
  if (status >= 500) return detail ?? MESSAGES.network.database;

  return detail ?? fallback;
}

export function handleApiError(
  error: unknown,
  context: string,
  fallback?: string,
  showToast = true,
): string {
  logError(context, error);
  const message = parseApiError(error, fallback);
  if (showToast) toast.error(message);
  return message;
}

export function parseLoginError(error: unknown): {
  message: string;
  type: "error" | "warning";
} {
  const axiosErr = error as AxiosError<{ detail?: string }>;
  const detail = axiosErr.response?.data?.detail ?? "";
  const status = axiosErr.response?.status;

  if (!axiosErr.response) {
    if (axiosErr.code === "ECONNABORTED") {
      return { message: MESSAGES.network.timeout, type: "error" };
    }
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      return { message: MESSAGES.network.offline, type: "error" };
    }
    return { message: MESSAGES.network.serverOffline, type: "error" };
  }

  if (status === 403) {
    const lower = detail.toLowerCase();
    if (lower.includes("verify") || lower.includes("verified")) {
      return { message: MESSAGES.auth.notVerified, type: "warning" };
    }
    if (lower.includes("locked") || lower.includes("deactivated")) {
      return {
        message: lower.includes("locked")
          ? MESSAGES.auth.accountLocked
          : MESSAGES.auth.accountDeactivated,
        type: "error",
      };
    }
  }

  return { message: MESSAGES.auth.loginFailed, type: "error" };
}