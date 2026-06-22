"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ShieldOff } from "lucide-react";
import { MESSAGES, toast } from "@/lib/feedback";
import AppAmbient from "@/components/ui/AppAmbient";
import { useAuthStore } from "@/store/authStore";
import { defaultHomeForRole } from "@/lib/roles";

export default function AccessDeniedPage() {
  const role = useAuthStore((s) => s.user?.role);
  const home = defaultHomeForRole(role);

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
        <p className="mt-2 text-xs text-[var(--text-faint)]">
          This area is reserved for analysts and administrators. Ordinary users
          see simplified forecasts on the personal dashboard.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href={home} className="btn-primary px-5 py-2.5 text-sm">
            Go to My Dashboard
          </Link>
          {role !== "admin" && (
            <Link href="/login" className="btn-secondary px-5 py-2.5 text-sm">
              Sign in with a different account
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}