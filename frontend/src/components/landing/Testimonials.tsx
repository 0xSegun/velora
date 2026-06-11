"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Quote } from "lucide-react";
import SectionHeading from "./SectionHeading";
import { useCms } from "@/hooks/useSiteSettings";

function initialsFromName(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12 } },
};

const card = {
  hidden: { opacity: 0, y: 30 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" as const },
  },
};

export default function Testimonials() {
  const { testimonials } = useCms();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <section className="landing-section py-24 relative">
      <div className="absolute inset-x-0 top-0 glass-divider" />

      <SectionHeading
        eyebrow={testimonials.eyebrow}
        title={testimonials.title}
      />

      <motion.div
        ref={ref}
        variants={container}
        initial="hidden"
        animate={inView ? "show" : "hidden"}
        className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-14 max-w-6xl mx-auto px-4"
      >
        {testimonials.items.map((t, i) => (
          <motion.div
            key={`${t.author}-${i}`}
            variants={card}
            id={`testimonial-${i}`}
            className="glass-card rounded-2xl p-6 flex flex-col"
          >
            <Quote size={22} className="text-[var(--text-primary)] mb-3 opacity-60" />
            <p className="text-sm text-[var(--text-secondary)] italic leading-relaxed flex-1">
              &ldquo;{t.quote}&rdquo;
            </p>
            <div className="glass-divider my-5" />
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full glass-heavy flex items-center justify-center text-[var(--text-primary)] text-sm font-bold shrink-0">
                {initialsFromName(t.author)}
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">
                  {t.author}
                </p>
                <p className="text-xs text-[var(--text-muted)]">{t.title}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}