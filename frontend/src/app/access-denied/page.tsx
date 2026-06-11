"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ShieldOff } from "lucide-react";
import { MESSAGES, toast } from "@/lib/feedback";
import AppAmbient from "@/components/ui/AppAmbient";

export default function AccessDeniedPage() {
  useEffect(() => {
    toast.error(MESSAGES.auth.accessDenied);
  }, []);

  return (
    <main className="app-shell relative flex min-h-screen items-center justify-center px-4">
      <AppAmbient variant="rich" />
      <div className="app-shell-content relative z-10 max-w-md glass-panel rounded-2xl p-8 text-center">
        <ShieldOff className="mx-auto h-12 w-12 text-[#DC2626]" />
        <h1 className="mt-4 text-2xl font-bold text-[var(--text-primary)]">
          Access Denied
        </h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          {MESSAGES.auth.accessDenied}
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/dashboard"
            className="rounded-xl bg-[var(--text-primary)] px-5 py-2.5 text-sm font-medium text-[var(--bg-primary)]"
          >
            Go to Dashboard
          </Link>
          <Link
            href="/login"
            className="glass-card rounded-xl px-5 py-2.5 text-sm font-medium text-[var(--text-secondary)] hover:transform-none"
          >
            Sign in as Admin
          </Link>
        </div>
      </div>
    </main>
  );
}