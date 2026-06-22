"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Loader2,
  Newspaper,
  Bookmark,
  Share2,
  ExternalLink,
  Filter,
  X,
} from "lucide-react";
import { intelligenceAPI } from "@/lib/api";
import CountryFocusBar, { useActiveCountryCode } from "@/components/dashboard/CountryFocusBar";
import { CountryLabel } from "@/components/ui/CountryFlag";
import PageHeader from "@/components/ui/PageHeader";
import { formatDateTime } from "@/lib/dates";
import EmptyState from "@/components/ui/EmptyState";

interface NewsArticle {
  id: string;
  title: string;
  summary: string;
  content?: string;
  source: string;
  url?: string;
  category: string;
  country_code?: string;
  sentiment_label?: string;
  sentiment_score?: number;
  risk_score?: number;
  economic_impact_score?: number;
  impact_explanation?: string;
  published_at: string;
  priority_tier?: string;
  priority_label?: string;
}

const SOURCES = ["all", "Reuters", "Bloomberg", "World Bank", "IMF", "OECD", "CNBC", "Financial Times", "Trading Economics"];
const CATEGORIES = ["all", "inflation", "exchange_rates", "interest_rates", "gdp", "commodities", "markets"];

const SENTIMENT_STYLES: Record<string, { bg: string; text: string }> = {
  Positive: { bg: "#22c55e20", text: "#22c55e" },
  Neutral: { bg: "#eab30820", text: "#eab308" },
  Negative: { bg: "#ef444420", text: "#ef4444" },
};

const TIER_LABELS: Record<string, string> = {
  primary: "Your country",
  tracked: "Tracked",
  regional: "Regional",
  continental: "Continental",
  global: "Global",
};

