"use client";

import { cn } from "@/lib/utils";
import type { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export default function Input({
  label,
  error,
  className,
  id,
  ...props
}: InputProps) {
  return (
    <div>
      {label && (
        <label
          htmlFor={id}
          className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]"
        >
          {label}
        </label>
      )}
      <input
        id={id}
        className={cn(
          "app-input w-full px-4 py-2.5 text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none",
          error && "border-red-500/50",
          className,
        )}
        aria-invalid={!!error}
        {...props}
      />
    </div>
  );
}