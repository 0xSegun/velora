"use client";

import { motion } from "framer-motion";

interface FieldErrorProps {
  message?: string | null;
  variant?: "error" | "warning";
}

export default function FieldError({
  message,
  variant = "error",
}: FieldErrorProps) {
  if (!message) return null;

  const colorClass =
    variant === "warning" ? "text-[#CA8A04]" : "text-[#DC2626]";

  return (
    <motion.p
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className={`mt-1 text-xs ${colorClass}`}
      role="alert"
    >
      {message}
    </motion.p>
  );
}