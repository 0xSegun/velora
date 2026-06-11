"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, CheckCircle2, XCircle, AlertTriangle, Info } from "lucide-react";
import { useToastStore, type Toast, type ToastType } from "@/store/toastStore";

const TOAST_STYLES: Record<
  ToastType,
  { bg: string; text: string; icon: typeof CheckCircle2 }
> = {
  success: { bg: "#16A34A", text: "#FFFFFF", icon: CheckCircle2 },
  error: { bg: "#DC2626", text: "#FFFFFF", icon: XCircle },
  warning: { bg: "#FACC15", text: "#000000", icon: AlertTriangle },
  info: { bg: "#525252", text: "#FFFFFF", icon: Info },
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
      className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl px-4 py-3 shadow-2xl"
      style={{ backgroundColor: style.bg, color: style.text }}
    >
      <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <p className="flex-1 text-sm font-medium leading-snug">{toast.message}</p>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="shrink-0 rounded-lg p-1 opacity-80 transition hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
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