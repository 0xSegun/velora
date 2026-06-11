import {
  DEFAULT_PUBLIC_SETTINGS,
  type PublicSettings,
  deepMergeSettings,
} from "@/lib/siteSettings";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function getPublicSettings(): Promise<PublicSettings> {
  try {
    const res = await fetch(`${API_URL}/api/public/settings`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return DEFAULT_PUBLIC_SETTINGS;
    const data = (await res.json()) as Record<string, unknown>;
    return deepMergeSettings(
      DEFAULT_PUBLIC_SETTINGS as unknown as Record<string, unknown>,
      data,
    ) as unknown as PublicSettings;
  } catch {
    return DEFAULT_PUBLIC_SETTINGS;
  }
}