"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useCms } from "@/hooks/useSiteSettings";

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" as const },
  },
};

export default function Hero() {
  const { hero } = useCms();

  return (
    <section
      id="hero"
      className="landing-section relative flex flex-col items-center pt-32 pb-16 overflow-hidden"
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[var(--bg-primary)]" />
      <div className="pointer-events-none absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full bg-[var(--accent)]/5 blur-[120px]" />

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="relative z-10 flex flex-col items-center text-center px-6 max-w-4xl mx-auto"
      >
        <motion.p
          variants={fadeUp}
          className="text-sm text-[var(--text-muted)] mb-6"
        >
          {hero.badge}
        </motion.p>

        <motion.h1
          variants={fadeUp}
          className="text-5xl sm:text-6xl md:text-7xl lg:text-[5.5rem] font-extrabold leading-[1.05] tracking-tight text-[var(--text-primary)]"
        >
          {hero.headlineBefore}{" "}
          <span className="gradient-text">{hero.headlineHighlight}</span>{" "}
          {hero.headlineAfter}
        </motion.h1>

        <motion.p
          variants={fadeUp}
          className="text-base md:text-lg text-[var(--text-muted)] max-w-xl mt-6 leading-relaxed"
        >
          {hero.subtitle}
        </motion.p>

        <motion.div
          variants={fadeUp}
          className="flex flex-wrap items-center justify-center gap-3 mt-8"
        >
          <a
            id="hero-cta-secondary"
            href="#dashboard"
            className="btn-secondary px-6 py-2.5 text-sm"
          >
            {hero.secondaryCta}
          </a>
          <a
            id="hero-cta-primary"
            href="/register"
            className="btn-primary btn-shine px-6 py-2.5 text-sm gap-1.5"
          >
            {hero.primaryCta}
            <ArrowRight size={16} />
          </a>
        </motion.div>

        <motion.div
          variants={fadeUp}
          className="flex flex-wrap items-center justify-center gap-8 mt-16"
        >
          {hero.stats.map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-xl font-bold text-[var(--text-primary)]">
                {s.value}
              </p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                {s.label}
              </p>
            </div>
          ))}
        </motion.div>
      </motion.div>
    </section>
  );
}