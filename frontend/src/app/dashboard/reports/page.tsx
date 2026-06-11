"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  FileText,
  Calendar,
  Globe,
  Filter,
  Search,
  Eye,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { reportsAPI } from "@/lib/api";
import { handleApiError } from "@/lib/errorHandler";
import { MESSAGES } from "@/lib/feedback";
import type { Report } from "@/types/report";
import { formatDate } from "@/lib/dates";
import { CountryLabel } from "@/components/ui/CountryFlag";
import EmptyState from "@/components/ui/EmptyState";

const CATEGORY_FILTERS = [
  "all",
  "monthly",
  "quarterly",
  "annual",
  "custom",
  "system",
  "historical",
] as const;

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const filteredReports = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return reports;
    return reports.filter(
      (report) =>
        report.title.toLowerCase().includes(q) ||
        report.summary?.toLowerCase().includes(q) ||
        report.source.toLowerCase().includes(q) ||
        report.report_type.toLowerCase().includes(q) ||
        report.country_code?.toLowerCase().includes(q),
    );
  }, [reports, search]);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params =
        filter !== "all" ? { report_type: filter, per_page: 100 } : { per_page: 100 };
      const { data } = await reportsAPI.list(params);
      setReports(data.reports ?? []);
    } catch (err) {
      const message = handleApiError(
        err,
        "Reports",
        MESSAGES.network.database,
        false,
      );
      setError(message);
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void fetchReports();
  }, [fetchReports]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--text-muted)]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <EmptyState
          icon={AlertCircle}
          title="Failed to load reports"
          description={error}
          action={
            <button
              onClick={() => void fetchReports()}
              className="rounded-xl border border-[var(--border-active)] bg-[var(--accent-faint)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition hover:bg-[var(--glass-bg-hover)]"
            >
              Retry
            </button>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Reports</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Economic reports and analysis documents
        </p>
      </motion.div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search reports..."
            className="app-input w-full rounded-xl py-2 pl-10 pr-4 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-faint)]"
          />
        </div>
        {search && (
          <p className="text-xs text-[var(--text-muted)]">
            {filteredReports.length} result{filteredReports.length === 1 ? "" : "s"}
          </p>
        )}
      </div>

      {/* Category filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Filter className="h-4 w-4 text-[var(--text-muted)]" />
        {CATEGORY_FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition ${
              filter === f
                ? "border border-[var(--border-active)] bg-[var(--accent-faint)] text-[var(--text-primary)]"
                : "border border-[var(--border-hover)] bg-[var(--accent-faint)] text-[var(--text-muted)] hover:bg-[var(--glass-bg-hover)]"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {filteredReports.length === 0 ? (
        <EmptyState
          variant="warning"
          title={search ? "No matching reports" : MESSAGES.reports.empty}
          description={
            search
              ? "Try a different search term or clear the search box."
              : filter === "all"
                ? "Reports will appear here once they are synced or published."
                : `No ${filter} reports available. Try a different category.`
          }
        />
      ) : (
        <div className="space-y-3">
          {filteredReports.map((report, i) => (
            <motion.div
              key={report.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
            >
              <Link
                href={`/dashboard/reports/${report.id}`}
                className="group block glass-card rounded-xl hover:transform-none p-5 transition hover:border-[var(--border-active)] hover:bg-[var(--glass-bg-hover)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 flex-1 items-start gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-faint)]">
                      <FileText className="h-5 w-5 text-[var(--text-primary)]" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-[var(--text-primary)] transition group-hover:text-[var(--text-primary)]">
                        {report.title}
                      </h3>
                      {report.summary && (
                        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[var(--text-muted)]">
                          {report.summary}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-3">
                        {report.country_code ? (
                          <CountryLabel
                            code={report.country_code}
                            flagSize="xs"
                            className="text-xs text-[var(--text-muted)]"
                          />
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
                            <Globe className="h-3 w-3" />
                            Global
                          </span>
                        )}
                        <span className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
                          <Calendar className="h-3 w-3" />
                          {formatDate(report.published_at)}
                        </span>
                        <span className="text-xs text-[var(--text-muted)]">
                          {report.source}
                        </span>
                        <span className="rounded-full bg-[var(--accent-faint)] px-2 py-0.5 text-xs capitalize text-[var(--text-muted)]">
                          {report.report_type}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 text-[var(--text-faint)] transition group-hover:text-[var(--text-primary)]">
                    <Eye className="h-4 w-4" />
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}