export default function EconomicNewsPage() {
  const activeCountry = useActiveCountryCode();
  const [items, setItems] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<NewsArticle | null>(null);
  const [bookmarks, setBookmarks] = useState<string[]>([]);
  const [sourceFilter, setSourceFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [feedStatus, setFeedStatus] = useState<{
    live_feed_enabled?: boolean;
    provider?: string;
    status?: string;
    last_sync?: string | null;
    using_cached_data?: boolean;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number | boolean> = {
        limit: 30,
        country_code: activeCountry,
        country_priority: !search.trim(),
      };
      if (sourceFilter !== "all") params.source = sourceFilter;
      if (categoryFilter !== "all") params.topic = categoryFilter;
      if (search.trim()) params.search = search.trim();
      const { data } = await intelligenceAPI.getNews(params);
      const list =
        (data as { items?: NewsArticle[] })?.items ??
        (Array.isArray(data) ? data : []);
      setItems(list as NewsArticle[]);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [activeCountry, sourceFilter, categoryFilter, search]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    intelligenceAPI
      .getNewsStatus()
      .then(({ data }) => setFeedStatus(data))
      .catch(() => setFeedStatus(null));
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("velora_news_bookmarks");
      if (saved) setBookmarks(JSON.parse(saved) as string[]);
    } catch {
      setBookmarks([]);
    }
  }, []);

  const toggleBookmark = (id: string) => {
    setBookmarks((prev) => {
      const next = prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id];
      localStorage.setItem("velora_news_bookmarks", JSON.stringify(next));
      return next;
    });
  };

  const shareArticle = async (article: NewsArticle) => {
    const text = `${article.title} — ${article.source}`;
    if (navigator.share) {
      await navigator.share({ title: article.title, text, url: article.url ?? window.location.href });
    } else {
      await navigator.clipboard.writeText(text);
    }
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.summary.toLowerCase().includes(q),
    );
  }, [items, search]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="AI News Intelligence"
        title="Economic News"
        description="Country-focused headlines with AI summaries, sentiment analysis, and impact explanations."
        icon={Newspaper}
      />

      <CountryFocusBar label="News focus" />

      {feedStatus && (
        <div className="glass-panel rounded-xl px-4 py-3 text-xs text-[var(--text-muted)]">
          <CountryLabel code={activeCountry} className="mr-1" />
          {feedStatus.live_feed_enabled ? (
            <span>
              Prioritized news for your focus country via{" "}
              <strong className="text-[var(--text-primary)]">{feedStatus.provider}</strong>
              {feedStatus.last_sync && ` · synced ${formatDateTime(feedStatus.last_sync)}`}
            </span>
          ) : (
            <span>
              Country-prioritized headlines — enable News API in admin for live Reuters, Bloomberg, and FT feeds.
            </span>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Filter className="h-4 w-4 text-[var(--text-muted)] self-center" />
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="app-input rounded-lg px-3 py-1.5 text-xs"
        >
          {SOURCES.map((s) => (
            <option key={s} value={s}>
              {s === "all" ? "All sources" : s}
            </option>
          ))}
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="app-input rounded-lg px-3 py-1.5 text-xs"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c === "all" ? "All topics" : c.replace("_", " ")}
            </option>
          ))}
        </select>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search headlines…"
          className="app-input flex-1 min-w-[160px] rounded-lg px-3 py-1.5 text-xs"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2 space-y-3 max-h-[70vh] overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-[var(--text-muted)]" />
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Newspaper}
              title="No articles match"
              description="Try adjusting filters or check back after the intelligence feed syncs."
            />
          ) : (
            filtered.map((item) => {
              const sent = SENTIMENT_STYLES[item.sentiment_label ?? "Neutral"] ?? SENTIMENT_STYLES.Neutral;
              const active = selected?.id === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelected(item)}
                  className={`w-full text-left glass-panel rounded-2xl p-4 transition ${
                    active ? "border-[var(--border-active)]" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold text-[var(--text-primary)]">{item.title}</h3>
                    <span
                      className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium"
                      style={{ background: sent.bg, color: sent.text }}
                    >
                      {item.sentiment_label ?? "Neutral"}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-[var(--text-muted)]">{item.summary}</p>
                  <p className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-[var(--text-faint)]">
                    {item.country_code ? (
                      <CountryLabel code={item.country_code} flagSize="xs" />
                    ) : null}
                    <span>
                      {item.source} · {formatDateTime(item.published_at)}
                      {item.priority_tier && (
                        <> · {TIER_LABELS[item.priority_tier] ?? item.priority_label}</>
                      )}
                    </span>
                  </p>
                </button>
              );
            })
          )}
        </div>

        <div className="lg:col-span-3">
          {selected ? (
            <article className="glass-panel rounded-2xl p-6 sticky top-4">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-xl font-bold text-[var(--text-primary)]">{selected.title}</h2>
                <button type="button" onClick={() => setSelected(null)} className="btn-ghost p-1 lg:hidden">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[var(--text-faint)]">
                {selected.country_code ? (
                  <CountryLabel code={selected.country_code} flagSize="xs" />
                ) : null}
                <span>
                  {selected.source} · {formatDateTime(selected.published_at)} · {selected.category}
                </span>
              </p>

              <div className="mt-4 grid grid-cols-3 gap-2">
                {[
                  { label: "Sentiment", value: selected.sentiment_score, suffix: "%" },
                  { label: "Risk", value: selected.risk_score, suffix: "" },
                  { label: "Impact", value: selected.economic_impact_score, suffix: "" },
                ].map((m) => (
                  <div key={m.label} className="rounded-lg bg-[var(--accent-faint)] p-3 text-center">
                    <p className="text-[10px] text-[var(--text-faint)]">{m.label}</p>
                    <p className="text-lg font-bold">
                      {m.value != null ? `${m.value}${m.suffix}` : "—"}
                    </p>
                  </div>
                ))}
              </div>

              <p className="mt-4 text-sm font-medium text-[var(--text-primary)]">AI Summary</p>
              <p className="mt-1 text-sm text-[var(--text-muted)]">{selected.summary}</p>

              {selected.impact_explanation && (
                <>
                  <p className="mt-4 text-sm font-medium text-[var(--text-primary)]">Why this matters</p>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">{selected.impact_explanation}</p>
                </>
              )}

              <p className="mt-4 text-sm leading-relaxed text-[var(--text-secondary)]">
                {selected.content ?? selected.summary}
              </p>

              <div className="mt-6 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => toggleBookmark(selected.id)}
                  className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs ${
                    bookmarks.includes(selected.id) ? "border-[var(--accent)]" : ""
                  }`}
                >
                  <Bookmark className="h-3.5 w-3.5" />
                  {bookmarks.includes(selected.id) ? "Saved" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => void shareArticle(selected)}
                  className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs"
                >
                  <Share2 className="h-3.5 w-3.5" />
                  Share
                </button>
                {selected.url && (
                  <a
                    href={selected.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Original source
                  </a>
                )}
              </div>
            </article>
          ) : (
            <div className="glass-panel rounded-2xl p-8 text-center text-sm text-[var(--text-muted)]">
              Select an article to read the full AI analysis and sentiment breakdown.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}