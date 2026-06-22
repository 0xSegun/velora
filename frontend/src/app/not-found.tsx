"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Home } from "lucide-react";
import AppAmbient from "@/components/ui/AppAmbient";

export default function NotFound() {
  return (
    <main className="app-shell relative flex min-h-screen items-center justify-center px-4">
      <AppAmbient variant="rich" />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="app-shell-content relative z-10 w-full max-w-lg glass-panel rounded-2xl p-8 text-center"
      >
        <p className="text-7xl font-extrabold tracking-tight gradient-text">404</p>
        <h1 className="mt-4 text-2xl font-bold text-[var(--text-primary)]">
          Page not found
        </h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href="/" className="btn-primary btn-shine px-6 py-2.5 text-sm gap-2">
            <Home className="h-4 w-4" />
            Back to Home
          </Link>
          <button
            type="button"
            onClick={() => window.history.back()}
            className="btn-secondary px-6 py-2.5 text-sm gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Go Back
          </button>
        </div>
      </motion.div>
    </main>
  );
}