"use client";

import Link from "next/link";
import AppAmbient from "@/components/ui/AppAmbient";
import { useLegalContent } from "@/hooks/useSiteSettings";

export function PrivacyPageContent() {
  const legal = useLegalContent();
  return (
    <LegalShell title={legal.privacyTitle} updated={legal.privacyLastUpdated}>
      <p>{legal.privacyContent}</p>
    </LegalShell>
  );
}

export function TermsPageContent() {
  const legal = useLegalContent();
  return (
    <LegalShell title={legal.termsTitle} updated={legal.termsLastUpdated}>
      <p>{legal.termsContent}</p>
    </LegalShell>
  );
}

function LegalShell({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <main className="app-shell relative min-h-screen px-4 py-16 text-[var(--text-secondary)]">
      <AppAmbient />
      <section className="app-shell-content relative z-10 mx-auto max-w-3xl glass-panel rounded-2xl p-8">
        <Link
          href="/"
          className="text-xs uppercase tracking-[0.24em] text-[var(--text-faint)] hover:text-[var(--text-muted)] transition-colors print:hidden"
        >
          ← Back to home
        </Link>
        <p className="mt-4 text-xs uppercase tracking-[0.24em] text-[var(--text-faint)]">
          Legal · Last updated {updated}
        </p>
        <h1 className="mt-2 text-3xl font-bold text-[var(--text-primary)]">{title}</h1>
        <div className="mt-6 space-y-4 text-sm leading-6 text-[var(--text-muted)]">{children}</div>
      </section>
    </main>
  );
}