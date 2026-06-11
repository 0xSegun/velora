"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Database, Cpu, LineChart, FileOutput } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import SectionHeading from "./SectionHeading";
import { useCms } from "@/hooks/useSiteSettings";

const STEP_ICONS: LucideIcon[] = [Database, Cpu, LineChart, FileOutput];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12 } },
};

const item = {
  hidden: { opacity: 0, y: 28 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: "easeOut" as const },
  },
};

export default function HowItWorks() {
  const { howItWorks } = useCms();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <section id="how-it-works" className="landing-section py-24 relative">
      <div className="absolute inset-x-0 top-0 glass-divider" />

      <SectionHeading
        eyebrow={howItWorks.eyebrow}
        title={howItWorks.title}
        subtitle={howItWorks.subtitle}
      />

      <motion.div
        ref={ref}
        variants={container}
        initial="hidden"
        animate={inView ? "show" : "hidden"}
        className="relative max-w-6xl mx-auto mt-16 px-4"
      >
        <div className="hidden lg:block absolute top-12 left-[12%] right-[12%] h-px bg-gradient-to-r from-transparent via-[var(--glass-border-hover)] to-transparent" />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {howItWorks.steps.map((s, idx) => {
            const Icon = STEP_ICONS[idx % STEP_ICONS.length];
            return (
            <motion.div
              key={s.step}
              variants={item}
              className="glass-card rounded-2xl p-6 relative group"
            >
              <div className="flex items-center justify-between mb-5">
                <span className="text-xs font-mono text-[var(--text-faint)] tracking-widest">
                  {s.step}
                </span>
                <div className="w-10 h-10 rounded-xl glass flex items-center justify-center text-[var(--text-primary)]">
                  <Icon size={18} />
                </div>
              </div>
              <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
                {s.title}
              </h3>
              <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                {s.description}
              </p>
            </motion.div>
            );
          })}
        </div>
      </motion.div>
    </section>
  );
}