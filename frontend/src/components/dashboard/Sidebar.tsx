"use client";

import { usePathname } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { isAnalystRole } from "@/lib/roles";
import OrdinarySidebar from "@/components/dashboard/OrdinarySidebar";
import AnalystSidebar from "@/components/dashboard/AnalystSidebar";

/** Role-aware sidebar for dashboard and analyst workspaces */
export default function Sidebar() {
  const pathname = usePathname();
  const role = useAuthStore((s) => s.user?.role);

  if (pathname.startsWith("/analyst") && isAnalystRole(role)) {
    return <AnalystSidebar />;
  }

  if (isAnalystRole(role)) {
    return <AnalystSidebar />;
  }

  return <OrdinarySidebar />;
}