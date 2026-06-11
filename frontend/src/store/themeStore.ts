import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ThemeState {
  theme: "dark" | "light";
  hasHydrated: boolean;
  toggleTheme: () => void;
  setTheme: (theme: "dark" | "light") => void;
  setHasHydrated: (hasHydrated: boolean) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: "dark",
      hasHydrated: false,
      toggleTheme: () =>
        set((state) => {
          const next = state.theme === "dark" ? "light" : "dark";
          applyTheme(next);
          return { theme: next };
        }),
      setTheme: (theme) => {
        applyTheme(theme);
        set({ theme });
      },
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
    }),
    {
      name: "velora-theme",
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
        if (state?.theme) applyTheme(state.theme);
      },
    },
  ),
);

function applyTheme(theme: "dark" | "light") {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.add("theme-transition");
  root.classList.remove("dark", "light");
  root.classList.add(theme);
  // Remove transition class after animation completes
  setTimeout(() => root.classList.remove("theme-transition"), 350);
}

function readStoredTheme(): string | null {
  let stored = localStorage.getItem("velora-theme");
  if (!stored) {
    const legacy = localStorage.getItem("infinicast-theme");
    if (legacy) {
      localStorage.setItem("velora-theme", legacy);
      localStorage.removeItem("infinicast-theme");
      stored = legacy;
    }
  }
  return stored;
}

// Initialize theme on import (client-side only)
if (typeof window !== "undefined") {
  const stored = readStoredTheme();
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (parsed?.state?.theme) {
        applyTheme(parsed.state.theme);
      }
    } catch {
      applyTheme("dark");
    }
  } else {
    applyTheme("dark");
  }
}
