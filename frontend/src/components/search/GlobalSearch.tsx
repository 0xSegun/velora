"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  FileText,
  Globe,
  Brain,
  BookOpen,
  LayoutDashboard,
  Users,
  Plug,
  Loader2,
  Search,
  X,
} from "lucide-react";
import { useGlobalSearch } from "@/hooks/useGlobalSearch";
import { CountryFlag } from "@/components/ui/CountryFlag";
import type { SearchResultType } from "@/types/search";

const TYPE_ICONS: Record<SearchResultType, React.ElementType> = {
  page: LayoutDashboard,
  country: Globe,
  report: FileText,
  prediction: Brain,
  research: BookOpen,
  user: Users,
  api_config: Plug,
};

import type { UserRole } from "@/lib/roles";

interface GlobalSearchProps {
  scope: "dashboard" | "admin" | "analyst";
  role?: UserRole | null;
  id?: string;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  compact?: boolean;
}

export default function GlobalSearch({
  scope,
  role,
  id,
  placeholder,
  className = "",
  inputClassName = "",
  compact = false,
}: GlobalSearchProps) {
  const listboxId = useId();
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const {
    query,
    setQuery,
    groups,
    flatResults,
    total,
    loading,
    error,
    isOpen,
    clear,
  } = useGlobalSearch({ scope, role });

  const showPanel = focused && isOpen;
  const defaultPlaceholder =
    scope === "admin"
      ? "Search admin, users, APIs..."
      : scope === "analyst"
        ? "Search analytics, research, models..."
        : "Search forecasts, news, help...";

  useEffect(() => {
    setActiveIndex(-1);
  }, [query, groups]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setFocused(false);
        setActiveIndex(-1);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const navigateTo = useCallback(
    (href: string) => {
      clear();
      setFocused(false);
      setActiveIndex(-1);
      router.push(href);
    },
    [clear, router],
  );

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showPanel) {
      if (event.key === "ArrowDown" && flatResults.length > 0) {
        setFocused(true);
        setActiveIndex(0);
        event.preventDefault();
      }
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((prev) =>
        prev < flatResults.length - 1 ? prev + 1 : 0,
      );
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((prev) =>
        prev > 0 ? prev - 1 : flatResults.length - 1,
      );
    } else if (event.key === "Enter") {
      event.preventDefault();
      const target =
        activeIndex >= 0 ? flatResults[activeIndex] : flatResults[0];
      if (target) navigateTo(target.href);
    } else if (event.key === "Escape") {
      event.preventDefault();
      clear();
      setFocused(false);
      inputRef.current?.blur();
    }
  };

  let resultOffset = 0;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-faint)]" />
        <input
          ref={inputRef}
          id={id}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder ?? defaultPlaceholder}
          role="combobox"
          aria-expanded={showPanel}
          aria-controls={listboxId}
          aria-autocomplete="list"
          autoComplete="off"
          className={`
            app-input w-full rounded-xl pl-10 pr-10 text-sm text-[var(--text-primary)]
            placeholder:text-[var(--text-faint)] focus:ring-0
            ${compact ? "py-1.5" : "py-2"}
            ${inputClassName}
          `}
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              clear();
              inputRef.current?.focus();
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-[var(--text-muted)] hover:bg-[var(--accent-faint)] hover:text-[var(--text-primary)]"
            aria-label="Clear search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <AnimatePresence>
        {showPanel && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.15 }}
            className="glass-panel absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 max-h-[min(24rem,70vh)] overflow-y-auto rounded-xl shadow-2xl"
          >
            <div
              id={listboxId}
              role="listbox"
              aria-label="Search results"
              className="p-2"
            >
              {loading && (
                <div className="flex items-center gap-2 px-3 py-4 text-sm text-[var(--text-muted)]">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Searching...
                </div>
              )}

              {!loading && error && (
                <p className="px-3 py-3 text-sm text-[var(--text-muted)]">
                  {error}
                </p>
              )}

              {!loading && total === 0 && !error && (
                <p className="px-3 py-4 text-sm text-[var(--text-muted)]">
                  No results for &ldquo;{query.trim()}&rdquo;
                </p>
              )}

              {!loading &&
                groups.map((group) => {
                  const groupStart = resultOffset;
                  resultOffset += group.results.length;
                  return (
                    <div key={group.type} className="mb-1 last:mb-0">
                      <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-faint)]">
                        {group.label}
                      </p>
                      <ul>
                        {group.results.map((item, index) => {
                          const flatIndex = groupStart + index;
                          const Icon = TYPE_ICONS[item.type] ?? Search;
                          const isActive = flatIndex === activeIndex;
                          const countryCode =
                            item.type === "country" && item.subtitle
                              ? item.subtitle.toUpperCase()
                              : null;
                          return (
                            <li key={`${item.type}-${item.id}`}>
                              <Link
                                href={item.href}
                                role="option"
                                aria-selected={isActive}
                                onMouseEnter={() => setActiveIndex(flatIndex)}
                                onClick={(e) => {
                                  e.preventDefault();
                                  navigateTo(item.href);
                                }}
                                className={`flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors ${
                                  isActive
                                    ? "bg-[var(--accent-faint)] text-[var(--text-primary)]"
                                    : "text-[var(--text-secondary)] hover:bg-[var(--accent-faint)] hover:text-[var(--text-primary)]"
                                }`}
                              >
                                {item.type === "country" && countryCode ? (
                                  <CountryFlag
                                    code={countryCode}
                                    size="sm"
                                    className="mt-0.5 shrink-0"
                                  />
                                ) : (
                                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-muted)]" />
                                )}
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-sm font-medium">
                                    {item.title}
                                  </span>
                                  {(item.subtitle || item.meta) && (
                                    <span className="mt-0.5 block truncate text-xs text-[var(--text-muted)]">
                                      {[item.subtitle, item.meta]
                                        .filter(Boolean)
                                        .join(" · ")}
                                    </span>
                                  )}
                                </span>
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}