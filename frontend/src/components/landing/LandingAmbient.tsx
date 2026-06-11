"use client";

import { motion } from "framer-motion";

const float = (delay: number, duration = 10) => ({
  y: [0, -24, 0],
  x: [0, 12, 0],
  scale: [1, 1.04, 1],
  transition: {
    duration,
    repeat: Infinity,
    repeatType: "mirror" as const,
    ease: "easeInOut" as const,
    delay,
  },
});

export default function LandingAmbient() {
  return (
    <div
      className="fixed inset-0 pointer-events-none overflow-hidden z-0"
      aria-hidden
    >
      <div className="absolute inset-0 landing-grid-bg opacity-60" />

      <motion.div
        animate={float(0, 12)}
        className="orb orb-purple absolute -top-32 -left-32 w-[520px] h-[520px]"
      />
      <motion.div
        animate={float(3, 14)}
        className="orb orb-violet absolute top-1/3 -right-40 w-[480px] h-[480px]"
      />
      <motion.div
        animate={float(6, 11)}
        className="orb orb-purple absolute bottom-0 left-1/4 w-[400px] h-[400px] opacity-20"
      />

      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--glass-border-hover)] to-transparent" />
    </div>
  );
}