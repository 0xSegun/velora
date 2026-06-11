export type SearchResultType =
  | "page"
  | "country"
  | "report"
  | "prediction"
  | "research"
  | "user"
  | "api_config";

export interface SearchResultItem {
  id: string;
  type: SearchResultType;
  title: string;
  subtitle?: string | null;
  href: string;
  meta?: string | null;
}

export interface SearchGroup {
  type: SearchResultType;
  label: string;
  results: SearchResultItem[];
}

export interface SearchResponse {
  query: string;
  groups: SearchGroup[];
  total: number;
}