"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { isAnalystRole } from "@/lib/roles";
import OrdinaryOverview from "@/components/dashboard/OrdinaryOverview";

export default function DashboardPage() {
  const router = useRouter();
  const role = useAuthStore((s) => s.user?.role);

  useEffect(() => {
    if (isAnalystRole(role)) {
      router.replace("/analyst");
    }
  }, [role, router]);

  if (isAnalystRole(role)) {
    return null;
  }

  return <OrdinaryOverview />;
}