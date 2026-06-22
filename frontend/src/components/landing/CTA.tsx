"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useCms } from "@/hooks/useSiteSettings";

export default function CTA() {
  const { cta } = useCms();

  return (
    <section id="get-started" className="landing-section py-32 relative">
      <div className="relative z-10 max-w-3xl mx-auto px-6 text-center">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-4xl md:text-6xl font-extrabold text-[var(--text-primary)] leading-tight tracking-tight"
        >
          {cta.title}
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.05 }}
          className="text-[var(--text-muted)] mt-5 text-lg"
        >
          {cta.subtitle}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mt-10"
        >
          <a
            id="cta-get-started"
            href="/register"
            className="btn-primary btn-shine px-8 py-3 text-base gap-2"
          >
            {cta.primaryCta}
            <ArrowRight size={18} />
          </a>
        </motion.div>

        {cta.footnote && (
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="text-xs text-[var(--text-faint)] mt-5"
          >
            {cta.footnote}
          </motion.p>
        )}
      </div>
    </section>
  );
}