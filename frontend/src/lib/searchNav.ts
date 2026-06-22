import type { SearchGroup, SearchResultItem } from "@/types/search";

export interface NavSearchItem {
  id: string;
  title: string;
  subtitle?: string;
  href: string;
  keywords?: string[];
}

/** Simplified navigation for ordinary users */
export const ORDINARY_NAV_ITEMS: NavSearchItem[] = [
  { id: "nav-overview", title: "Overview", href: "/dashboard", keywords: ["home", "dashboard"] },
  { id: "nav-predictions", title: "Predictions", href: "/dashboard/predictions", keywords: ["forecast", "inflation"] },
  { id: "nav-countries", title: "My Countries", href: "/dashboard/countries", keywords: ["economy", "country"] },
  { id: "nav-intelligence-hub", title: "Intelligence Hub", href: "/dashboard/intelligence-hub", keywords: ["intelligence", "forecast", "risk", "explainability"] },
  { id: "nav-news", title: "Economic News", href: "/dashboard/news", keywords: ["news", "headlines"] },
  { id: "nav-reports", title: "Reports", href: "/dashboard/reports", keywords: ["pdf", "export"] },
  { id: "nav-notifications", title: "Notifications", href: "/dashboard/notifications", keywords: ["alerts"] },
  { id: "nav-help", title: "Help Center", href: "/dashboard/help", keywords: ["learn", "education", "inflation"] },
  { id: "nav-profile", title: "Profile", href: "/dashboard/profile", keywords: ["account"] },
  { id: "nav-settings", title: "Settings", href: "/dashboard/settings", keywords: ["preferences"] },
];

/** Professional workspace navigation for analysts */
export const ANALYST_NAV_ITEMS: NavSearchItem[] = [
  { id: "analyst-overview", title: "Overview", href: "/analyst", keywords: ["home", "intelligence"] },
  { id: "analyst-intelligence-hub", title: "Intelligence Hub", href: "/analyst/intelligence-hub", keywords: ["intelligence", "backtest", "warnings", "regime", "nlq"] },
  { id: "analyst-predictions", title: "Predictions", href: "/analyst/predictions", keywords: ["forecast", "inflation"] },
  { id: "analyst-analytics", title: "Analytics", href: "/analyst/analytics", keywords: ["charts", "cpi", "gdp"] },
  { id: "analyst-countries", title: "Countries", href: "/analyst/countries", keywords: ["economy", "compare"] },
  { id: "analyst-events", title: "Economic Events", href: "/analyst/events", keywords: ["calendar", "events"] },
  { id: "analyst-research", title: "Research Center", href: "/analyst/research", keywords: ["papers", "publications"] },
  { id: "analyst-reports", title: "Reports", href: "/analyst/reports", keywords: ["pdf", "export"] },
  { id: "analyst-scenarios", title: "Scenario Simulator", href: "/analyst/scenarios", keywords: ["simulation", "what-if"] },
  { id: "analyst-accuracy", title: "Accuracy", href: "/analyst/accuracy", keywords: ["metrics", "performance"] },
  { id: "analyst-explainability", title: "Explainable AI", href: "/analyst/explainability", keywords: ["model", "transformer", "attention"] },
  { id: "analyst-models", title: "Model Performance", href: "/analyst/models", keywords: ["training", "ts-transformer"] },
  { id: "analyst-data-sources", title: "Data Sources", href: "/analyst/data-sources", keywords: ["fred", "datasets"] },
  { id: "analyst-api-status", title: "API Status", href: "/analyst/api-status", keywords: ["health", "integrations"] },
  { id: "analyst-notifications", title: "Notifications", href: "/analyst/notifications", keywords: ["alerts"] },
];

/** @deprecated Use ORDINARY_NAV_ITEMS or ANALYST_NAV_ITEMS based on role */
export const DASHBOARD_NAV_ITEMS: NavSearchItem[] = [
  ...ORDINARY_NAV_ITEMS,
  ...ANALYST_NAV_ITEMS.filter((item) => !item.href.startsWith("/analyst")),
];

export const ADMIN_NAV_ITEMS: NavSearchItem[] = [
  { id: "admin-dashboard", title: "Admin Dashboard", href: "/admin", keywords: ["overview"] },
  { id: "admin-control", title: "Control Center", href: "/admin/control", keywords: ["profile", "security"] },
  { id: "admin-api", title: "API Configuration", href: "/admin/api-config", keywords: ["integrations"] },
  { id: "admin-fred", title: "FRED API Settings", href: "/admin/fred-api", keywords: ["fred", "federal reserve", "cpi", "gdp", "economic indicators"] },
  { id: "admin-news-api", title: "News API Settings", href: "/admin/news-api", keywords: ["news", "reuters", "bloomberg", "headlines", "newsapi"] },
  { id: "admin-imf-api", title: "IMF API Settings", href: "/admin/imf-api", keywords: ["imf", "gdp", "inflation", "debt", "world economic outlook"] },
  { id: "admin-world-bank-api", title: "World Bank API", href: "/admin/world-bank-api", keywords: ["world bank", "open data", "gdp", "inflation"] },
  { id: "admin-trading-economics-api", title: "Trading Economics API", href: "/admin/trading-economics-api", keywords: ["trading economics", "macro", "indicators"] },
  { id: "admin-wikipedia-api", title: "Wikipedia API", href: "/admin/wikipedia-api", keywords: ["wikipedia", "context", "economy", "central bank"] },
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