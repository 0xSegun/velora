"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Calendar, Plus, Upload, Trash2, Loader2 } from "lucide-react";
import { intelligenceAPI, adminIntelligenceAPI } from "@/lib/api";
import { toast } from "@/lib/feedback";

interface EventRow {
  id: string;
  title: string;
  country: string;
  category: string;
  event_date: string;
  severity_score: number;
  economic_impact_score: number;
  description: string;
}

const CATEGORIES = [
  "interest_rate_decision", "monetary_policy", "exchange_rate_policy",
  "fuel_subsidy", "tax_reform", "budget_release", "public_spending",
  "trade_restriction", "oil_price_shock", "commodity_shock",
  "geopolitical_conflict", "election", "recession", "pandemic", "natural_disaster",
];

export default function AdminEconomicEventsPage() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    title: "",
    country: "NG",
    category: "monetary_policy",
    event_date: new Date().toISOString().slice(0, 10),
    severity_score: 5,
    economic_impact_score: 5,
    description: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await intelligenceAPI.listEvents({ per_page: 50 });
      setEvents((data.events ?? []) as EventRow[]);
    } catch {
      toast.error("Failed to load events.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    try {
      await adminIntelligenceAPI.createEvent(form);
      toast.success("Event created.");
      setShowForm(false);
      await load();
    } catch {
      toast.error("Failed to create event.");
    }
  };

  const remove = async (id: string) => {
    try {
      await adminIntelligenceAPI.deleteEvent(id);
      toast.success("Event deleted.");
      await load();
    } catch {
      toast.error("Failed to delete event.");
    }
  };

  const importCsv = async (file: File) => {
    try {
      const { data } = await adminIntelligenceAPI.importEvents(file);
      toast.success(`Imported ${data.imported} events.`);
      await load();
    } catch {
      toast.error("Import failed.");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--text-muted)]" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-[var(--text-primary)]">
            <Calendar className="h-6 w-6" /> Economic Events Management
          </h1>
          <p className="text-sm text-[var(--text-muted)]">
            Manage events that feed into TS-Transformer sequence generation
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-primary)] px-4 py-2 text-sm"
          >
            <Plus className="h-4 w-4" /> Add Event
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-primary)] px-4 py-2 text-sm"
          >
            <Upload className="h-4 w-4" /> Import CSV
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importCsv(f);
            }}
          />
        </div>
      </div>

      {showForm && (
        <div className="glass-card rounded-xl hover:transform-none p-5 space-y-3">
          <input
            placeholder="Title"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            className="w-full rounded-lg border border-[var(--border-primary)] bg-transparent px-3 py-2 text-sm"
          />
          <div className="grid gap-3 sm:grid-cols-3">
            <input
              placeholder="Country (NG)"
              value={form.country}
              onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
              className="rounded-lg border border-[var(--border-primary)] bg-transparent px-3 py-2 text-sm"
            />
            <select
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              className="rounded-lg border border-[var(--border-primary)] bg-transparent px-3 py-2 text-sm"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c.replace(/_/g, " ")}</option>
              ))}
            </select>
            <input
              type="date"
              value={form.event_date}
              onChange={(e) => setForm((f) => ({ ...f, event_date: e.target.value }))}
              className="rounded-lg border border-[var(--border-primary)] bg-transparent px-3 py-2 text-sm"
            />
          </div>
          <textarea
            placeholder="Description"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            className="w-full rounded-lg border border-[var(--border-primary)] bg-transparent px-3 py-2 text-sm"
            rows={2}
          />
          <button onClick={() => void create()} className="rounded-xl bg-[var(--text-primary)] px-4 py-2 text-sm text-[var(--bg-primary)]">
            Save Event
          </button>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-[var(--border-primary)]">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--border-primary)] bg-[var(--glass-bg)]">
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Country</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Impact</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id} className="border-b border-[var(--border-primary)]">
                <td className="px-4 py-3 font-medium">{e.title}</td>
                <td className="px-4 py-3">{e.country}</td>
                <td className="px-4 py-3 text-[var(--text-muted)]">{e.category.replace(/_/g, " ")}</td>
                <td className="px-4 py-3">{e.event_date}</td>
                <td className="px-4 py-3">{e.economic_impact_score}</td>
                <td className="px-4 py-3">
                  <button onClick={() => void remove(e.id)} className="text-[var(--text-muted)] hover:text-[var(--fin-negative)]">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}