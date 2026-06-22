"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { useCms } from "@/hooks/useSiteSettings";

export default function Statistics() {
  const { statistics } = useCms();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <section className="landing-section py-24 relative">
      <div className="absolute inset-x-0 top-0 glass-divider" />

      <div className="max-w-5xl mx-auto px-4">
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-3xl p-10 md:p-14"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {statistics.items.map((stat, i) => (
              <motion.div
                key={stat.label}
                id={`stat-${i}`}
                initial={{ opacity: 0, y: 20 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: i * 0.1 }}
              >
                <span className="text-4xl md:text-5xl font-extrabold text-[var(--text-primary)]">
                  {stat.value}
                </span>
                <p className="text-sm text-[var(--text-muted)] mt-2">
                  {stat.label}
                </p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}