"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  Globe,
  TrendingUp,
  TrendingDown,
  Minus,
  Search,
  ArrowUpDown,
  Loader2,
  AlertCircle,
  CheckSquare,
  Square,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  countriesAPI,
  economicDataAPI,
  exchangeRatesAPI,
  predictionsAPI,
  type ExchangeRateCountryData,
} from "@/lib/api";
import CountryComparePanel from "@/components/dashboard/CountryComparePanel";
import { COUNTRY_DIRECTORY, getCountryMeta } from "@/lib/countries";
import { getWorldCountry } from "@/lib/countryCatalog";
import { CountryFlag } from "@/components/ui/CountryFlag";
import { formatPercentage, getRiskColor } from "@/lib/utils";
import CurrencyDisplay from "@/components/ui/CurrencyDisplay";
import { formatCurrencyLabel } from "@/lib/currency";
import { inflationSentiment, gdpSentiment, sentimentClass } from "@/lib/financialColors";
import { MESSAGES, toast } from "@/lib/feedback";
import { handleApiError } from "@/lib/errorHandler";
import { formatDate } from "@/lib/dates";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import type { Prediction } from "@/types/prediction";

interface EconomicRecord {
  id: string;
  country_code: string;
  country_name: string;
  cpi: number | null;
  gdp_growth: number | null;
  interest_rate: number | null;
  exchange_rate: number | null;
  inflation_rate: number | null;
  data_date: string;
}

interface CountryRow {
  code: string;
  name: string;
  flag: string;
  region?: string | null;
  inflation_rate: number | null;
  cpi: number | null;
  gdp_growth: number | null;
  interest_rate: number | null;
  exchange_rate: number | null;
  data_date: string | null;
  trend: "up" | "down" | "stable" | null;
  risk: string | null;
  predicted_rate: number | null;
  deflation_probability: number | null;
}

interface CountryDetail {
  latest: EconomicRecord | null;
  historical: EconomicRecord[];
  prediction: Prediction | null;
  fx: ExchangeRateCountryData | null;
}

function getTrendIcon(trend: CountryRow["trend"]) {
  if (trend === "up") return <TrendingUp className="w-3 h-3" />;
  if (trend === "down") return <TrendingDown className="w-3 h-3" />;
  return <Minus className="w-3 h-3" />;
}

