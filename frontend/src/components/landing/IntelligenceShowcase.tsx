"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import {
  Sparkles,
  GitBranch,
  Target,
  Newspaper,
  ShieldCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import SectionHeading from "./SectionHeading";
import { useCms } from "@/hooks/useSiteSettings";

const HIGHLIGHT_ICONS: LucideIcon[] = [
  Sparkles,
  GitBranch,
  Target,
  Newspaper,
  ShieldCheck,
];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const card = {
  hidden: { opacity: 0, y: 24 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" as const },
  },
};

export default function IntelligenceShowcase() {
  const { intelligence } = useCms();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <section id="intelligence" className="landing-section py-24 relative">
      <div className="absolute inset-x-0 top-0 glass-divider" />

      <SectionHeading
        eyebrow={intelligence.eyebrow}
        title={intelligence.title}
        subtitle={intelligence.subtitle}
      />

      <motion.div
        ref={ref}
        variants={container}
        initial="hidden"
        animate={inView ? "show" : "hidden"}
        className="max-w-6xl mx-auto mt-16 px-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
      >
        {intelligence.highlights.map((h, i) => {
          const Icon = HIGHLIGHT_ICONS[i % HIGHLIGHT_ICONS.length];
          return (
          <motion.div
            key={h.title}
            variants={card}
            id={`intel-card-${i}`}
            className={`glass-card rounded-2xl p-6 ${
              i === 0
                ? "lg:col-span-2 lg:flex lg:items-center lg:gap-8"
                : i === 4
                  ? "md:col-span-2 lg:col-span-1"
                  : ""
            }`}
          >
            <div className={i === 0 ? "flex-1" : ""}>
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="w-11 h-11 rounded-xl bg-[var(--accent-faint)] border border-[var(--accent)]/20 flex items-center justify-center text-[var(--accent)] shrink-0">
                  <Icon size={20} />
                </div>
                <span className="text-[10px] uppercase tracking-widest text-[var(--text-faint)] px-2 py-1 rounded-full glass">
                  {h.value}
                </span>
              </div>
              <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
                {h.title}
              </h3>
              <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                {h.description}
              </p>
            </div>

            {i === 0 && (
              <div className="hidden lg:block flex-1 glass-panel rounded-xl p-5 mt-6 lg:mt-0">
                <p className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] mb-3">
                  Feature attribution preview
                </p>
                <div className="space-y-3">
                  {[
                    { label: "CPI momentum", pct: 92 },
                    { label: "Exchange rate", pct: 78 },
                    { label: "Oil prices", pct: 64 },
                    { label: "Money supply", pct: 51 },
                  ].map((bar) => (
                    <div key={bar.label}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-[var(--text-secondary)]">
                          {bar.label}
                        </span>
                        <span className="text-[var(--text-faint)]">
                          {bar.pct}%
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-[var(--accent-faint)] overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={inView ? { width: `${bar.pct}%` } : {}}
                          transition={{ duration: 1, delay: 0.3 }}
                          className="h-full rounded-full bg-[var(--fin-positive)]"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
          );
        })}
      </motion.div>
    </section>
  );
}