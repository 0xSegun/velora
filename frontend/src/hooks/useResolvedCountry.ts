"use client";

import { useAuthStore } from "@/store/authStore";
import {
  resolveCountryCode,
  useCountryContextStore,
} from "@/store/countryContextStore";

/** Profile home country with optional session override for analysis views. */
export function useResolvedCountry(fallback = "NG") {
  const homeCountry = useAuthStore((s) => s.user?.country ?? fallback);
  const activeCountry = useCountryContextStore((s) => s.activeCountry);
  const countryCode = resolveCountryCode(activeCountry, homeCountry, fallback);
  const home = homeCountry.toUpperCase();
  return {
    countryCode,
    homeCountry: home,
    isOverride: countryCode !== home,
  };
}