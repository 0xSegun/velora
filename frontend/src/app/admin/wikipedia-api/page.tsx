"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Loader2,
  BookOpen,
  Play,
  RefreshCw,
  Save,
  Power,
  PowerOff,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import PageLoadError from "@/components/ui/PageLoadError";
import ToggleSwitch from "@/components/ui/ToggleSwitch";
import { wikipediaAPI, type WikipediaApiConfig, type WikipediaApiHealth } from "@/lib/api";
import { handleApiError } from "@/lib/errorHandler";
import { toast } from "@/lib/feedback";
import { formatDateTime } from "@/lib/dates";
import { apiHealthSentiment, sentimentClass } from "@/lib/financialColors";
import { runBackgroundSync } from "@/lib/syncPolling";

export default function WikipediaApiAdminPage() {
  const [config, setConfig] = useState<WikipediaApiConfig | null>(null);
  const [health, setHealth] = useState<WikipediaApiHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [toggling, setToggling] = useState(false);

  const [baseUrl, setBaseUrl] = useState("https://en.wikipedia.org/api/rest_v1");
  const [userAgent, setUserAgent] = useState("Velora/1.0 (economic-intelligence; contact@velora.app)");
  const [refreshInterval, setRefreshInterval] = useState("weekly");
  const [syncEnabled, setSyncEnabled] = useState(true);
  const [countryCodes, setCountryCodes] = useState("NG, US, GB, GH");
  const [economyTemplate, setEconomyTemplate] = useState("Economy_of_{wikipedia_name}");
  const [centralBankTemplate, setCentralBankTemplate] = useState("Central_Bank_of_{wikipedia_name}");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cfgRes, healthRes] = await Promise.all([
        wikipediaAPI.getConfig(),
        wikipediaAPI.getHealth(),
      ]);
      const cfg = cfgRes.data;
      setConfig(cfg);
      setHealth(healthRes.data);
      setBaseUrl(cfg.base_url);
      setUserAgent(cfg.user_agent);
      setRefreshInterval(cfg.refresh_interval);
      setSyncEnabled(cfg.sync_enabled);
      const sc = cfg.source_config ?? {};
      if (sc.country_codes?.length) setCountryCodes(sc.country_codes.join(", "));
      if (sc.economy_title_template) setEconomyTemplate(sc.economy_title_template);
      if (sc.central_bank_title_template) setCentralBankTemplate(sc.central_bank_title_template);
    } catch (err) {
      setError(handleApiError(err, "Failed to load Wikipedia API settings."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        base_url: baseUrl,
        user_agent: userAgent,
        refresh_interval: refreshInterval,
        sync_enabled: syncEnabled,
        source_config: {
          country_codes: countryCodes.split(",").map((c) => c.trim().toUpperCase()).filter(Boolean),
          economy_title_template: economyTemplate,
          central_bank_title_template: centralBankTemplate,
        },
      };
      const { data } = await wikipediaAPI.updateConfig(payload);
      setConfig(data);
      toast.success("Wikipedia API settings saved");
      const healthRes = await wikipediaAPI.getHealth();
      setHealth(healthRes.data);
    } catch (err) {
      handleApiError(err, "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const { data } = await wikipediaAPI.testConnection({ country_code: "NG" });
      if (data.success) toast.success(data.message);
      else toast.error(data.message);
    } catch (err) {
      handleApiError(err, "Connection test failed");
    } finally {
      setTesting(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await runBackgroundSync(
        wikipediaAPI.sync,
        wikipediaAPI.getHealth,
        {
          started: "Wikipedia sync started",
          complete: "Wikipedia sync complete",
          failed: "Wikipedia sync failed",
        },
        { maxWaitMs: 1_800_000 },
      );
      await load();
    } catch (err) {
      handleApiError(err, "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const handleToggle = async (enable: boolean) => {
    setToggling(true);
    try {
      const { data } = enable ? await wikipediaAPI.enable() : await wikipediaAPI.disable();
      setConfig(data);
      toast.success(enable ? "Wikipedia API enabled" : "Wikipedia API disabled");
      await load();
    } catch (err) {
      handleApiError(err, "Toggle failed");
    } finally {
      setToggling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--text-muted)]" />
      </div>
    );
  }

  if (error) return <PageLoadError description={error} onRetry={() => void load()} />;

  const status = health?.status ?? "inactive";
  const sentiment = apiHealthSentiment(status === "green" ? "healthy" : status);
  const StatusIcon = sentiment === "positive" ? CheckCircle2 : sentiment === "caution" ? AlertCircle : XCircle;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Integrations"
        title="Wikipedia API Settings"
        description="Sync economy and central bank summaries from Wikipedia for historical context in country intelligence reports."
        icon={BookOpen}
      />

      <motion.div className="glass-panel rounded-2xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <StatusIcon className="h-5 w-5" style={{ color: sentimentClass(sentiment) }} />
            <div>
              <p className="text-sm font-semibold text-[var(--text-primary)]">
                {health?.provider ?? "Wikipedia REST"} — {config?.is_active ? "Active" : "Inactive"}
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                {health?.last_sync
                  ? `Last sync ${formatDateTime(health.last_sync)}`
                  : "Never synced"}
                {health?.countries_synced != null &&
                  ` · ${health.countries_synced} countries cached`}
                {config?.source_config?.country_codes?.length
                  ? ` · ${config.source_config.country_codes.length} configured`
                  : ""}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {config?.is_active ? (
              <button
                type="button"
                disabled={toggling}
                onClick={() => void handleToggle(false)}
                className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm"
              >
                <PowerOff className="h-4 w-4" /> Disable
              </button>
            ) : (
              <button
                type="button"
                disabled={toggling}
                onClick={() => void handleToggle(true)}
                className="btn-primary inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm"
              >
                <Power className="h-4 w-4" /> Enable
              </button>
            )}
            <button
              type="button"
              disabled={syncing}
              onClick={() => void handleSync()}
              className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm"
            >
              {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Sync Now
            </button>
          </div>
        </div>
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="glass-panel space-y-4 rounded-2xl p-6">
          <h2 className="font-semibold text-[var(--text-primary)]">Connection</h2>
          <div>
            <label className="text-xs text-[var(--text-muted)]">Base URL</label>
            <input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              className="app-input mt-1 w-full rounded-xl px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-[var(--text-muted)]">User-Agent</label>
            <input
              value={userAgent}
              onChange={(e) => setUserAgent(e.target.value)}
              className="app-input mt-1 w-full rounded-xl px-3 py-2 text-sm"
            />
            <p className="mt-1 text-[10px] text-[var(--text-faint)]">
              Required by Wikipedia — identify Velora with contact info
            </p>
          </div>
          <div>
            <label className="text-xs text-[var(--text-muted)]">Refresh interval</label>
            <select
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(e.target.value)}
              className="app-input mt-1 w-full rounded-xl px-3 py-2 text-sm"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--text-muted)]">Automatic sync</span>
            <ToggleSwitch
              checked={syncEnabled}
              onChange={setSyncEnabled}
              aria-label="Automatic sync"
            />
          </div>
        </section>

        <section className="glass-panel space-y-4 rounded-2xl p-6">
          <h2 className="font-semibold text-[var(--text-primary)]">Page Templates</h2>
          <p className="text-xs text-[var(--text-muted)]">
            Wikipedia page title templates. Use {"{wikipedia_name}"} for the country name.
          </p>
          <div>
            <label className="text-xs text-[var(--text-muted)]">Countries (comma-separated ISO2)</label>
            <textarea
              value={countryCodes}
              onChange={(e) => setCountryCodes(e.target.value)}
              rows={2}
              className="app-input mt-1 w-full rounded-xl px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-[var(--text-muted)]">Economy page template</label>
            <input
              value={economyTemplate}
              onChange={(e) => setEconomyTemplate(e.target.value)}
              className="app-input mt-1 w-full rounded-xl px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-[var(--text-muted)]">Central bank page template</label>
            <input
              value={centralBankTemplate}
              onChange={(e) => setCentralBankTemplate(e.target.value)}
              className="app-input mt-1 w-full rounded-xl px-3 py-2 text-sm"
            />
          </div>
        </section>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={saving}
          onClick={() => void handleSave()}
          className="btn-primary inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Settings
        </button>
        <button
          type="button"
          disabled={testing}
          onClick={() => void handleTest()}
          className="inline-flex items-center gap-2 rounded-xl border px-5 py-2.5 text-sm"
        >
          {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          Test Connection
        </button>
      </div>
    </div>
  );
}