"use client";

import { motion } from "framer-motion";
import { useCms } from "@/hooks/useSiteSettings";

export default function CTA() {
  const { cta } = useCms();

  return (
    <section id="get-started" className="landing-section py-24 relative overflow-hidden">
      <motion.div
        animate={{
          y: [0, -20, 0],
          scale: [1, 1.05, 1],
        }}
        transition={{
          duration: 6,
          repeat: Infinity,
          repeatType: "mirror",
          ease: "easeInOut",
        }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-[var(--accent-faint)] blur-[120px] pointer-events-none"
      />

      <div className="relative z-10 max-w-3xl mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="glass-panel rounded-3xl p-10 md:p-14 text-center"
        >
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.05 }}
            className="text-3xl md:text-4xl font-bold text-[var(--text-primary)]"
            style={{ fontFamily: "var(--font-display), sans-serif" }}
          >
            {cta.title}
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-[var(--text-muted)] mt-4 max-w-xl mx-auto"
          >
            {cta.subtitle}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8"
          >
            <a
              id="cta-get-started"
              href="/register"
              className="inline-flex items-center btn-shine bg-[var(--text-primary)] text-[var(--bg-primary)] font-medium rounded-full px-8 py-3 shadow-[var(--glow)] hover:shadow-[var(--glow-active)] transition-shadow duration-300"
            >
              {cta.primaryCta}
            </a>
            <a
              href="/dashboard"
              className="inline-flex items-center glass-card rounded-full px-8 py-3 text-[var(--text-primary)] font-medium hover:transform-none"
            >
              {cta.secondaryCta}
            </a>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-xs text-[var(--text-faint)] mt-4"
          >
            {cta.footnote}
          </motion.p>
        </motion.div>
      </div>
    </section>
  );
}