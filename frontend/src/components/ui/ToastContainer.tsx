"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, CheckCircle2, XCircle, AlertTriangle, Info } from "lucide-react";
import { useToastStore, type Toast, type ToastType } from "@/store/toastStore";
import { cn } from "@/lib/utils";

const TOAST_STYLES: Record<
  ToastType,
  { icon: typeof CheckCircle2; iconClass: string; borderClass: string }
> = {
  success: {
    icon: CheckCircle2,
    iconClass: "text-fin-positive",
    borderClass: "border-emerald-500/30",
  },
  error: {
    icon: XCircle,
    iconClass: "text-fin-negative",
    borderClass: "border-red-500/30",
  },
  warning: {
    icon: AlertTriangle,
    iconClass: "text-fin-caution",
    borderClass: "border-amber-500/30",
  },
  info: {
    icon: Info,
    iconClass: "text-fin-info",
    borderClass: "border-[var(--accent)]/30",
  },
};

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: string) => void;
}) {
  const style = TOAST_STYLES[toast.type];
  const Icon = style.icon;
  const duration = toast.duration ?? 5000;

  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(toast.id), duration);
    return () => window.clearTimeout(timer);
  }, [toast.id, duration, onDismiss]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 80, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 80, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      role="alert"
      aria-live="polite"
      aria-atomic="true"
      className={cn(
        "glass-panel pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border px-4 py-3 shadow-2xl",
        style.borderClass,
      )}
    >
      <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", style.iconClass)} aria-hidden="true" />
      <p className="flex-1 text-sm font-medium leading-snug text-[var(--text-primary)]">
        {toast.message}
      </p>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="shrink-0 rounded-lg p-1 text-[var(--text-muted)] transition hover:bg-[var(--accent-faint)] hover:text-[var(--text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        aria-label="Dismiss notification"
      >
        <X className="h-4 w-4" />
      </button>
    </motion.div>
  );
}

export default function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);

  return (
    <div
      className="pointer-events-none fixed right-4 top-4 z-[9999] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2 sm:right-6 sm:top-6 print:hidden"
      aria-label="Notifications"
    >
      <AnimatePresence mode="popLayout">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={removeToast} />
        ))}
      </AnimatePresence>
    </div>
  );
}