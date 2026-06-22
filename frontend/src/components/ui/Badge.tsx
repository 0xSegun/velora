"use client";

import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "success" | "warning" | "danger" | "info" | "brand";

const variantStyles: Record<BadgeVariant, string> = {
  default: "bg-[var(--status-bg)] text-[var(--status-text)] border-[var(--status-border)]",
  success: "bg-fin-positive text-fin-positive border-emerald-500/20",
  warning: "bg-fin-caution text-fin-caution border-amber-500/20",
  danger: "bg-fin-negative text-fin-negative border-red-500/20",
  info: "bg-fin-info text-fin-info border-cyan-500/20",
  brand: "bg-[var(--accent-faint)] text-[var(--accent)] border-[var(--accent)]/20",
};

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

export default function Badge({
  children,
  variant = "default",
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        variantStyles[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}