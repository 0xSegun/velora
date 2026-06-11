import type { SearchGroup, SearchResultItem } from "@/types/search";

export interface NavSearchItem {
  id: string;
  title: string;
  subtitle?: string;
  href: string;
  keywords?: string[];
}

export const DASHBOARD_NAV_ITEMS: NavSearchItem[] = [
  { id: "nav-overview", title: "Overview", href: "/dashboard", keywords: ["home", "dashboard"] },
  { id: "nav-predictions", title: "Predictions", href: "/dashboard/predictions", keywords: ["forecast", "inflation"] },
  { id: "nav-intelligence", title: "Intelligence", href: "/dashboard/intelligence", keywords: ["risk", "news"] },
  { id: "nav-explainability", title: "Explainability", href: "/dashboard/explainability", keywords: ["model", "transformer"] },
  { id: "nav-scenarios", title: "Scenarios", href: "/dashboard/scenarios", keywords: ["simulation", "what-if"] },
  { id: "nav-accuracy", title: "Accuracy", href: "/dashboard/accuracy", keywords: ["metrics", "performance"] },
  { id: "nav-countries", title: "Countries", href: "/dashboard/countries", keywords: ["economy", "compare"] },
  { id: "nav-research", title: "Research", href: "/dashboard/research", keywords: ["papers", "publications"] },
  { id: "nav-reports", title: "Reports", href: "/dashboard/reports", keywords: ["pdf", "export"] },
  { id: "nav-notifications", title: "Notifications", href: "/dashboard/notifications", keywords: ["alerts"] },
  { id: "nav-profile", title: "Profile", href: "/dashboard/profile", keywords: ["account"] },
  { id: "nav-settings", title: "Settings", href: "/dashboard/settings", keywords: ["preferences"] },
  { id: "nav-analytics", title: "Analytics", href: "/dashboard/analytics", keywords: ["charts", "data"] },
];

export const ADMIN_NAV_ITEMS: NavSearchItem[] = [
  { id: "admin-dashboard", title: "Admin Dashboard", href: "/admin", keywords: ["overview"] },
  { id: "admin-control", title: "Control Center", href: "/admin/control", keywords: ["profile", "security"] },
  { id: "admin-api", title: "API Configuration", href: "/admin/api-config", keywords: ["integrations"] },
  { id: "admin-fx", title: "Exchange Rate API", href: "/admin/exchange-rate-api", keywords: ["currency", "forex"] },
  { id: "admin-economic", title: "Economic Data", href: "/admin/economic-data", keywords: ["fred", "sync"] },
  { id: "admin-auth", title: "Authentication", href: "/admin/authentication", keywords: ["oauth", "google"] },
  { id: "admin-users", title: "Users", href: "/admin/users", keywords: ["accounts", "roles"] },
  { id: "admin-cms", title: "CMS", href: "/admin/cms", keywords: ["content", "landing"] },
  { id: "admin-analytics", title: "Analytics", href: "/admin/analytics", keywords: ["traffic", "export"] },
  { id: "admin-branding", title: "Brand Assets", href: "/admin/branding", keywords: ["logo", "favicon", "fonts", "typography", "og image"] },
  { id: "admin-settings", title: "Settings", href: "/admin/settings", keywords: ["seo", "branding"] },
  { id: "admin-training", title: "Training Center", href: "/admin/training", keywords: ["models", "ml"] },
  { id: "admin-models", title: "Model Versions", href: "/admin/models", keywords: ["deploy"] },
  { id: "admin-events", title: "Economic Events", href: "/admin/economic-events", keywords: ["calendar"] },
  { id: "admin-intelligence", title: "Intelligence Config", href: "/admin/intelligence", keywords: ["risk"] },
  { id: "admin-research", title: "Research Mode", href: "/admin/research", keywords: ["papers"] },
];

function matchesQuery(item: NavSearchItem, query: string): boolean {
  const haystack = [
    item.title,
    item.subtitle ?? "",
    ...(item.keywords ?? []),
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

export function searchNavItems(
  query: string,
  items: NavSearchItem[],
  limit = 5,
): SearchResultItem[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];

  return items
    .filter((item) => matchesQuery(item, q))
    .slice(0, limit)
    .map((item) => ({
      id: item.id,
      type: "page" as const,
      title: item.title,
      subtitle: item.subtitle ?? "Navigate",
      href: item.href,
      meta: "Page",
    }));
}

export function mergeSearchGroups(
  apiGroups: SearchGroup[],
  pageResults: SearchResultItem[],
): SearchGroup[] {
  const groups = [...apiGroups];
  if (pageResults.length === 0) return groups;

  const pageGroup: SearchGroup = {
    type: "page",
    label: "Pages",
    results: pageResults,
  };

  const existingPageIndex = groups.findIndex((g) => g.type === "page");
  if (existingPageIndex >= 0) {
    groups[existingPageIndex] = {
      ...groups[existingPageIndex],
      results: [...pageResults, ...groups[existingPageIndex].results].slice(0, 5),
    };
    return groups;
  }

  return [pageGroup, ...groups];
}