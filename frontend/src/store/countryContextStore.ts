import { create } from "zustand";
import { persist } from "zustand/middleware";

const STORAGE_KEY = "velora_active_country";
const RECENT_KEY = "velora_recent_countries";

function loadRecent(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function saveRecent(codes: string[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(RECENT_KEY, JSON.stringify(codes.slice(0, 8)));
}

interface CountryContextState {
  /** Temporary viewing country (does not change user profile). */
  activeCountry: string | null;
  recentCountries: string[];
  setActiveCountry: (code: string, homeCountry?: string) => void;
  resetToHome: (homeCountry: string) => void;
  clearActive: () => void;
}

export const useCountryContextStore = create<CountryContextState>()(
  persist(
    (set, get) => ({
      activeCountry: null,
      recentCountries: loadRecent(),
      setActiveCountry: (code, homeCountry) => {
        const normalized = code.toUpperCase();
        const prev = get().recentCountries.filter((c) => c !== normalized);
        const recent = [normalized, ...prev].slice(0, 8);
        if (homeCountry && normalized !== homeCountry.toUpperCase()) {
          saveRecent(recent);
        }
        set({ activeCountry: normalized, recentCountries: recent });
      },
      resetToHome: (homeCountry) => {
        set({ activeCountry: homeCountry.toUpperCase() });
      },
      clearActive: () => set({ activeCountry: null }),
    }),
    {
      name: STORAGE_KEY,
      partialize: (s) => ({ activeCountry: s.activeCountry }),
    },
  ),
);

/** Resolved country for API calls: active override or profile default. */
export function resolveCountryCode(
  activeCountry: string | null | undefined,
  profileCountry: string | null | undefined,
  fallback = "NG",
): string {
  return (activeCountry || profileCountry || fallback).toUpperCase();
}