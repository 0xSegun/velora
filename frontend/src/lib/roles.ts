export type UserRole = "user" | "analyst" | "admin";

export function isAnalystRole(role?: string | null): boolean {
  return role === "analyst" || role === "admin";
}

export function isAdminRole(role?: string | null): boolean {
  return role === "admin";
}

export function isOrdinaryUser(role?: string | null): boolean {
  return role === "user" || !role;
}

/** Post-login landing path by role */
export function defaultHomeForRole(role?: string | null): string {
  if (role === "admin") return "/admin";
  if (role === "analyst") return "/analyst";
  return "/dashboard";
}

/** Whether a signed-in user may open this path (post-login redirect guard) */
export function canAccessRoute(role?: string | null, pathname?: string | null): boolean {
  if (!role || !pathname) return false;
  if (pathname.startsWith("/admin")) return role === "admin";
  if (pathname.startsWith("/analyst")) return isAnalystRole(role);
  if (pathname.startsWith("/dashboard")) {
    if (isOrdinaryUser(role) && isAnalystOnlyDashboardPath(pathname)) return false;
    return true;
  }
  return true;
}

/** Analyst-only routes under /dashboard (legacy) — ordinary users are blocked */
export const ANALYST_ONLY_DASHBOARD_PATHS = [
  "/dashboard/intelligence",
  "/dashboard/explainability",
  "/dashboard/scenarios",
  "/dashboard/accuracy",
  "/dashboard/analytics",
  "/dashboard/research",
] as const;

export function isAnalystOnlyDashboardPath(pathname: string): boolean {
  return ANALYST_ONLY_DASHBOARD_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

export interface NavItemDef {
  label: string;
  href: string;
  icon: string;
}

export const ORDINARY_NAV = [
  { label: "Overview", href: "/dashboard", icon: "LayoutDashboard" },
  { label: "Predictions", href: "/dashboard/predictions", icon: "Brain" },
  { label: "My Countries", href: "/dashboard/countries", icon: "Globe" },
  { label: "Economic News", href: "/dashboard/news", icon: "Newspaper" },
  { label: "Reports", href: "/dashboard/reports", icon: "FileText" },
  { label: "Notifications", href: "/dashboard/notifications", icon: "Bell" },
  { label: "Help Center", href: "/dashboard/help", icon: "HelpCircle" },
] as const;

export const ANALYST_NAV = [
  { label: "Overview", href: "/analyst", icon: "LayoutDashboard" },
  { label: "Predictions", href: "/analyst/predictions", icon: "Brain" },
  { label: "Analytics", href: "/analyst/analytics", icon: "BarChart3" },
  { label: "Countries", href: "/analyst/countries", icon: "Globe" },
  { label: "Economic Events", href: "/analyst/events", icon: "Calendar" },
  { label: "Research Center", href: "/analyst/research", icon: "FlaskConical" },
  { label: "Reports", href: "/analyst/reports", icon: "FileText" },
  { label: "Scenario Simulator", href: "/analyst/scenarios", icon: "Target" },
  { label: "Accuracy", href: "/analyst/accuracy", icon: "Activity" },
  { label: "Explainable AI", href: "/analyst/explainability", icon: "Microscope" },
  { label: "Model Performance", href: "/analyst/models", icon: "Cpu" },
  { label: "Data Sources", href: "/analyst/data-sources", icon: "Database" },
  { label: "API Status", href: "/analyst/api-status", icon: "Plug" },
  { label: "Notifications", href: "/analyst/notifications", icon: "Bell" },
] as const;