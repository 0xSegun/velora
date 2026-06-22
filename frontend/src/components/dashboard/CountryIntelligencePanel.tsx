"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Landmark, Globe2, BarChart3, BookOpen } from "lucide-react";
import { intelligenceAPI, type CountryContextResponse } from "@/lib/api";
import { useActiveCountryCode } from "@/components/dashboard/CountryFocusBar";
import { CountryLabel } from "@/components/ui/CountryFlag";
import { formatDateTime } from "@/lib/dates";

type MacroSnapshot = {
  label: string;
  icon: typeof Landmark;
  inflation_pct?: number | null;
  gdp_growth_pct?: number | null;
  unemployment_pct?: number | null;
  government_debt_pct_gdp?: number | null;
  data_year?: number | null;
  retrieved_at?: string | null;
  available: boolean;
};

function formatPct(value?: number | null) {
  return value != null ? `${value.toFixed(1)}%` : "—";
}

function MacroCard({ snapshot }: { snapshot: MacroSnapshot }) {
  const Icon = snapshot.icon;
  return (
    <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--glass-bg)] p-4">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4 text-[var(--accent)]" />
        <p className="text-xs font-semibold text-[var(--text-primary)]">{snapshot.label}</p>
      </div>
      {!snapshot.available ? (
        <p className="text-xs text-[var(--text-muted)]">Not synced yet</p>
      ) : (
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <p className="text-[var(--text-faint)]">Inflation</p>
            <p className="text-[var(--text-primary)]">{formatPct(snapshot.inflation_pct)}</p>
          </div>
          <div>
            <p className="text-[var(--text-faint)]">GDP growth</p>
            <p className="text-[var(--text-primary)]">{formatPct(snapshot.gdp_growth_pct)}</p>
          </div>
          <div>
            <p className="text-[var(--text-faint)]">Unemployment</p>
            <p className="text-[var(--text-primary)]">{formatPct(snapshot.unemployment_pct)}</p>
          </div>
          <div>
            <p className="text-[var(--text-faint)]">Public debt</p>
            <p className="text-[var(--text-primary)]">{formatPct(snapshot.government_debt_pct_gdp)}</p>
          </div>
        </div>
      )}
      {snapshot.available && (
        <p className="mt-2 text-[10px] text-[var(--text-faint)]">
          {snapshot.data_year ? `Data year ${snapshot.data_year}` : "Latest"}
          {snapshot.retrieved_at ? ` · ${formatDateTime(snapshot.retrieved_at)}` : ""}
        </p>
      )}
    </div>
  );
}

export default function CountryIntelligencePanel() {
  const activeCountry = useActiveCountryCode();
  const [context, setContext] = useState<CountryContextResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await intelligenceAPI.getCountryContext(activeCountry);
      setContext(data);
    } catch {
      setContext(null);
    } finally {
      setLoading(false);
    }
  }, [activeCountry]);

  useEffect(() => {
    void load();
  }, [load]);

  const snapshots: MacroSnapshot[] = [
    {
      label: "IMF",
      icon: Landmark,
      available: Boolean(context?.imf),
      inflation_pct: context?.imf?.inflation_pct,
      gdp_growth_pct: context?.imf?.gdp_growth_pct,
      unemployment_pct: context?.imf?.unemployment_pct,
      government_debt_pct_gdp: context?.imf?.government_debt_pct_gdp,
      data_year: context?.imf?.data_year,
      retrieved_at: context?.imf?.retrieved_at,
    },
    {
      label: "World Bank",
      icon: Globe2,
      available: Boolean(context?.world_bank),
      inflation_pct: context?.world_bank?.inflation_pct,
      gdp_growth_pct: context?.world_bank?.gdp_growth_pct,
      unemployment_pct: context?.world_bank?.unemployment_pct,
      government_debt_pct_gdp: context?.world_bank?.government_debt_pct_gdp,
      data_year: context?.world_bank?.data_year,
      retrieved_at: context?.world_bank?.retrieved_at,
    },
    {
      label: "Trading Economics",
      icon: BarChart3,
      available: Boolean(context?.trading_economics),
      inflation_pct: context?.trading_economics?.inflation_pct,
      gdp_growth_pct: context?.trading_economics?.gdp_growth_pct,
      unemployment_pct: context?.trading_economics?.unemployment_pct,
      government_debt_pct_gdp: context?.trading_economics?.government_debt_pct_gdp,
      data_year: context?.trading_economics?.data_year,
      retrieved_at: context?.trading_economics?.retrieved_at,
    },
  ];

  return (
    <section className="glass-panel rounded-2xl p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-faint)]">
            Country intelligence
          </p>
          <div className="mt-1 flex items-center gap-2">
            <CountryLabel code={activeCountry} flagSize="sm" />
            <span className="text-sm text-[var(--text-muted)]">
              Macro data feeding forecasts and reports
            </span>
          </div>
        </div>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-[var(--text-muted)]" />}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {snapshots.map((s) => (
          <MacroCard key={s.label} snapshot={s} />
        ))}
      </div>

      {context?.wikipedia?.economy_summary && (
        <div className="mt-4 rounded-xl border border-[var(--border-primary)] bg-[var(--accent-faint)] p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-[var(--text-primary)]">
            <BookOpen className="h-3.5 w-3.5" />
            Wikipedia context
          </div>
          <p className="line-clamp-3 text-xs leading-relaxed text-[var(--text-muted)]">
            {context.wikipedia.economy_summary}
          </p>
        </div>
      )}
    </section>
  );
}