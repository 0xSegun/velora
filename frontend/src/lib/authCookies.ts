const SESSION_COOKIE = "ic_session";
const ROLE_COOKIE = "ic_role";
const MAX_AGE = 60 * 60 * 24 * 7;

export function setAuthCookies(role: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${SESSION_COOKIE}=1; path=/; max-age=${MAX_AGE}; SameSite=Lax`;
  document.cookie = `${ROLE_COOKIE}=${role}; path=/; max-age=${MAX_AGE}; SameSite=Lax`;
}

export function clearAuthCookies() {
  if (typeof document === "undefined") return;
  document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0`;
  document.cookie = `${ROLE_COOKIE}=; path=/; max-age=0`;
}