"use client";

import { useState } from "react";
import { BookOpen, ChevronDown, ChevronUp } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import { EDUCATION_TOPICS } from "@/lib/plainLanguage";

export default function HelpCenterPage() {
  const [open, setOpen] = useState<string | null>(EDUCATION_TOPICS[0]?.slug ?? null);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Learn"
        title="Help Center"
        description="Understand inflation and deflation in plain language — no economics degree required."
        icon={BookOpen}
      />

      <section className="glass-panel rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">Learn About Inflation</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Tap a topic below for a simple explanation and real-world example.
        </p>
        <div className="mt-4 space-y-2">
          {EDUCATION_TOPICS.map((topic) => {
            const expanded = open === topic.slug;
            return (
              <div
                key={topic.slug}
                className="rounded-xl border border-[var(--border-primary)] overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setOpen(expanded ? null : topic.slug)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--accent-subtle)]"
                >
                  {topic.title}
                  {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                {expanded && (
                  <div className="border-t border-[var(--border-primary)] px-4 py-3 text-sm text-[var(--text-muted)]">
                    <p>{topic.summary}</p>
                    <p className="mt-2 rounded-lg bg-[var(--glass-bg)] p-3 text-xs">
                      <span className="font-semibold text-[var(--text-primary)]">Example: </span>
                      {topic.example}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="glass-panel rounded-2xl p-6 text-sm text-[var(--text-muted)]">
        <h3 className="font-semibold text-[var(--text-primary)]">Need more help?</h3>
        <p className="mt-2">
          Ask the AI assistant on your Overview page: &quot;What does inflation mean for my daily expenses?&quot;
          We explain forecasts in everyday language, not technical jargon.
        </p>
      </section>
    </div>
  );
}