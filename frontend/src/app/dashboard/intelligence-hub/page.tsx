"use client";

import dynamic from "next/dynamic";

const IntelligenceHub = dynamic(
  () => import("@/components/intelligence/IntelligenceHub"),
  {
    loading: () => (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-[var(--text-muted)]">
        Loading Intelligence Hub…
      </div>
    ),
    ssr: false,
  }
);

export default function UserIntelligenceHubPage() {
  return <IntelligenceHub />;
}