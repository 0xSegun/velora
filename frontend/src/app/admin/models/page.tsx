"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  GitBranch,
  CheckCircle2,
  Archive,
  Trash2,
  Zap,
  Brain,
  ChevronRight,
  X,
  TrendingUp,
  Calendar,
  Layers,
  Target,
  BarChart3,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useTrainingStore, ModelVersion } from "@/store/trainingStore";

/* ----- Custom Tooltip ----- */
const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload) return null;
  return (
    <div className="glass-card rounded-xl hover:transform-none p-3 shadow-xl">
      <p className="text-xs font-medium text-[var(--text-primary)] mb-1">
        {label}
      </p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="text-xs" style={{ color: entry.color }}>
          {entry.name}:{" "}
          {typeof entry.value === "number"
            ? entry.value.toFixed(2)
            : entry.value}
        </p>
      ))}
    </div>
  );
};

/* ----- Status config ----- */
const statusConfig = {
  active: {
    label: "Active",
    color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
    icon: Zap,
  },
  archived: {
    label: "Archived",
    color: "bg-slate-500/15 text-[var(--text-muted)] border-slate-500/20",
    icon: Archive,
  },
  draft: {
    label: "Draft",
    color: "bg-amber-500/15 text-amber-400 border-amber-500/20",
    icon: Layers,
  },
};

