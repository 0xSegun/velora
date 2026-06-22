"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown, Loader2, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { CountryFlag, CurrencyBadge } from "@/components/ui/CountryFlag";
import {
  type CountryOption,
  filterCountryOptions,
} from "@/lib/countryOptions";

export default function CountrySelect({
  countries,
  value,
  onChange,
  loading = false,
  disabled = false,
  placeholder = "Select country",
  className,
}: {
  countries: CountryOption[];
  value: string;
  onChange: (code: string) => void;
  loading?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selected = useMemo(
    () => countries.find((c) => c.code === value) ?? null,
    [countries, value],
  );

  const filtered = useMemo(
    () => filterCountryOptions(countries, search),
    [countries, search],
  );

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  return (
    <div ref={rootRef} className={cn("relative min-w-[220px]", className)}>
      <button
        type="button"
        disabled={disabled || loading}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-xl border border-[var(--border-primary)]",
          "bg-[var(--glass-bg)] px-3 py-2.5 text-left text-sm text-[var(--text-primary)]",
          "transition hover:border-[var(--border-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30",
          (disabled || loading) && "cursor-not-allowed opacity-60",
        )}
      >
        <span className="flex min-w-0 items-center gap-2.5">
          {loading ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[var(--text-muted)]" />
          ) : (
            <CountryFlag
              code={selected?.code ?? value}
              size="sm"
              title={selected?.name}
            />
          )}
          <span className="flex min-w-0 items-center gap-2 truncate">
            {selected ? (
              <>
                <span className="truncate">{selected.name}</span>
                {selected.currency ? (
                  <CurrencyBadge
                    currencyCode={selected.currency}
                    countryCode={selected.code}
                    flagSize="xs"
                  />
                ) : null}
              </>
            ) : (
              placeholder
            )}
          </span>
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-[var(--text-muted)] transition",
            open && "rotate-180",
          )}
        />
      </button>

      {open && !loading && (
        <div
          className={cn(
            "absolute left-0 right-0 z-50 mt-2 overflow-hidden rounded-xl border border-[var(--border-primary)]",
            "bg-[var(--bg-primary)] shadow-2xl",
          )}
        >
          <div className="border-b border-[var(--border-primary)] p-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search countries..."
                autoFocus
                className="w-full rounded-lg border border-[var(--border-primary)] bg-[var(--glass-bg)] py-2 pl-8 pr-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/40"
              />
            </div>
            <p className="mt-1.5 px-1 text-[10px] text-[var(--text-muted)]">
              {countries.length} countries available
            </p>
          </div>

          <ul
            id={listboxId}
            role="listbox"
            className="max-h-64 overflow-y-auto py-1"
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-4 text-center text-sm text-[var(--text-muted)]">
                No countries match your search
              </li>
            ) : (
              filtered.map((country) => {
                const isSelected = country.code === value;
                return (
                  <li key={country.code} role="option" aria-selected={isSelected}>
                    <button
                      type="button"
                      onClick={() => {
                        onChange(country.code);
                        setOpen(false);
                        setSearch("");
                      }}
                      className={cn(
                        "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition",
                        isSelected
                          ? "bg-[var(--accent-faint)] text-[var(--text-primary)]"
                          : "text-[var(--text-secondary)] hover:bg-[var(--glass-bg-hover)]",
                      )}
                    >
                      <CountryFlag
                        code={country.code}
                        size="sm"
                        title={country.name}
                      />
                      <span className="min-w-0 flex-1 truncate">{country.name}</span>
                      {country.currency ? (
                        <CurrencyBadge
                          currencyCode={country.currency}
                          countryCode={country.code}
                          flagSize="xs"
                        />
                      ) : null}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}