"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Globe, RotateCcw } from "lucide-react";
import CountrySelect from "@/components/ui/CountrySelect";
import { countriesAPI } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import {
  resolveCountryCode,
  useCountryContextStore,
} from "@/store/countryContextStore";
import { buildCountryOptions, type CountryOption } from "@/lib/countryOptions";

interface CountryFocusBarProps {
  label?: string;
  className?: string;
}

export default function CountryFocusBar({
  label = "Focus country",
  className = "",
}: CountryFocusBarProps) {
  const homeCountry = useAuthStore((s) => s.user?.country ?? "NG");
  const activeCountry = useCountryContextStore((s) => s.activeCountry);
  const setActiveCountry = useCountryContextStore((s) => s.setActiveCountry);
  const resetToHome = useCountryContextStore((s) => s.resetToHome);
  const recentCountries = useCountryContextStore((s) => s.recentCountries);

  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [loading, setLoading] = useState(true);

  const resolved = resolveCountryCode(activeCountry, homeCountry);
  const isOverride = resolved !== homeCountry.toUpperCase();

  useEffect(() => {
    countriesAPI
      .getCatalog()
      .then(({ data }) => {
        const catalogCountries = (data.countries ?? []).map((c) => ({
          id: c.code,
          name: c.name,
          code: c.code,
          flag: c.flag,
          flag_url: c.flag_url,
          region: c.region ?? null,
          continent: c.continent ?? null,
          currency: c.currency ?? null,
          inflation_rate: 0,
          deflation_risk: 0,
          gdp: 0,
          interest_rate: 0,
          economic_stability_score: 0,
          currency_strength: 0,
          updated_at: new Date().toISOString(),
        }));
        setCountries(buildCountryOptions(catalogCountries));
      })
      .catch(() => setCountries(buildCountryOptions()))
      .finally(() => setLoading(false));
  }, []);

  const sortedCountries = useMemo(() => {
    if (!countries.length) return countries;
    const recentSet = new Set(recentCountries);
    const recent = countries.filter((c) => recentSet.has(c.code));
    const rest = countries.filter((c) => !recentSet.has(c.code));
    return [...recent, ...rest];
  }, [countries, recentCountries]);

  const handleChange = useCallback(
    (code: string) => setActiveCountry(code, homeCountry),
    [homeCountry, setActiveCountry],
  );

  return (
    <div
      className={`flex flex-wrap items-center gap-3 rounded-xl border border-[var(--border-primary)] bg-[var(--glass-bg)] px-4 py-3 ${className}`}
    >
      <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
        <Globe className="h-4 w-4" />
        <span>{label}</span>
      </div>
      <CountrySelect
        countries={sortedCountries}
        value={resolved}
        onChange={handleChange}
        loading={loading}
        className="min-w-[240px] flex-1"
      />
      {isOverride && (
        <button
          type="button"
          onClick={() => resetToHome(homeCountry)}
          className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs text-[var(--text-muted)] transition hover:text-[var(--text-primary)]"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset to home
        </button>
      )}
    </div>
  );
}

export function useActiveCountryCode(): string {
  const home = useAuthStore((s) => s.user?.country ?? "NG");
  const active = useCountryContextStore((s) => s.activeCountry);
  return resolveCountryCode(active, home);
}

export { useResolvedCountry } from "@/hooks/useResolvedCountry";