"use client";

import { cn } from "@/lib/utils";

interface ToggleSwitchProps {
  id?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  danger?: boolean;
  className?: string;
  "aria-label"?: string;
}

export default function ToggleSwitch({
  id,
  checked,
  onChange,
  disabled = false,
  danger = false,
  className,
  "aria-label": ariaLabel,
}: ToggleSwitchProps) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-250",
        checked
          ? danger
            ? "bg-amber-500"
            : "bg-[var(--accent)]"
          : "bg-[var(--status-bg)] border border-[var(--status-border)]",
        disabled && "cursor-not-allowed opacity-50",
        className,
      )}
    >
      <span
        className={cn(
          "inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-250",
          checked ? "translate-x-6" : "translate-x-1",
        )}
      />
    </button>
  );
}