export default function ModelsPage() {
  const { models, activeModelId, setActiveModel, archiveModel, deleteModel } =
    useTrainingStore();
  const [selectedModel, setSelectedModel] = useState<ModelVersion | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Comparison chart data
  const chartData = [...models].reverse().map((m: any) => ({
    version: m.version,
    accuracy: m.accuracy,
    mae: m.mae,
    rmse: m.rmse,
  }));

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-neutral-700 to-neutral-500 shadow-[0_0_20px_rgba(255,255,255,0.08)]">
              <GitBranch size={20} className="text-[var(--text-primary)]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[var(--text-primary)]">
                Model Versions
              </h1>
              <p className="text-sm text-[var(--text-muted)]">
                {models.length} versions tracked
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Performance Comparison Chart */}
      {chartData.length > 1 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card rounded-xl hover:transform-none p-6"
        >
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
            <TrendingUp size={16} className="text-[var(--text-primary)]" />
            Performance Across Versions
          </h3>
          {mounted ? (
            <ResponsiveContainer
              width="100%"
              height={240}
              minWidth={0}
              minHeight={240}
            >
              <LineChart data={chartData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--border-primary)"
                />
                <XAxis
                  dataKey="version"
                  tick={{ fontSize: 11, fill: "var(--text-muted)" }}
                  axisLine={{ stroke: "var(--border-primary)" }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "var(--text-muted)" }}
                  axisLine={{ stroke: "var(--border-primary)" }}
                  domain={[80, 100]}
                />
                <Tooltip content={<ChartTooltip />} />
                <Line
                  type="monotone"
                  dataKey="accuracy"
                  stroke="var(--chart-primary)"
                  strokeWidth={2}
                  dot={{ r: 4, fill: "var(--chart-primary)" }}
                  name="Accuracy %"
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[240px] rounded-xl shimmer" aria-hidden />
          )}
        </motion.div>
      )}

      {/* Version Timeline */}
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-6 top-0 bottom-0 w-px bg-gradient-to-b from-neutral-600/50 via-[var(--text-faint)] to-transparent hidden lg:block" />

        <div className="space-y-4">
          {models.map((model: any, i: number) => {
            const active = model.id === activeModelId;
            const cfg = statusConfig[model.status as keyof typeof statusConfig];
            const StatusIcon = cfg.icon;

            return (
              <motion.div
                key={model.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="relative"
              >
                {/* Timeline dot */}
                <div className="absolute left-4 top-6 hidden lg:flex h-4 w-4 items-center justify-center">
                  <div
                    className={`h-3 w-3 rounded-full ${active ? "bg-neutral-600 shadow-[0_0_10px_rgba(255,255,255,0.12)]" : "bg-slate-600"}`}
                  />
                </div>

                <div
                  className={`lg:ml-14 rounded-xl border p-5 transition cursor-pointer ${
                    active
                      ? "border-[var(--border-active)] bg-neutral-600/[0.04] shadow-[0_0_30px_rgba(139,92,246,0.08)]"
                      : "border-[var(--border-primary)] bg-[var(--glass-bg)] hover:border-[var(--border-hover)]"
                  }`}
                  onClick={() => setSelectedModel(model)}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    {/* Left - Model info */}
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-neutral-700 to-neutral-500">
                        <Brain
                          size={20}
                          className="text-[var(--text-primary)]"
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-semibold text-[var(--text-primary)]">
                            TS-Transformer {model.version}
                          </h3>
                          {active && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--accent-faint)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-primary)]">
                              <Zap size={10} /> Active
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          <span
                            className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold ${cfg.color}`}
                          >
                            {cfg.label}
                          </span>
                          <span className="text-xs text-[var(--text-muted)] flex items-center gap-1">
                            <Calendar size={10} />
                            {new Date(model.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right - Metrics */}
                    <div className="flex items-center gap-4">
                      <div className="grid grid-cols-4 gap-3">
                        <div className="text-center">
                          <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                            Acc
                          </p>
                          <p className="text-sm font-bold text-emerald-400">
                            {model.accuracy}%
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                            MAE
                          </p>
                          <p className="text-sm font-bold text-[var(--text-primary)]">
                            {model.mae}
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                            RMSE
                          </p>
                          <p className="text-sm font-bold text-[var(--text-primary)]">
                            {model.rmse}
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                            R2
                          </p>
                          <p className="text-sm font-bold text-[var(--text-primary)]">
                            {model.r2?.toFixed(3)}
                          </p>
                        </div>
                      </div>
                      <ChevronRight
                        size={16}
                        className="text-[var(--text-faint)]"
                      />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-4 flex items-center gap-2">
                    {!active && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveModel(model.id);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent-faint)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] transition hover:bg-[var(--accent-faint)]"
                      >
                        <CheckCircle2 size={13} /> Deploy
                      </button>
                    )}
                    {!active && model.status !== "archived" && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          archiveModel(model.id);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--glass-bg-hover)] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] transition hover:bg-[var(--glass-bg-hover)]"
                      >
                        <Archive size={13} /> Archive
                      </button>
                    )}
                    {!active && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirm(model.id);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--glass-bg-hover)] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] transition hover:bg-red-500/10 hover:text-red-400"
                      >
                        <Trash2 size={13} /> Delete
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Model Detail Drawer */}
      <AnimatePresence>
        {selectedModel && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
              onClick={() => setSelectedModel(null)}
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md overflow-y-auto border-l border-[var(--border-primary)] bg-[var(--bg-secondary)] p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-[var(--text-primary)]">
                  Model Details
                </h2>
                <button
                  onClick={() => setSelectedModel(null)}
                  className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--accent-faint)] hover:text-[var(--text-primary)]"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Model header */}
              <div className="flex items-center gap-3 mb-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-neutral-700 to-neutral-500 shadow-[0_0_20px_rgba(255,255,255,0.08)]">
                  <Brain size={24} className="text-[var(--text-primary)]" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                    TS-Transformer {selectedModel.version}
                  </h3>
                  <p className="text-xs text-[var(--text-muted)]">
                    {selectedModel.parameters} parameters
                  </p>
                </div>
              </div>

              {/* Performance Metrics */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                {[
                  {
                    label: "Accuracy",
                    value: `${selectedModel.accuracy}%`,
                    color: "text-emerald-400",
                  },
                  {
                    label: "MAE",
                    value: selectedModel.mae.toFixed(3),
                    color: "text-[var(--text-primary)]",
                  },
                  {
                    label: "RMSE",
                    value: selectedModel.rmse.toFixed(3),
                    color: "text-[var(--text-primary)]",
                  },
                  {
                    label: "R-Squared",
                    value: selectedModel.r2?.toFixed(4),
                    color: "text-[var(--text-primary)]",
                  },
                  {
                    label: "Epochs",
                    value: selectedModel.epochs,
                    color: "text-[var(--text-primary)]",
                  },
                  {
                    label: "Created",
                    value: new Date(
                      selectedModel.createdAt,
                    ).toLocaleDateString(),
                    color: "text-[var(--text-primary)]",
                  },
                ].map((m: any, i: number) => (
                  <div
                    key={i}
                    className="rounded-lg bg-[var(--glass-bg)] border border-[var(--border-primary)] p-3"
                  >
                    <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                      {m.label}
                    </p>
                    <p className={`mt-0.5 text-lg font-bold ${m.color}`}>
                      {m.value}
                    </p>
                  </div>
                ))}
              </div>

              {/* Architecture Config */}
              <div className="glass-card rounded-xl hover:transform-none p-4 mb-6">
                <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
                  <Target size={14} className="text-[var(--text-primary)]" />
                  Architecture Config
                </h4>
                <div className="space-y-2">
                  {[
                    ["Architecture", "TS-Transformer"],
                    ["Attention Heads", selectedModel.config.attentionHeads],
                    ["Embedding Dim", selectedModel.config.embeddingDim],
                    ["Sequence Length", selectedModel.config.sequenceLength],
                    [
                      "Prediction Horizon",
                      selectedModel.config.predictionHorizon,
                    ],
                    ["Dropout", selectedModel.config.dropoutRate],
                    ["Optimizer", selectedModel.config.optimizer],
                    ["Learning Rate", selectedModel.config.learningRate],
                    ["Batch Size", selectedModel.config.batchSize],
                  ].map(([key, val]: any, i: number) => (
                    <div
                      key={i}
                      className="flex items-center justify-between text-xs"
                    >
                      <span className="text-[var(--text-muted)]">{key}</span>
                      <span className="font-medium text-[var(--text-primary)]">
                        {val}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Attention Heatmap Preview */}
              {selectedModel.attentionWeights && (
                <div className="glass-card rounded-xl hover:transform-none p-4">
                  <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
                    <BarChart3
                      size={14}
                      className="text-[var(--text-primary)]"
                    />
                    Attention Weights (Head 1)
                  </h4>
                  <div className="flex gap-[1px] h-16">
                    {(selectedModel.attentionWeights[0] || []).map(
                      (w: number, i: number) => (
                        <div
                          key={i}
                          className="flex-1 rounded-sm transition-all"
                          style={{
                            backgroundColor: `rgba(139, 92, 246, ${Math.min(w * 1.5, 1)})`,
                          }}
                          title={`t-${24 - i}: ${w.toFixed(3)}`}
                        />
                      ),
                    )}
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-[9px] text-[var(--text-faint)]">
                      t-24
                    </span>
                    <span className="text-[9px] text-[var(--text-faint)]">
                      t-1
                    </span>
                  </div>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirm && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
              onClick={() => setDeleteConfirm(null)}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm glass-panel rounded-2xl p-6 shadow-2xl"
            >
              <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
                Delete Model Version?
              </h3>
              <p className="text-sm text-[var(--text-muted)] mb-6">
                This action cannot be undone. The model weights and training
                data will be permanently removed.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="px-4 py-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-[var(--accent-faint)] border border-[var(--border-hover)] rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    deleteModel(deleteConfirm);
                    setDeleteConfirm(null);
                  }}
                  className="px-4 py-2 text-sm text-[var(--text-primary)] bg-red-600 hover:bg-red-500 rounded-xl transition"
                >
                  Delete Model
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
