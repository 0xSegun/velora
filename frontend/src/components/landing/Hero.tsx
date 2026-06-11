"use client";

import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useCms } from "@/hooks/useSiteSettings";

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: "easeOut" as const },
  },
};

const float = (delay: number) => ({
  y: [0, -30, 0],
  x: [0, 15, 0],
  transition: {
    duration: 8,
    repeat: Infinity,
    repeatType: "mirror" as const,
    ease: "easeInOut" as const,
    delay,
  },
});

export default function Hero() {
  const { hero } = useCms();

  return (
    <section
      id="hero"
      className="landing-section relative min-h-screen flex items-center justify-center pt-20 overflow-hidden"
    >
      <motion.div
        animate={float(0)}
        className="pointer-events-none absolute top-1/4 -left-32 w-[420px] h-[420px] rounded-full bg-white/10 blur-[120px]"
      />
      <motion.div
        animate={float(2)}
        className="pointer-events-none absolute bottom-1/4 right-0 w-[360px] h-[360px] rounded-full bg-white/[0.07] blur-[120px]"
      />

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="relative z-10 flex flex-col items-center text-center px-4"
      >
        <motion.div
          variants={fadeUp}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass text-sm text-[var(--text-secondary)] mb-8"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-primary)] animate-pulse" />
          {hero.badge}
        </motion.div>

        <motion.h1
          variants={fadeUp}
          className="text-5xl md:text-7xl font-bold max-w-4xl leading-tight text-[var(--text-primary)]"
          style={{ fontFamily: "var(--font-display), sans-serif" }}
        >
          {hero.headlineBefore}{" "}
          <span className="gradient-text">{hero.headlineHighlight}</span>{" "}
          {hero.headlineAfter}
        </motion.h1>

        <motion.p
          variants={fadeUp}
          className="text-lg text-[var(--text-muted)] max-w-2xl mt-6 leading-relaxed"
        >
          {hero.subtitle}
        </motion.p>

        <motion.div
          variants={fadeUp}
          className="flex flex-wrap items-center justify-center gap-4 mt-8"
        >
          <a
            id="hero-cta-primary"
            href="/register"
            className="inline-flex items-center btn-shine bg-[var(--text-primary)] text-[var(--bg-primary)] font-medium rounded-full px-8 py-3 shadow-[var(--glow)] hover:shadow-[var(--glow-active)] transition-shadow duration-300"
          >
            {hero.primaryCta}
          </a>
          <a
            id="hero-cta-secondary"
            href="#dashboard"
            className="inline-flex items-center glass-card rounded-full px-8 py-3 text-[var(--text-primary)] font-medium hover:transform-none"
          >
            {hero.secondaryCta}
          </a>
        </motion.div>

        <motion.div
          variants={fadeUp}
          className="flex flex-wrap items-center justify-center gap-6 mt-12"
        >
          {hero.stats.map((s) => (
            <div
              key={s.label}
              className="glass rounded-2xl px-5 py-3 text-center min-w-[120px]"
            >
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

      <motion.a
        href="#dashboard"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2, duration: 0.6 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-[var(--text-faint)] hover:text-[var(--text-muted)] transition-colors"
        aria-label="Scroll to dashboard preview"
      >
        <span className="text-[10px] uppercase tracking-widest">Explore</span>
        <motion.div
          animate={{ y: [0, 6, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        >
          <ChevronDown size={20} />
        </motion.div>
      </motion.a>
    </section>
  );
}