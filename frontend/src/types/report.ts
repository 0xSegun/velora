export interface Report {
  id: string;
  title: string;
  summary: string;
  content: Record<string, unknown>;
  report_type: string;
  country_code: string | null;
  source: string;
  source_url: string | null;
  published_at: string;
  created_at: string;
  metadata_extra?: Record<string, unknown>;
}

export interface ReportList {
  reports: Report[];
  total: number;
  page: number;
  per_page: number;
}