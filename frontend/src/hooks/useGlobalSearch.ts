"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { searchAPI } from "@/lib/api";
import { fallbackSearch } from "@/lib/searchFallback";
import {
  ADMIN_NAV_ITEMS,
  DASHBOARD_NAV_ITEMS,
  mergeSearchGroups,
  searchNavItems,
} from "@/lib/searchNav";
import type { SearchGroup } from "@/types/search";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

interface UseGlobalSearchOptions {
  scope: "dashboard" | "admin";
  limit?: number;
  minLength?: number;
}

export function useGlobalSearch({
  scope,
  limit = 5,
  minLength = 2,
}: UseGlobalSearchOptions) {
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState<SearchGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debouncedQuery = useDebouncedValue(query, 280);

  const navItems = scope === "admin" ? ADMIN_NAV_ITEMS : DASHBOARD_NAV_ITEMS;

  const pageResults = useMemo(
    () => searchNavItems(debouncedQuery, navItems, limit),
    [debouncedQuery, navItems, limit],
  );

  const runSearch = useCallback(async () => {
    const q = debouncedQuery.trim();
    if (q.length < minLength) {
      setGroups([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { data } = await searchAPI.query(q, limit);
      setGroups(mergeSearchGroups(data.groups ?? [], pageResults));
    } catch {
      try {
        const fallbackGroups = await fallbackSearch(q, limit);
        const merged = mergeSearchGroups(fallbackGroups, pageResults);
        setGroups(merged);
        setError(merged.length === 0 ? "Search is temporarily unavailable." : null);
      } catch {
        const pageOnly =
          pageResults.length > 0
            ? [{ type: "page" as const, label: "Pages", results: pageResults }]
            : [];
        setGroups(pageOnly);
        setError(
          pageOnly.length === 0 ? "Search is temporarily unavailable." : null,
        );
      }
    } finally {
      setLoading(false);
    }
  }, [debouncedQuery, limit, minLength, pageResults]);

  useEffect(() => {
    void runSearch();
  }, [runSearch]);

  const flatResults = useMemo(
    () => groups.flatMap((group) => group.results),
    [groups],
  );

  const total = useMemo(
    () => groups.reduce((sum, group) => sum + group.results.length, 0),
    [groups],
  );

  const clear = useCallback(() => {
    setQuery("");
    setGroups([]);
    setError(null);
    setLoading(false);
  }, []);

  return {
    query,
    setQuery,
    groups,
    flatResults,
    total,
    loading,
    error,
    isOpen: query.trim().length >= minLength,
    clear,
  };
}