import {
  countriesAPI,
  intelligenceAPI,
  predictionsAPI,
  reportsAPI,
} from "@/lib/api";
import { getCountryMeta } from "@/lib/countries";
import type { Prediction } from "@/types/prediction";
import type { Report } from "@/types/report";
import type { SearchGroup, SearchResultItem } from "@/types/search";

function matches(q: string, ...parts: Array<string | null | undefined>): boolean {
  const needle = q.toLowerCase();
  return parts.some((part) => part?.toLowerCase().includes(needle));
}

export async function fallbackSearch(
  query: string,
  limit = 5,
): Promise<SearchGroup[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const groups: SearchGroup[] = [];

  const [countriesRes, reportsRes, predictionsRes, researchRes] =
    await Promise.allSettled([
      countriesAPI.list({ search: q, per_page: limit }),
      reportsAPI.list({ per_page: 100 }),
      predictionsAPI.getHistory({ per_page: 100 }),
      intelligenceAPI.listResearch({ search: q }),
    ]);

  if (countriesRes.status === "fulfilled") {
    const items: SearchResultItem[] = countriesRes.value.countries
      .slice(0, limit)
      .map((country) => ({
        id: country.id,
        type: "country",
        title: country.name,
        subtitle: country.code,
        href: `/dashboard/countries?country=${country.code}`,
        meta: "Country",
      }));
    if (items.length) {
      groups.push({ type: "country", label: "Countries", results: items });
    }
  }

  if (reportsRes.status === "fulfilled") {
    const reports = (reportsRes.value.data?.reports ?? []) as Report[];
    const items: SearchResultItem[] = reports
      .filter((report: Report) =>
        matches(q, report.title, report.summary, report.source, report.report_type),
      )
      .slice(0, limit)
      .map((report: Report) => ({
        id: report.id,
        type: "report",
        title: report.title,
        subtitle: report.source,
        href: `/dashboard/reports/${report.id}`,
        meta: report.report_type,
      }));
    if (items.length) {
      groups.push({ type: "report", label: "Reports", results: items });
    }
  }

  if (predictionsRes.status === "fulfilled") {
    const predictions = (predictionsRes.value.data?.predictions ?? []) as Prediction[];
    const items: SearchResultItem[] = predictions
      .filter((prediction: Prediction) => {
        const country = getCountryMeta(prediction.country_code);
        return matches(
          q,
          prediction.country_code,
          country.name,
          prediction.trend_direction,
          prediction.risk_level,
        );
      })
      .slice(0, limit)
      .map((prediction: Prediction) => ({
        id: prediction.id,
        type: "prediction",
        title: `${getCountryMeta(prediction.country_code).name} Forecast`,
        subtitle: `${prediction.inflation_rate.toFixed(2)}% · ${prediction.trend_direction}`,
        href: `/dashboard/predictions/${prediction.id}`,
        meta: "Prediction",
      }));
    if (items.length) {
      groups.push({ type: "prediction", label: "Predictions", results: items });
    }
  }

  if (researchRes.status === "fulfilled") {
    const publications =
      researchRes.value.data?.publications ??
      researchRes.value.data?.items ??
      [];
    const items: SearchResultItem[] = (Array.isArray(publications) ? publications : [])
      .slice(0, limit)
      .map((pub: { id: string; title: string; authors?: string; category?: string }) => ({
        id: String(pub.id),
        type: "research",
        title: pub.title,
        subtitle: pub.authors,
        href: "/dashboard/research",
        meta: pub.category,
      }));
    if (items.length) {
      groups.push({ type: "research", label: "Research", results: items });
    }
  }

  return groups;
}