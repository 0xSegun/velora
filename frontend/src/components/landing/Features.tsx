"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import SectionHeading from "./SectionHeading";
import { useCms } from "@/hooks/useSiteSettings";
import { resolveCmsIcon } from "@/lib/cmsIcons";

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
};

const card = {
  hidden: { opacity: 0, y: 30 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" as const },
  },
};

export default function Features() {
  const { features } = useCms();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <section id="features" className="landing-section py-24 relative">
      <div className="absolute inset-x-0 top-0 glass-divider" />

      <SectionHeading
        eyebrow={features.eyebrow}
        title={features.title}
        subtitle={features.subtitle}
      />

      <motion.div
        ref={ref}
        variants={container}
        initial="hidden"
        animate={inView ? "show" : "hidden"}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-16 max-w-6xl mx-auto px-4"
      >
        {features.items.map((feat, i) => {
          const Icon = resolveCmsIcon(feat.icon);
          return (
            <motion.div
              key={`${feat.title}-${i}`}
              variants={card}
              id={`feature-card-${i}`}
              className="glass-card rounded-2xl p-6 group"
            >
              <div className="w-11 h-11 rounded-xl glass-heavy flex items-center justify-center mb-4 text-[var(--text-primary)] group-hover:shadow-[var(--glow)] transition-shadow">
                <Icon size={20} />
              </div>
              <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
                {feat.title}
              </h3>
              <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                {feat.description}
              </p>
            </motion.div>
          );
        })}
      </motion.div>
    </section>
  );
}