export default function CountriesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "inflation" | "risk">("inflation");
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [compareSelection, setCompareSelection] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countryRows, setCountryRows] = useState<CountryRow[]>([]);
  const [detail, setDetail] = useState<CountryDetail | null>(null);
  const [predicting, setPredicting] = useState(false);

  const loadCountries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [countriesPayload, economicRes] = await Promise.all([
        countriesAPI.list(),
        economicDataAPI.getLatest(),
      ]);

      const records = (Array.isArray(economicRes.data) ? economicRes.data : []) as EconomicRecord[];
      const economicByCode = new Map<string, EconomicRecord>();
      for (const record of records) {
        economicByCode.set(record.country_code, record);
      }

      // Build full list from local directory for all countries, overlay API data
      const rows: CountryRow[] = COUNTRY_DIRECTORY.map((meta) => {
        const apiCountry = countriesPayload.countries.find((c: any) => c.code === meta.code);
        const econ = economicByCode.get(meta.code);
        return {
          code: meta.code,
          name: apiCountry?.name || meta.name,
          flag: apiCountry?.flag || meta.flag,
          region: apiCountry?.region ?? getWorldCountry(meta.code)?.region ?? null,
          inflation_rate: econ?.inflation_rate ?? (apiCountry?.inflation_rate ?? null),
          cpi: econ?.cpi ?? null,
          gdp_growth: econ?.gdp_growth ?? (apiCountry?.gdp ?? null),
          interest_rate: econ?.interest_rate ?? (apiCountry?.interest_rate ?? null),
          exchange_rate: econ?.exchange_rate ?? (apiCountry?.exchange_rate ?? null),
          data_date: econ?.data_date ?? (apiCountry?.updated_at ?? null),
          trend: (apiCountry?.exchange_rate_trend as CountryRow["trend"]) ?? null,
          risk: null,
          predicted_rate: null,
          deflation_probability: null,
        };
      });

      setCountryRows(rows);
    } catch {
      setError("Unable to load country data. Please try again later.");
      setCountryRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCountryDetail = useCallback(async (code: string) => {
    setDetailLoading(true);
    try {
      const [econRes, predRes, fxRes] = await Promise.allSettled([
        economicDataAPI.getByCountry(code),
        predictionsAPI.getByCountry(code),
        exchangeRatesAPI.getByCountry(code),
      ]);

      let latest: EconomicRecord | null = null;
      let historical: EconomicRecord[] = [];

      if (econRes.status === "fulfilled") {
        const econ = econRes.value.data as {
          latest?: EconomicRecord;
          historical?: EconomicRecord[];
        };
        latest = econ.latest ?? null;
        historical = econ.historical ?? [];
      }

      let prediction: Prediction | null = null;
      if (predRes.status === "fulfilled") {
        const predData = predRes.value.data as { predictions?: Prediction[] };
        prediction = predData.predictions?.[0] ?? null;
      }

      let fx: ExchangeRateCountryData | null = null;
      if (fxRes.status === "fulfilled") {
        fx = fxRes.value.data as ExchangeRateCountryData;
      }

      setDetail({ latest, historical, prediction, fx });

      if (prediction) {
        setCountryRows((prev) =>
          prev.map((row) =>
            row.code === code
              ? {
                  ...row,
                  trend: (prediction!.trend_direction as CountryRow["trend"]) ?? null,
                  risk: prediction!.risk_level ?? null,
                  predicted_rate: prediction!.inflation_rate ?? null,
                  deflation_probability: prediction!.deflation_probability ?? null,
                }
              : row,
          ),
        );
      }
    } catch {
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCountries();
  }, [loadCountries]);

  useEffect(() => {
    const countryParam = searchParams.get("country");
    const compareParam = searchParams.get("compare");
    if (countryParam) setSelectedCountry(countryParam.toUpperCase());
    if (compareParam) {
      const codes = compareParam
        .split(",")
        .map((c) => c.trim().toUpperCase())
        .filter(Boolean);
      if (codes.length > 0) setCompareSelection(codes);
    }
  }, [searchParams]);

  useEffect(() => {
    if (selectedCountry) {
      loadCountryDetail(selectedCountry);
    } else {
      setDetail(null);
    }
  }, [selectedCountry, loadCountryDetail]);

  const riskOrder: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };

  const filtered = useMemo(() => {
    return countryRows
      .filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.code.toLowerCase().includes(search.toLowerCase()),
      )
      .sort((a, b) => {
        if (sortBy === "name") return a.name.localeCompare(b.name);
        if (sortBy === "inflation") {
          return (b.inflation_rate ?? -1) - (a.inflation_rate ?? -1);
        }
        if (sortBy === "risk") {
          return (riskOrder[b.risk ?? ""] ?? 0) - (riskOrder[a.risk ?? ""] ?? 0);
        }
        return 0;
      });
  }, [countryRows, search, sortBy]);

  const selected = countryRows.find((c) => c.code === selectedCountry);

  const compareOptions = useMemo(
    () =>
      countryRows.map((c) => ({
        code: c.code,
        name: c.name,
        flag: c.flag,
        inflation_rate: c.inflation_rate,
        gdp_growth: c.gdp_growth,
        interest_rate: c.interest_rate,
      })),
    [countryRows],
  );

  const toggleCompare = (code: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCompareSelection((prev) => {
      if (prev.includes(code)) return prev.filter((c) => c !== code);
      if (prev.length >= 10) return prev;
      return [...prev, code];
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--text-muted)]" />
      </div>
    );
  }

  if (!loading && countryRows.length === 0) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <PageHeader
          title="Country Analysis"
          description="Compare inflation metrics across countries"
          icon={Globe}
        />
        <EmptyState
          variant="warning"
          title="No country data available"
          description={MESSAGES.predictions.noData}
          action={
            <button
              onClick={loadCountries}
              className="px-4 py-2 text-sm rounded-xl bg-[var(--accent-faint)] border border-[var(--border-hover)] text-[var(--text-primary)] hover:bg-[var(--glass-bg-hover)] transition"
            >
              Retry
            </button>
          }
        />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <PageHeader
        title="Country Analysis"
        description="Compare inflation metrics across countries"
        icon={Globe}
      />

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-[var(--border-primary)] bg-[var(--accent-faint)] px-4 py-3 text-sm text-[var(--text-muted)]">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Search & Sort */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
          <input
            id="country-search"
            type="text"
            placeholder="Search countries..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[var(--accent-faint)] border border-[var(--border-hover)] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-faint)] focus:border-[var(--border-active)] transition"
          />
        </div>
        <div className="flex gap-2">
          {(["inflation", "name", "risk"] as const).map((s) => (
            <button
              key={s}
              id={`sort-${s}`}
              onClick={() => setSortBy(s)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs rounded-xl transition ${
                sortBy === s
                  ? "bg-[var(--accent-faint)] text-[var(--text-primary)] border border-[var(--border-active)]"
                  : "bg-[var(--accent-faint)] text-[var(--text-muted)] border border-[var(--border-hover)] hover:bg-[var(--glass-bg-hover)]"
              }`}
            >
              <ArrowUpDown className="w-3 h-3" />
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <CountryComparePanel
        countries={compareOptions}
        selection={compareSelection}
        onSelectionChange={setCompareSelection}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Country List */}
        <div className="lg:col-span-2 space-y-3">
          {filtered.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No matching countries"
              description="Try adjusting your search query."
            />
          ) : (
            filtered.map((c, i) => (
              <motion.div
                key={c.code}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className={`rounded-xl border p-4 transition-all ${
                  selectedCountry === c.code
                    ? "bg-[var(--accent-faint)] border-[var(--border-active)]"
                    : "bg-[var(--glass-bg)] border-[var(--border-primary)] hover:bg-[var(--glass-bg-hover)] hover:border-[var(--border-hover)]"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div
                    className="flex items-center gap-3 flex-1 cursor-pointer min-w-0"
                    onClick={() => setSelectedCountry(c.code)}
                  >
                    <CountryFlag code={c.code} size="lg" title={c.name} />
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-[var(--text-primary)] truncate">
                        {c.name}
                      </h3>
                      {c.region ? (
                        <p className="text-xs text-[var(--text-muted)]">{c.region}</p>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => toggleCompare(c.code, e)}
                      title={compareSelection.includes(c.code) ? "Remove from comparison" : "Add to comparison"}
                      className={`flex items-center gap-1 px-2 py-1 text-[10px] rounded-lg border transition ${
                        compareSelection.includes(c.code)
                          ? "bg-[var(--accent-faint)] border-[var(--border-active)] text-[var(--text-primary)]"
                          : "border-[var(--border-primary)] text-[var(--text-muted)] hover:border-[var(--border-hover)]"
                      }`}
                    >
                      {compareSelection.includes(c.code) ? (
                        <CheckSquare className="w-3 h-3" />
                      ) : (
                        <Square className="w-3 h-3" />
                      )}
                      {compareSelection.includes(c.code) ? "In compare" : "Add"}
                    </button>
                    <div className="text-right">
                      <p className="text-lg font-bold text-[var(--text-primary)]">
                        {c.inflation_rate != null
                          ? formatPercentage(c.inflation_rate)
                          : "—"}
                      </p>
                      <p className="text-xs text-[var(--text-muted)]">Inflation</p>
                    </div>
                    {c.trend && (
                      <div className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-[var(--accent-faint)] text-[var(--text-muted)]">
                        {getTrendIcon(c.trend)}
                        {c.trend}
                      </div>
                    )}
                    {c.risk && (
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium bg-[var(--accent-faint)] ${getRiskColor(c.risk)}`}
                      >
                        {c.risk}
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>

        {/* Country Detail Panel */}
        <div className="lg:col-span-1">
          {selected ? (
            <motion.div
              key={selected.code}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="rounded-xl bg-[var(--glass-bg)] border border-[var(--border-primary)] p-6 sticky top-24"
            >
              {detailLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-[var(--text-muted)]" />
                </div>
              ) : (
                <>
                  <div className="text-center mb-6">
                    <CountryFlag code={selected.code} size="xl" title={selected.name} className="mx-auto" />
                    <h2 className="text-xl font-bold text-[var(--text-primary)] mt-2">
                      {selected.name}
                    </h2>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      Currency: {formatCurrencyLabel(selected.code)}
                    </p>
                    <div className="mt-2 flex justify-center">
                      <CurrencyDisplay
                        countryCode={selected.code}
                        rate={detail?.fx?.exchange_rate ?? detail?.latest?.exchange_rate}
                        currencyCode={detail?.fx?.currency_code}
                        variant="block"
                        isStale={detail?.fx?.is_stale}
                        staleMessage={detail?.fx?.stale_message}
                        change24h={detail?.fx?.change_24h}
                        change7d={detail?.fx?.change_7d}
                        trend={detail?.fx?.trend}
                      />
                    </div>
                    {detail?.fx?.last_updated && (
                      <p className="mt-1 text-[10px] text-[var(--text-faint)]">
                        FX updated {formatDate(detail.fx.last_updated)}
                      </p>
                    )}
                    {detail?.prediction?.risk_level && (
                      <span
                        className={`inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--accent-faint)] ${getRiskColor(detail.prediction.risk_level)}`}
                      >
                        {detail.prediction.risk_level} risk
                      </span>
                    )}
                  </div>

                  <div className="space-y-4">
                    {[
                      {
                        label: "Current Inflation",
                        value:
                          detail?.latest?.inflation_rate != null
                            ? formatPercentage(detail.latest.inflation_rate)
                            : selected.inflation_rate != null
                              ? formatPercentage(selected.inflation_rate)
                              : "—",
                      },
                      {
                        label: "Predicted Rate",
                        value:
                          detail?.prediction?.inflation_rate != null
                            ? formatPercentage(detail.prediction.inflation_rate)
                            : "—",
                      },
                      {
                        label: "Deflation Risk",
                        value:
                          detail?.prediction?.deflation_probability != null
                            ? formatPercentage(
                                detail.prediction.deflation_probability * 100,
                                1,
                              )
                            : "—",
                      },
                      {
                        label: "CPI Index",
                        value:
                          detail?.latest?.cpi != null
                            ? detail.latest.cpi.toFixed(1)
                            : "—",
                      },
                      {
                        label: "GDP Growth",
                        value:
                          detail?.latest?.gdp_growth != null
                            ? formatPercentage(detail.latest.gdp_growth)
                            : "—",
                      },
                      {
                        label: "Interest Rate",
                        value:
                          detail?.latest?.interest_rate != null
                            ? formatPercentage(detail.latest.interest_rate)
                            : "—",
                      },
                      {
                        label: "Exchange Rate (USD)",
                        value: "—",
                      },
                      {
                        label: "Data Date",
                        value: detail?.latest?.data_date
                          ? formatDate(detail.latest.data_date)
                          : selected.data_date
                            ? formatDate(selected.data_date)
                            : "—",
                      },
                    ].map((item) => {
                      const numericVal = parseFloat(String(item.value));
                      let color = "var(--text-primary)";
                      if (item.label.includes("Inflation") && !Number.isNaN(numericVal)) {
                        color = sentimentClass(inflationSentiment(numericVal));
                      } else if (item.label.includes("GDP") && !Number.isNaN(numericVal)) {
                        color = sentimentClass(gdpSentiment(numericVal));
                      } else if (item.label.includes("Exchange")) {
                        return (
                          <div key={item.label} className="py-2 border-b border-[var(--border-primary)]">
                            <span className="text-xs text-[var(--text-muted)]">{item.label}</span>
                            <div className="mt-1">
                              <CurrencyDisplay
                                countryCode={selected.code}
                                rate={detail?.fx?.exchange_rate ?? detail?.latest?.exchange_rate}
                                currencyCode={detail?.fx?.currency_code}
                                variant="block"
                                isStale={detail?.fx?.is_stale}
                                staleMessage={detail?.fx?.stale_message}
                                change24h={detail?.fx?.change_24h}
                                change7d={detail?.fx?.change_7d}
                                trend={detail?.fx?.trend}
                              />
                            </div>
                          </div>
                        );
                      }
                      return (
                        <div
                          key={item.label}
                          className="flex justify-between items-center py-2 border-b border-[var(--border-primary)]"
                        >
                          <span className="text-xs text-[var(--text-muted)]">{item.label}</span>
                          <span className="text-sm font-semibold" style={{ color }}>
                            {item.value}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {!detail?.prediction && !detail?.latest && (
                    <p className="mt-4 text-xs text-center text-[var(--text-muted)]">
                      No detailed data available for this country.
                    </p>
                  )}

                  <button
                    type="button"
                    id="predict-selected-country"
                    disabled={predicting}
                    onClick={async () => {
                      setPredicting(true);
                      try {
                        const { data } = await predictionsAPI.forecast({
                          country_code: selected.code,
                          forecast_horizon: 6,
                          input_data: {},
                        });
                        toast.success(`Forecast ready for ${selected.name}`);
                        router.push(`/dashboard/predictions/${data.id}`);
                      } catch (err) {
                        handleApiError(err, "Generate Prediction", MESSAGES.network.generic);
                      } finally {
                        setPredicting(false);
                      }
                    }}
                    className="w-full mt-6 flex items-center justify-center gap-2 px-4 py-2.5 bg-[var(--accent)] text-white rounded-xl text-sm font-semibold hover:opacity-90 transition disabled:opacity-60"
                  >
                    {predicting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Globe className="w-4 h-4" />
                    )}
                    {predicting ? "Generating..." : "Generate Prediction"}
                  </button>
                </>
              )}
            </motion.div>
          ) : (
            <div className="rounded-xl bg-[var(--glass-bg)] border border-[var(--border-primary)] p-8 text-center">
              <Globe className="w-10 h-10 text-[var(--text-faint)] mx-auto mb-3" />
              <p className="text-sm text-[var(--text-muted)]">
                Select a country to view detailed metrics
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}