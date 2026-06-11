"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  FileText,
  Calendar,
  Globe,
  Download,
  Loader2,
  AlertCircle,
  ExternalLink,
  Tag,
  Printer,
} from "lucide-react";
import { reportsAPI } from "@/lib/api";
import CurrencyDisplay from "@/components/ui/CurrencyDisplay";

import { MESSAGES, toast } from "@/lib/feedback";
import type { Report } from "@/types/report";
import { formatDate, formatDateTime } from "@/lib/dates";
import { downloadReportPdf } from "@/lib/pdf";
import { printPage } from "@/lib/print";
import PrintDocumentHeader from "@/components/print/PrintDocumentHeader";
import { CountryLabel } from "@/components/ui/CountryFlag";
import EmptyState from "@/components/ui/EmptyState";

interface ReportSection {
  title: string;
  body: string;
}

export default function ReportDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";

  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const fetchReport = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await reportsAPI.getById(id);
      setReport(data);
    } catch {
      setError("Report not found or could not be loaded.");
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void fetchReport();
  }, [fetchReport]);

  const sections = useMemo((): ReportSection[] => {
    if (!report) return [];
    const raw = report.content?.sections;
    if (Array.isArray(raw) && raw.length > 0) {
      return raw.map((s) => ({
        title: String((s as ReportSection).title ?? "Section"),
        body: String((s as ReportSection).body ?? ""),
      }));
    }
    if (report.content?.body) {
      return [
        {
          title: "Report Content",
          body: String(report.content.body),
        },
      ];
    }
    return [];
  }, [report]);

  const references = useMemo((): string[] => {
    if (!report) return [];
    const fromContent = report.content?.references;
    if (Array.isArray(fromContent)) {
      return fromContent.map(String);
    }
    const fromMeta = report.metadata_extra?.references;
    if (Array.isArray(fromMeta)) {
      return fromMeta.map(String);
    }
    return [];
  }, [report]);

  const fxContext = useMemo(() => {
    const ctx = report?.metadata_extra?.exchange_rate_context as
      | {
          exchange_rate?: number | null;
          trend?: string;
          change_7d?: number | null;
          change_24h?: number | null;
          last_updated?: string | null;
          is_stale?: boolean;
          commentary?: string;
        }
      | undefined;
    return ctx ?? null;
  }, [report]);

  const metadataEntries = useMemo(() => {
    if (!report?.metadata_extra) return [];
    return Object.entries(report.metadata_extra).filter(
      ([key]) => key !== "references" && key !== "exchange_rate_context",
    );
  }, [report]);

  const handleDownload = async () => {
    if (!report) return;
    setDownloading(true);
    try {
      toast.success(MESSAGES.reports.pdfStarted);
      await downloadReportPdf(report);
    } catch {
      toast.error(MESSAGES.reports.pdfFailed);
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--text-muted)]" />
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <Link
          href="/dashboard/reports"
          className="inline-flex items-center gap-2 text-sm text-[var(--text-muted)] transition hover:text-[var(--text-primary)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to reports
        </Link>
        <EmptyState
          icon={AlertCircle}
          title="Report unavailable"
          description={error ?? "This report could not be found."}
          action={
            <button
              onClick={() => void fetchReport()}
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
    <div className="print-document mx-auto max-w-4xl space-y-6">
      <PrintDocumentHeader
        title={report.title}
        subtitle={`${report.report_type} · ${report.source} · Published ${formatDate(report.published_at)}`}
      />
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
      >
        <div>
          <Link
            href="/dashboard/reports"
            className="mb-3 inline-flex items-center gap-2 text-sm text-[var(--text-muted)] transition hover:text-[var(--text-primary)] print:hidden"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to reports
          </Link>
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-faint)]">
              <FileText className="h-6 w-6 text-[var(--text-primary)]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[var(--text-primary)]">
                {report.title}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-[var(--text-muted)]">
                {report.country_code ? (
                  <CountryLabel
                    code={report.country_code}
                    flagSize="xs"
                    className="text-xs text-[var(--text-muted)]"
                  />
                ) : (
                  <span className="flex items-center gap-1">
                    <Globe className="h-3 w-3" />
                    Global
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Published {formatDate(report.published_at)}
                </span>
                <span className="flex items-center gap-1">
                  <Tag className="h-3 w-3" />
                  {report.report_type}
                </span>
                <span>{report.source}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <button
            onClick={() => void handleDownload()}
            disabled={downloading}
            className="inline-flex items-center gap-2 self-start rounded-xl border border-[var(--border-active)] bg-[var(--accent-faint)] px-4 py-2.5 text-sm font-medium text-[var(--text-primary)] transition hover:bg-[var(--glass-bg-hover)] disabled:opacity-50"
          >
            {downloading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Download PDF
          </button>
          <button
            onClick={printPage}
            className="inline-flex items-center gap-2 self-start rounded-xl border border-[var(--border-active)] bg-[var(--accent-faint)] px-4 py-2.5 text-sm font-medium text-[var(--text-primary)] transition hover:bg-[var(--glass-bg-hover)]"
          >
            <Printer className="h-4 w-4" />
            Print
          </button>
        </div>
      </motion.div>

      {/* Summary */}
      {report.summary && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-xl hover:transform-none p-6"
        >
          <h2 className="mb-3 text-lg font-semibold text-[var(--text-primary)]">
            Executive Summary
          </h2>
          <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
            {report.summary}
          </p>
        </motion.div>
      )}

      {/* FX Context */}
      {fxContext && report.country_code && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-xl hover:transform-none p-6"
        >
          <h2 className="mb-3 text-lg font-semibold text-[var(--text-primary)]">
            Exchange Rate Context
          </h2>
          <div className="space-y-2 text-sm">
            <CurrencyDisplay
              countryCode={report.country_code}
              rate={fxContext.exchange_rate}
              variant="block"
              isStale={fxContext.is_stale}
              change24h={fxContext.change_24h}
              change7d={fxContext.change_7d}
              trend={fxContext.trend}
            />
            {fxContext.commentary && (
              <p className="text-[var(--text-muted)]">{fxContext.commentary}</p>
            )}
            {fxContext.last_updated && (
              <p className="text-xs text-[var(--text-faint)]">
                Rate as of {formatDateTime(fxContext.last_updated)}
              </p>
            )}
          </div>
        </motion.div>
      )}

      {/* Sections */}
      {sections.length > 0 ? (
        sections.map((section, i) => (
          <motion.div
            key={`${section.title}-${i}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="glass-card rounded-xl hover:transform-none p-6"
          >
            <h2 className="mb-3 text-lg font-semibold text-[var(--text-primary)]">
              {section.title}
            </h2>
            <div className="space-y-3 text-sm leading-relaxed text-[var(--text-secondary)]">
              {section.body.split("\n\n").map((paragraph, j) => (
                <p key={j}>{paragraph}</p>
              ))}
            </div>
          </motion.div>
        ))
      ) : (
        <EmptyState
          icon={FileText}
          title="No content sections"
          description="This report does not contain structured section content."
        />
      )}

      {/* References */}
      {references.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-xl hover:transform-none p-6"
        >
          <h2 className="mb-4 text-lg font-semibold text-[var(--text-primary)]">
            References
          </h2>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-[var(--text-secondary)]">
            {references.map((ref, i) => (
              <li key={i} className="leading-relaxed">
                {ref}
              </li>
            ))}
          </ol>
        </motion.div>
      )}

      {/* Metadata */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-[var(--border-primary)] bg-[var(--accent-faint)] p-6"
      >
        <h2 className="mb-4 text-lg font-semibold text-[var(--text-primary)]">
          Metadata
        </h2>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-lg bg-[var(--glass-bg)] p-3">
            <dt className="text-xs text-[var(--text-muted)]">Report ID</dt>
            <dd className="mt-1 text-sm font-medium text-[var(--text-primary)]">
              {report.id}
            </dd>
          </div>
          <div className="rounded-lg bg-[var(--glass-bg)] p-3">
            <dt className="text-xs text-[var(--text-muted)]">Source</dt>
            <dd className="mt-1 text-sm font-medium text-[var(--text-primary)]">
              {report.source}
            </dd>
          </div>
          <div className="rounded-lg bg-[var(--glass-bg)] p-3">
            <dt className="text-xs text-[var(--text-muted)]">Published</dt>
            <dd className="mt-1 text-sm font-medium text-[var(--text-primary)]">
              {formatDate(report.published_at)}
            </dd>
          </div>
          <div className="rounded-lg bg-[var(--glass-bg)] p-3">
            <dt className="text-xs text-[var(--text-muted)]">Created</dt>
            <dd className="mt-1 text-sm font-medium text-[var(--text-primary)]">
              {formatDateTime(report.created_at)}
            </dd>
          </div>
          {report.source_url && (
            <div className="rounded-lg bg-[var(--glass-bg)] p-3 sm:col-span-2">
              <dt className="text-xs text-[var(--text-muted)]">Source URL</dt>
              <dd className="mt-1">
                <a
                  href={report.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-[var(--text-primary)] underline-offset-2 hover:underline"
                >
                  {report.source_url}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </dd>
            </div>
          )}
          {metadataEntries.map(([key, value]) => (
            <div key={key} className="rounded-lg bg-[var(--glass-bg)] p-3">
              <dt className="text-xs capitalize text-[var(--text-muted)]">
                {key.replace(/_/g, " ")}
              </dt>
              <dd className="mt-1 text-sm font-medium text-[var(--text-primary)]">
                {typeof value === "object"
                  ? JSON.stringify(value)
                  : String(value)}
              </dd>
            </div>
          ))}
        </dl>
      </motion.div>
    </div>
  );
}