"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { TrendingUp, Shield, Brain, Activity } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import SectionHeading from "./SectionHeading";
import { useCms } from "@/hooks/useSiteSettings";

const METRIC_ICONS: LucideIcon[] = [TrendingUp, Shield, Brain, Activity];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
};

const card = {
  hidden: { opacity: 0, y: 24 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" as const },
  },
};

export default function LivePreview() {
  const { livePreview } = useCms();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <section className="landing-section py-24 relative">
      <div className="absolute inset-x-0 top-0 glass-divider" />

      <SectionHeading
        eyebrow={livePreview.eyebrow}
        title={livePreview.title}
      />

      <motion.div
        ref={ref}
        variants={container}
        initial="hidden"
        animate={inView ? "show" : "hidden"}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-14 max-w-6xl mx-auto px-4"
      >
        {livePreview.metrics.map((metric, i) => {
          const Icon = METRIC_ICONS[i % METRIC_ICONS.length];
          return (
            <motion.div
              key={metric.label}
              variants={card}
              id={`live-metric-${i}`}
              className="glass-card rounded-2xl p-5"
            >
              <div className="flex items-center gap-2 mb-3">
                <Icon size={16} className="text-[var(--text-muted)]" />
                <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider">
                  {metric.label}
                </span>
              </div>
              <p className="text-2xl font-bold text-[var(--text-primary)]">
                {metric.value}
              </p>
              <p className="text-xs text-[var(--text-secondary)] mt-2">
                {metric.change}
              </p>
            </motion.div>
          );
        })}
      </motion.div>
    </section>
  );
}