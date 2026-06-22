"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import {
  defaultHomeForRole,
  isAnalystOnlyDashboardPath,
  isAnalystRole,
  isOrdinaryUser,
} from "@/lib/roles";

interface RoleGuardProps {
  children: React.ReactNode;
  /** When set, only these roles may view (admin always allowed if includeAdmin) */
  allowed?: Array<"user" | "analyst" | "admin">;
  includeAdmin?: boolean;
}

/**
 * Client-side route guard for role-restricted dashboard areas.
 */
export default function RoleGuard({
  children,
  allowed,
  includeAdmin = true,
}: RoleGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const role = user?.role;

  useEffect(() => {
    if (!role) return;

    if (pathname.startsWith("/analyst") && isOrdinaryUser(role)) {
      router.replace("/access-denied");
      return;
    }

    if (pathname.startsWith("/dashboard") && role === "analyst" && pathname === "/dashboard") {
      router.replace("/analyst");
      return;
    }

    if (isOrdinaryUser(role) && isAnalystOnlyDashboardPath(pathname)) {
      router.replace("/access-denied");
      return;
    }

    if (allowed?.length) {
      const ok =
        allowed.includes(role as "user" | "analyst" | "admin") ||
        (includeAdmin && role === "admin");
      if (!ok) router.replace(defaultHomeForRole(role));
    }
  }, [role, pathname, router, allowed, includeAdmin]);

  return <>{children}</>;
}