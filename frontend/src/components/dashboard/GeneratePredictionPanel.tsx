"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import CountrySelect from "@/components/ui/CountrySelect";
import { countriesAPI, predictionsAPI } from "@/lib/api";
import { buildCountryOptions } from "@/lib/countryOptions";
import { handleApiError } from "@/lib/errorHandler";
import { MESSAGES, toast } from "@/lib/feedback";
import { getCountryMeta } from "@/lib/countries";
import type { Prediction } from "@/types/prediction";

export default function GeneratePredictionPanel({
  initialCountry = "NG",
  onGenerated,
  className = "",
}: {
  initialCountry?: string;
  onGenerated?: (prediction: Prediction) => void;
  className?: string;
}) {
  const router = useRouter();
  const [country, setCountry] = useState(initialCountry.toUpperCase());
  const [generating, setGenerating] = useState(false);
  const [loadingCountries, setLoadingCountries] = useState(true);
  const [countryOptions, setCountryOptions] = useState(
    buildCountryOptions([]),
  );

  const loadCountries = useCallback(async () => {
    setLoadingCountries(true);
    try {
      const first = await countriesAPI.list({ per_page: 500, page: 1 });
      let all = [...(first.countries ?? [])];
      const totalPages = Math.ceil((first.total ?? all.length) / (first.per_page || 500));
      if (totalPages > 1) {
        const rest = await Promise.all(
          Array.from({ length: totalPages - 1 }, (_, i) =>
            countriesAPI.list({ per_page: 500, page: i + 2 }),
          ),
        );
        for (const page of rest) {
          all = all.concat(page.countries ?? []);
        }
      }
      setCountryOptions(buildCountryOptions(all));
    } catch {
      setCountryOptions(buildCountryOptions([]));
    } finally {
      setLoadingCountries(false);
    }
  }, []);

  useEffect(() => {
    void loadCountries();
  }, [loadCountries]);

  useEffect(() => {
    setCountry(initialCountry.toUpperCase());
  }, [initialCountry]);

  const selectedMeta = useMemo(() => getCountryMeta(country), [country]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const { data } = await predictionsAPI.forecast({
        country_code: country,
        forecast_horizon: 6,
        input_data: {},
      });
      const prediction = data as Prediction;
      toast.success(`Forecast ready for ${selectedMeta.name}`);
      onGenerated?.(prediction);
      router.push(`/dashboard/predictions/${prediction.id}`);
    } catch (err) {
      handleApiError(err, "Generate Prediction", MESSAGES.network.generic);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div
      className={`rounded-xl border border-[var(--border-primary)] bg-[var(--accent-faint)] p-4 sm:p-5 ${className}`}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
            <Sparkles className="h-4 w-4 text-[var(--accent)]" />
            Generate Prediction
          </div>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Pick any country and run a 6-month TS-Transformer forecast instantly.
            Economic data is loaded automatically.
          </p>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <CountrySelect
            countries={countryOptions}
            value={country}
            onChange={setCountry}
            loading={loadingCountries}
            disabled={generating}
            className="w-full sm:min-w-[280px]"
          />
          <button
            type="button"
            onClick={() => void handleGenerate()}
            disabled={generating || loadingCountries}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              "Generate Prediction"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}