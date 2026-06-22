"use client";

import { useCallback, useEffect, useState } from "react";
import { Target, Loader2, RefreshCw } from "lucide-react";
import { adminIntelligenceAPI } from "@/lib/api";
import { toast } from "@/lib/feedback";
import PageLoadError from "@/components/ui/PageLoadError";

export default function AdminIntelligencePage() {
  const [settings, setSettings] = useState<Record<string, unknown>>({});
  const [retraining, setRetraining] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const [s, r] = await Promise.all([
        adminIntelligenceAPI.getSettings(),
        adminIntelligenceAPI.getRetraining(),
      ]);
      setSettings(s.data);
      setRetraining(Array.isArray(r.data) ? r.data : []);
    } catch {
      setLoadError(true);
      toast.error("Failed to load intelligence settings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      const { data } = await adminIntelligenceAPI.updateSettings(settings);
      setSettings(data);
      toast.success("Settings saved.");
    } catch {
      toast.error("Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--text-muted)]" />
      </div>
    );
  }

  if (loadError) {
    return (
      <PageLoadError
        title="Failed to load intelligence settings"
        onRetry={() => void load()}
      />
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-[var(--text-primary)]">
          <Target className="h-6 w-6" /> Intelligence Configuration
        </h1>
        <p className="text-sm text-[var(--text-muted)]">
          Forecast configuration, retraining settings, and accuracy thresholds
        </p>
      </div>

      <div className="glass-card rounded-xl hover:transform-none p-5 space-y-4">
        <h2 className="text-sm font-semibold">Forecast & Model Settings</h2>

        <label className="flex items-center justify-between text-sm">
          <span>Accuracy Alert Threshold (%)</span>
          <input
            type="number"
            min={0}
            max={100}
            value={Number(settings.accuracy_threshold ?? 75)}
            onChange={(e) =>
              setSettings((s) => ({ ...s, accuracy_threshold: Number(e.target.value) }))
            }
            className="w-24 rounded-lg border border-[var(--border-primary)] bg-transparent px-2 py-1 text-right"
          />
        </label>

        <label className="flex items-center justify-between text-sm">
          <span>Auto Retraining Enabled</span>
          <input
            type="checkbox"
            checked={Boolean(settings.auto_retrain_enabled ?? true)}
            onChange={(e) =>
              setSettings((s) => ({ ...s, auto_retrain_enabled: e.target.checked }))
            }
          />
        </label>

        <label className="flex items-center justify-between text-sm">
          <span>Retrain Schedule (hours)</span>
          <input
            type="number"
            min={1}
            max={720}
            value={Number(settings.retrain_schedule_hours ?? 168)}
            onChange={(e) =>
              setSettings((s) => ({ ...s, retrain_schedule_hours: Number(e.target.value) }))
            }
            className="w-24 rounded-lg border border-[var(--border-primary)] bg-transparent px-2 py-1 text-right"
          />
        </label>

        <label className="flex items-center justify-between text-sm">
          <span>News API Integration</span>
          <input
            type="checkbox"
            checked={Boolean(settings.news_api_enabled ?? true)}
            onChange={(e) =>
              setSettings((s) => ({ ...s, news_api_enabled: e.target.checked }))
            }
          />
        </label>

        <label className="flex items-center justify-between text-sm">
          <span>Sentiment Weight (0–1)</span>
          <input
            type="number"
            min={0}
            max={1}
            step={0.05}
            value={Number(settings.sentiment_weight ?? 0.15)}
            onChange={(e) =>
              setSettings((s) => ({ ...s, sentiment_weight: Number(e.target.value) }))
            }
            className="w-24 rounded-lg border border-[var(--border-primary)] bg-transparent px-2 py-1 text-right"
          />
        </label>

        <label className="flex items-center justify-between text-sm">
          <span>Event Impact Weight (0–1)</span>
          <input
            type="number"
            min={0}
            max={1}
            step={0.05}
            value={Number(settings.event_impact_weight ?? 0.2)}
            onChange={(e) =>
              setSettings((s) => ({ ...s, event_impact_weight: Number(e.target.value) }))
            }
            className="w-24 rounded-lg border border-[var(--border-primary)] bg-transparent px-2 py-1 text-right"
          />
        </label>

        <button
          onClick={() => void save()}
          disabled={saving}
          className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm text-white"
        >
          {saving ? "Saving…" : "Save Settings"}
        </button>
      </div>

      <div className="glass-card rounded-xl hover:transform-none p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Retraining Recommendations</h2>
          <button onClick={() => void load()} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
        {retraining.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">No pending retraining recommendations.</p>
        ) : (
          <div className="space-y-3">
            {retraining.map((r) => (
              <div key={String(r.id)} className="rounded-lg border border-[var(--border-primary)] p-3">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{String(r.trigger_reason).replace(/_/g, " ")}</span>
                  <span className="capitalize text-[var(--text-muted)]">{String(r.priority)}</span>
                </div>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">{String(r.message)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}