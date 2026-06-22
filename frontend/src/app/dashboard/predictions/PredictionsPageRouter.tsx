"use client";

import { useAuthStore } from "@/store/authStore";
import { isAnalystRole } from "@/lib/roles";
import OrdinaryPredictions from "@/components/dashboard/OrdinaryPredictions";
import PredictionsPageClient from "./PredictionsPageClient";

export default function PredictionsPageRouter() {
  const role = useAuthStore((s) => s.user?.role);

  if (isAnalystRole(role)) {
    return <PredictionsPageClient />;
  }

  return <OrdinaryPredictions />;
}