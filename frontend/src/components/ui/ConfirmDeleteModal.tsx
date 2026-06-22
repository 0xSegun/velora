"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { MESSAGES } from "@/lib/feedback";

interface ConfirmDeleteModalProps {
  open: boolean;
  title?: string;
  message?: string;
  itemName?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDeleteModal({
  open,
  title = MESSAGES.delete.title,
  message = MESSAGES.delete.message,
  itemName,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDeleteModalProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onCancel]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9998] bg-black/50 backdrop-blur-sm"
            onClick={onCancel}
            aria-hidden="true"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-delete-title"
            aria-describedby="confirm-delete-desc"
            className="glass-panel fixed left-1/2 top-1/2 z-[9999] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl p-6 shadow-2xl"
          >
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FACC15]/20">
                <AlertTriangle className="h-5 w-5 text-[#CA8A04]" />
              </div>
              <div className="flex-1">
                <h2
                  id="confirm-delete-title"
                  className="text-lg font-semibold text-[var(--text-primary)]"
                >
                  {title}
                </h2>
                <p
                  id="confirm-delete-desc"
                  className="mt-2 text-sm text-[var(--text-muted)]"
                >
                  {message}
                  {itemName ? (
                    <span className="mt-1 block font-medium text-[var(--text-secondary)]">
                      {itemName}
                    </span>
                  ) : null}
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={onCancel}
                disabled={loading}
                className="btn-secondary px-4 py-2 text-sm disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={loading}
                className="rounded-full bg-[#DC2626] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#B91C1C] disabled:opacity-50"
              >
                {loading ? "Deleting..." : "Delete"}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}