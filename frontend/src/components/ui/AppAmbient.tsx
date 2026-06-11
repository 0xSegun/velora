"use client";

import { motion } from "framer-motion";

const float = (delay: number) => ({
  y: [0, -18, 0],
  transition: {
    duration: 10,
    repeat: Infinity,
    repeatType: "mirror" as const,
    ease: "easeInOut" as const,
    delay,
  },
});

interface AppAmbientProps {
  variant?: "subtle" | "rich";
}

export default function AppAmbient({ variant = "subtle" }: AppAmbientProps) {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden print:hidden"
      aria-hidden
    >
      <div
        className={`absolute inset-0 landing-grid-bg ${
          variant === "rich" ? "opacity-50" : "opacity-30"
        }`}
      />
      <motion.div
        animate={float(0)}
        className="orb orb-purple absolute -top-40 -right-20 h-[420px] w-[420px]"
      />
      <motion.div
        animate={float(3)}
        className="orb orb-violet absolute -bottom-40 -left-20 h-[360px] w-[360px] opacity-20"
      />
    </div>
  );
}