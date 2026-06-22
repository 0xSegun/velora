"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus } from "lucide-react";
import { useCms } from "@/hooks/useSiteSettings";

export default function FAQ() {
  const { faq } = useCms();
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggle = (idx: number) =>
    setOpenIndex((prev) => (prev === idx ? null : idx));

  return (
    <section id="faq" className="landing-section py-32 relative">
      <div className="max-w-2xl mx-auto px-6">
        <p className="text-sm text-[var(--text-muted)] mb-10 text-center">
          {faq.eyebrow || "FAQ"}
        </p>

        <div className="divide-y divide-[var(--border-primary)]">
          {faq.items.map((item, i) => {
            const isOpen = openIndex === i;

            return (
              <div key={i}>
                <button
                  id={`faq-toggle-${i}`}
                  onClick={() => toggle(i)}
                  className="w-full flex justify-between items-center py-6 text-left group"
                >
                  <span className="text-base font-medium text-[var(--text-primary)] pr-6">
                    {item.question}
                  </span>
                  <motion.span
                    animate={{ rotate: isOpen ? 45 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="text-[var(--text-muted)] shrink-0"
                  >
                    <Plus size={18} strokeWidth={1.5} />
                  </motion.span>
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      key={`answer-${i}`}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <p className="text-sm text-[var(--text-muted)] pb-6 leading-relaxed max-w-xl">
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