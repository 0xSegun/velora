import { authAPI } from "@/lib/api";
import { MESSAGES, toast } from "@/lib/feedback";
import { useAuthStore } from "@/store/authStore";

export async function performLogout(redirectTo = "/") {
  try {
    await authAPI.logout();
  } catch {
    // Allow local sign-out when the API is unreachable.
  }
  useAuthStore.getState().logout();
  toast.success(MESSAGES.auth.logoutSuccess);
  if (typeof window !== "undefined") {
    window.location.href = redirectTo;
  }
}