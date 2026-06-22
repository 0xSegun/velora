"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import SectionHeading from "./SectionHeading";
import { useCms } from "@/hooks/useSiteSettings";

const sidebarItems = [
  { label: "Site Overview", active: true },
  { label: "Analytics", active: false },
  { label: "Predictions", active: false },
  { label: "Intelligence", active: false },
  { label: "Reports", active: false },
  { label: "Settings", active: false },
];

const indicators = [
  { name: "Interest Rates", value: "18.75%", change: "+0.25%" },
  { name: "Exchange Rates", value: "Live FX /$", change: "API synced" },
  { name: "Oil Prices", value: "$82.4/bbl", change: "+$1.6" },
  { name: "Money Supply (M2)", value: "₦62.3T", change: "+₦0.8T" },
  { name: "Food Index", value: "327.4", change: "+3.1" },
  { name: "GDP Growth", value: "3.46%", change: "+0.14%" },
];

export default function DashboardPreview() {
  const { dashboardPreview } = useCms();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section id="dashboard" className="landing-section max-w-5xl mx-auto px-6 pb-24 pt-4">
      <SectionHeading
        eyebrow={dashboardPreview.eyebrow}
        title={dashboardPreview.title}
        subtitle={dashboardPreview.subtitle}
      />

      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 48, scale: 0.98 }}
        animate={inView ? { opacity: 1, y: 0, scale: 1 } : {}}
        transition={{ duration: 0.8, ease: "easeOut" as const }}
        className="rounded-3xl bg-[var(--bg-card)] border border-[var(--border-primary)] overflow-hidden shadow-[0_24px_80px_rgba(0,0,0,0.6)]"
      >
        <div className="h-10 glass border-b border-[var(--glass-border)] flex items-center gap-2 px-4">
          <span className="w-2.5 h-2.5 rounded-full bg-[var(--text-faint)]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[var(--text-muted)]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[var(--text-secondary)]" />
          <div className="ml-3 flex-1 max-w-xs h-6 rounded-lg glass flex items-center px-3">
            <span className="text-[10px] text-[var(--text-faint)] truncate font-mono">
              {dashboardPreview.mockUrl}
            </span>
          </div>
        </div>

        <div className="flex min-h-[420px]">
          <div className="hidden sm:flex w-48 flex-col glass border-r border-[var(--glass-border)] p-3 gap-1">
            {sidebarItems.map((item) => (
              <div
                key={item.label}
                className={`text-xs rounded-lg px-3 py-2 transition-colors ${
                  item.active
                    ? "bg-[var(--accent-faint)] text-[var(--accent)] font-medium border border-[var(--accent)]/20"
                    : "text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--accent-subtle)]"
                }`}
              >
                {item.label}
              </div>
            ))}
          </div>

          <div className="flex-1 p-4 space-y-4 overflow-hidden">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="glass-card rounded-xl p-4 hover:transform-none">
                <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                  Inflation Rate
                </p>
                <div className="flex items-end gap-3 mt-1">
                  <span className="text-2xl font-bold text-[var(--text-primary)]">
                    22.79%
                  </span>
                  <span className="text-xs text-[var(--text-secondary)] mb-1">
                    +2.3%
                  </span>
                </div>
                <svg viewBox="0 0 120 30" fill="none" className="w-full h-8 mt-2">
                  <path
                    d="M0 25 Q10 22,20 20 T40 15 T60 18 T80 10 T100 12 T120 5"
                    stroke="var(--chart-primary)"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </div>

              <div className="glass-card rounded-xl p-4 hover:transform-none">
                <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                  CPI Index
                </p>
                <div className="flex items-end gap-3 mt-1">
                  <span className="text-2xl font-bold text-[var(--text-primary)]">
                    35.6K
                  </span>
                  <span className="text-xs text-[var(--text-secondary)] mb-1">
                    ↑ 1.2%
                  </span>
                </div>
                <svg viewBox="0 0 120 30" fill="none" className="w-full h-8 mt-2">
                  <path
                    d="M0 28 Q15 25,30 22 T60 16 T90 12 T120 8"
                    stroke="var(--chart-secondary)"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <div className="md:col-span-3 glass-card rounded-xl p-4 hover:transform-none">
                <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-3">
                  Inflation Trend — 12 Months
                </p>
                <svg
                  viewBox="0 0 400 140"
                  fill="none"
                  className="w-full"
                  preserveAspectRatio="none"
                >
                  {[0, 35, 70, 105, 140].map((y) => (
                    <line
                      key={y}
                      x1="0"
                      y1={y}
                      x2="400"
                      y2={y}
                      stroke="var(--border-primary)"
                      strokeWidth="1"
                    />
                  ))}
                  <defs>
                    <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="0%"
                        stopColor="var(--chart-primary)"
                        stopOpacity="0.12"
                      />
                      <stop
                        offset="100%"
                        stopColor="var(--chart-primary)"
                        stopOpacity="0"
                      />
                    </linearGradient>
                  </defs>
                  <path
                    d="M0 120 Q30 115,60 100 T120 85 T180 75 T240 60 T300 50 T360 30 L400 20 L400 140 L0 140 Z"
                    fill="url(#chartGrad)"
                  />
                  <path
                    d="M0 120 Q30 115,60 100 T120 85 T180 75 T240 60 T300 50 T360 30 L400 20"
                    stroke="var(--chart-primary)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    fill="none"
                  />
                  <circle cx="400" cy="20" r="4" fill="var(--chart-primary)" />
                </svg>
              </div>

              <div className="md:col-span-2 glass-card rounded-xl p-4 hover:transform-none">
                <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-3">
                  Top Indicators
                </p>
                <ul className="space-y-2.5">
                  {indicators.map((ind) => (
                    <li
                      key={ind.name}
                      className="flex items-center justify-between text-xs py-1 border-b border-[var(--border-primary)] last:border-0"
                    >
                      <span className="text-[var(--text-muted)]">{ind.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[var(--text-primary)] font-medium">
                          {ind.value}
                        </span>
                        <span className="text-[var(--text-faint)] text-[10px]">
                          {ind.change}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}