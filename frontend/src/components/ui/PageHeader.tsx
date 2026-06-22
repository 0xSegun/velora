"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  icon?: LucideIcon;
  actions?: React.ReactNode;
  className?: string;
}

export default function PageHeader({
  eyebrow,
  title,
  description,
  icon: Icon,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className={cn("glass-panel rounded-2xl p-6", className)}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          {eyebrow && (
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--text-faint)]">
              {eyebrow}
            </p>
          )}
          <div className="mt-2 flex items-center gap-3">
            {Icon && (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--border-primary)] bg-[var(--accent-faint)]">
                <Icon className="h-5 w-5 text-[var(--accent)]" />
              </div>
            )}
            <h1 className="text-2xl font-bold text-[var(--text-primary)] sm:text-3xl">
              {title}
            </h1>
          </div>
          {description && (
            <p className="mt-2 max-w-2xl text-sm text-[var(--text-muted)]">
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </motion.section>
  );
}