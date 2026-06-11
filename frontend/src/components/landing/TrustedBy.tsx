"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { useCms } from "@/hooks/useSiteSettings";

export default function TrustedBy() {
  const { trustedBy } = useCms();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const marqueeItems = [...trustedBy.institutions, ...trustedBy.institutions];

  return (
    <section className="landing-section py-16 relative overflow-hidden">
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 20 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6 }}
        className="text-center"
      >
        <p className="text-sm text-[var(--text-muted)] px-4">
          {trustedBy.title}
        </p>

        <div className="relative mt-10 overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-[var(--bg-primary)] to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-[var(--bg-primary)] to-transparent z-10 pointer-events-none" />

          <div className="flex w-max marquee-track gap-4 py-1">
            {marqueeItems.map((name, i) => (
              <div
                key={`${name}-${i}`}
                id={`trusted-pill-${i % trustedBy.institutions.length}`}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full glass shrink-0 text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors cursor-default"
              >
                <span>{name}</span>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </section>
  );
}