const DEFAULT_API_URL = "http://localhost:8000";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.trim() || DEFAULT_API_URL;

export function isLocalApiUrl(url: string = API_URL): boolean {
  try {
    const host = new URL(url).hostname;
    return host === "localhost" || host === "127.0.0.1";
  } catch {
    return false;
  }
}