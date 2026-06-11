import { useToastStore, type ToastType } from "@/store/toastStore";
import { getFirstName } from "@/lib/greeting";

const DEFAULT_DURATION = 5000;

export const MESSAGES = {
  auth: {
    registerSuccess:
      "Account created successfully. Check your email to verify your account, then sign in.",
    forgotPasswordSent:
      "If your email is registered, a reset link has been sent to",
    loginSuccess: (firstName: string) => `Welcome back, ${firstName}.`,
    loginFailed: "Invalid email or password.",
    notVerified: "Please verify your email address before signing in.",
    accountLocked: "Your account has been temporarily locked. Please contact support.",
    accountDeactivated: "Your account has been deactivated. Please contact support.",
    logoutSuccess: "You have been logged out successfully.",
    accessDenied: "Access denied. Administrator privileges required.",
    loginRequired: "Please log in to continue.",
  },
  validation: {
    required: "This field is required.",
    invalidEmail: "Please enter a valid email address.",
    weakPassword:
      "Password should contain uppercase, lowercase, numbers, and symbols.",
    passwordMismatch: "Passwords do not match.",
  },
  dataset: {
    uploadSuccess: "Dataset uploaded successfully.",
    invalidFormat:
      "Unsupported file format. Please upload Excel, CSV, or JSON.",
    duplicate: "A dataset with this name already exists.",
    uploadFailed: "Dataset upload failed. Please try again.",
    empty: "No datasets uploaded.",
  },
  training: {
    started: "Model training has started.",
    completed: "TS-Transformer model training completed successfully.",
    failed: "Model training failed. Check logs for details.",
    interrupted: "Training process stopped.",
    deployed: "Model deployed successfully.",
    empty: "No training sessions found.",
  },
  reports: {
    generated: "Report generated successfully.",
    pdfStarted: "PDF download started.",
    pdfFailed: "Unable to generate PDF.",
    empty: "No reports available.",
    noData: "No reports available at this time.",
  },
  predictions: {
    generated: "Prediction generated successfully.",
    failed: "Unable to generate prediction.",
    noData: "No prediction data available.",
    saved: "Prediction saved successfully.",
    empty: "No predictions available yet.",
  },
  profile: {
    updated: "Profile updated successfully.",
    passwordChanged: "Password changed successfully.",
    invalidPassword: "Current password is incorrect.",
    updateFailed: "Unable to update profile.",
  },
  admin: {
    settingsSaved: "Settings saved successfully.",
    apiAdded: "API configuration added successfully.",
    apiUpdated: "API configuration updated successfully.",
    apiDeleted: "API configuration deleted successfully.",
    apiConnectionFailed: "Unable to connect to the API.",
    apiWarning: "API response time is unusually high.",
  },
  network: {
    serverOffline: "Server connection lost.",
    timeout: "Request timed out. Please try again.",
    database: "Unable to retrieve data.",
    offline: "Please check your internet connection.",
    generic: "Something went wrong. Please try again.",
  },
  notifications: {
    empty: "No notifications available.",
  },
  delete: {
    title: "Confirm Deletion",
    message: "This action cannot be undone.",
  },
} as const;

function show(type: ToastType, message: string, duration = DEFAULT_DURATION) {
  return useToastStore.getState().addToast({ type, message, duration });
}

export const toast = {
  success: (message: string, duration?: number) =>
    show("success", message, duration),
  error: (message: string, duration?: number) =>
    show("error", message, duration),
  warning: (message: string, duration?: number) =>
    show("warning", message, duration),
  info: (message: string, duration?: number) => show("info", message, duration),
};

export function toastWelcomeBack(fullName?: string | null) {
  toast.success(MESSAGES.auth.loginSuccess(getFirstName(fullName)));
}