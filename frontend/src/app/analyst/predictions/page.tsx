"use client";

import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import PredictionsPageClient from "@/app/dashboard/predictions/PredictionsPageClient";

export default function AnalystPredictionsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--text-muted)]" />
        </div>
      }
    >
      <PredictionsPageClient showIntelligencePanel />
    </Suspense>
  );
}