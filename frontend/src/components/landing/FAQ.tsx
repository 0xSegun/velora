"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import SectionHeading from "./SectionHeading";
import { useCms } from "@/hooks/useSiteSettings";

export default function FAQ() {
  const { faq } = useCms();
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggle = (idx: number) =>
    setOpenIndex((prev) => (prev === idx ? null : idx));

  return (
    <section id="faq" className="landing-section py-24 relative">
      <div className="absolute inset-x-0 top-0 glass-divider" />

      <SectionHeading
        eyebrow={faq.eyebrow}
        title={faq.title}
        subtitle={faq.subtitle}
      />

      <div className="max-w-3xl mx-auto mt-14 px-4">
        <div className="glass-panel rounded-2xl overflow-hidden divide-y divide-[var(--border-primary)]">
          {faq.items.map((item, i) => {
            const isOpen = openIndex === i;

            return (
              <div key={i} className="px-5 md:px-6">
                <button
                  id={`faq-toggle-${i}`}
                  onClick={() => toggle(i)}
                  className="w-full flex justify-between items-center py-5 text-left group"
                >
                  <span className="text-base font-medium text-[var(--text-primary)] pr-4 group-hover:text-[var(--text-secondary)] transition-colors">
                    {item.question}
                  </span>
                  <motion.div
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <ChevronDown
                      size={18}
                      className="text-[var(--text-muted)] shrink-0"
                    />
                  </motion.div>
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      key={`answer-${i}`}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <p className="text-sm text-[var(--text-muted)] pb-5 leading-relaxed">
                        {item.answer}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}