'use client';

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { MESSAGES, toast } from '@/lib/feedback';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload,
  Columns3,
  Settings2,
  Activity,
  Rocket,
  FileSpreadsheet,
  FileJson,
  FilePlus2,
  Check,
  CheckCircle2,
  ChevronDown,
  X,
  Loader2,
  Play,
  Square,
  Sparkles,
  Save,
  Download,
  Zap,
  Target,
  TrendingDown,
  Gauge,
  Timer,
  BarChart3,
  Brain,
  Calendar,
  Hash,
  Type,
  AlertCircle,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { ChartTooltipContent } from '@/components/charts/ChartTooltip';
import * as XLSX from 'xlsx';
import {
  useTrainingStore,
  type UploadedDataset,
  type DatasetColumn,
  type TrainingConfig,
  type TrainingSession,
  type TrainingEpoch,
  type ModelVersion,
} from '@/store/trainingStore';

// ============================================================
// Tab definitions
// ============================================================

const TABS = [
  { id: 'upload', label: 'Upload', icon: Upload },
  { id: 'features', label: 'Features', icon: Columns3 },
  { id: 'config', label: 'Config', icon: Settings2 },
  { id: 'training', label: 'Training', icon: Activity },
  { id: 'results', label: 'Results', icon: Rocket },
] as const;

type TabId = (typeof TABS)[number]['id'];

// ============================================================
// Helpers
// ============================================================

function generateId() {
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function detectColumnType(values: unknown[]): 'numeric' | 'date' | 'categorical' {
  const sample = values.filter((v: any) => v !== null && v !== undefined && v !== '').slice(0, 50);
  if (sample.length === 0) return 'categorical';

  // Check numeric
  const numericCount = sample.filter((v: any) => !isNaN(Number(v))).length;
  if (numericCount / sample.length > 0.8) return 'numeric';

  // Check date
  const dateCount = sample.filter((v: any) => !isNaN(Date.parse(String(v)))).length;
  if (dateCount / sample.length > 0.8) return 'date';

  return 'categorical';
}

function computeColumnStats(name: string, values: unknown[]): DatasetColumn {
  const type = detectColumnType(values);
  const missing = values.filter((v: any) => v === null || v === undefined || v === '').length;
  const sample = values.slice(0, 5).map((v: any) => String(v ?? ''));

  if (type === 'numeric') {
    const nums = values
      .map((v: any) => Number(v))
      .filter((n: any) => !isNaN(n));
    return {
      name,
      type,
      missing,
      min: nums.length ? Math.min(...nums) : undefined,
      max: nums.length ? Math.max(...nums) : undefined,
      mean: nums.length ? nums.reduce((a: any, b: any) => a + b, 0) / nums.length : undefined,
      sample,
    };
  }

  return { name, type, missing, sample };
}

// Mini sparkline SVG for numeric columns
function MiniSparkline({ values }: { values: number[] }) {
  const pts = values.slice(0, 30);
  if (pts.length < 2) return null;
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const range = max - min || 1;
  const w = 80;
  const h = 24;
  const path = pts
    .map((v: any, i: number) => {
      const x = (i / (pts.length - 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg width={w} height={h} className="inline-block">
      <path d={path} fill="none" stroke="#FFFFFF" strokeWidth="1.5" />
    </svg>
  );
}

// ============================================================
// Tab content animations
// ============================================================

const tabContentVariants = {
  initial: { opacity: 0, y: 16, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.35, ease: 'easeOut' as const } },
  exit: { opacity: 0, y: -12, scale: 0.98, transition: { duration: 0.2, ease: 'easeOut' as const } },
};

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' as const } },
};

const stagger = {
  animate: { transition: { staggerChildren: 0.06 } },
};

// ============================================================
// MAIN PAGE COMPONENT
// ============================================================

export default function TrainingCenterPage() {
  const [activeTab, setActiveTab] = useState<TabId>('upload');

  // Store
  const {
    datasets,
    addDataset,
    configs,
    activeConfigId,
    updateConfig,
    addConfig,
    sessions,
    addSession,
    updateSession,
    models,
    addModel,
    setActiveModel,
  } = useTrainingStore();

  // Local state for feature selection
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [targetColumn, setTargetColumn] = useState<string>('');
  const [dateColumn, setDateColumn] = useState<string>('');

  // Active dataset = most recently uploaded
  const activeDataset = datasets[0] ?? null;
  const activeConfig = configs.find((c: any) => c.id === activeConfigId) ?? configs[0];

  // Training simulation state
  const [isTraining, setIsTraining] = useState(false);
  const [trainingEpochs, setTrainingEpochs] = useState<TrainingEpoch[]>([]);
  const [currentEpoch, setCurrentEpoch] = useState(0);
  const [trainingComplete, setTrainingComplete] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Deployed model state
  const [deployedModelId, setDeployedModelId] = useState<string | null>(null);

  // Tab access logic
  const canAccessTab = useCallback(
    (tab: TabId): boolean => {
      switch (tab) {
        case 'upload':
          return true;
        case 'features':
          return !!activeDataset;
        case 'config':
          return !!activeDataset && selectedFeatures.length > 0;
        case 'training':
          return !!activeDataset && selectedFeatures.length > 0;
        case 'results':
          return trainingComplete;
        default:
          return false;
      }
    },
    [activeDataset, selectedFeatures, trainingComplete],
  );

  // ==========================================================
  // TAB 1 -- DATASET UPLOAD
  // ==========================================================

  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(
    async (file: File) => {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (!ext || !['json', 'csv', 'xlsx', 'xls'].includes(ext)) {
        toast.error(MESSAGES.dataset.invalidFormat);
        return;
      }
      if (datasets.some((d) => d.fileName === file.name)) {
        toast.warning(MESSAGES.dataset.duplicate);
        return;
      }
      let records: Record<string, unknown>[] = [];

      if (ext === 'json') {
        const text = await file.text();
        const parsed = JSON.parse(text);
        records = Array.isArray(parsed) ? parsed : [parsed];
      } else {
        // xlsx or csv
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        records = XLSX.utils.sheet_to_json(ws) as Record<string, unknown>[];
      }

      if (records.length === 0) {
        toast.error(MESSAGES.dataset.uploadFailed);
        return;
      }

      const colNames = Object.keys(records[0]);
      const columns: DatasetColumn[] = colNames.map((name: any) => {
        const values = records.map((r: any) => r[name]);
        return computeColumnStats(name, values);
      });

      const dataset: UploadedDataset = {
        id: generateId(),
        fileName: file.name,
        fileSize: file.size,
        uploadedAt: new Date().toISOString(),
        rows: records.length,
        columns,
        preview: records.slice(0, 15),
        rawData: records,
      };

      addDataset(dataset);
      // Auto-select features
      const numericCols = columns.filter((c: any) => c.type === 'numeric').map((c: any) => c.name);
      setSelectedFeatures(numericCols);
      const dateCols = columns.filter((c: any) => c.type === 'date').map((c: any) => c.name);
      if (dateCols.length > 0) setDateColumn(dateCols[0]);
      if (numericCols.length > 0) setTargetColumn(numericCols[0]);

      toast.success(MESSAGES.dataset.uploadSuccess);
    },
    [addDataset, datasets],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile],
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
    },
    [processFile],
  );

  // Type icon helper
  function typeIcon(type: string) {
    switch (type) {
      case 'numeric':
        return <Hash size={12} className="text-blue-400" />;
      case 'date':
        return <Calendar size={12} className="text-amber-400" />;
      default:
        return <Type size={12} className="text-emerald-400" />;
    }
  }

  function typeBadge(type: string) {
    const colors: Record<string, string> = {
      numeric: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
      date: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
      categorical: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
      unknown: 'bg-[var(--status-bg)] text-[var(--text-muted)] border-[var(--status-border)]',
    };
    return (
      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${colors[type] || colors.unknown}`}>
        {typeIcon(type)}
        {type}
      </span>
    );
  }

  // ==========================================================
  // TAB 4 -- TRAINING SIMULATION
  // ==========================================================

  const startTraining = useCallback(() => {
    if (!activeDataset || !activeConfig) return;

    const sessionId = generateId();
    const totalEpochs = activeConfig.epochs;

    const session: TrainingSession = {
      id: sessionId,
      datasetId: activeDataset.id,
      datasetName: activeDataset.fileName,
      configId: activeConfig.id,
      configName: activeConfig.name,
      status: 'running',
      startedAt: new Date().toISOString(),
      currentEpoch: 0,
      totalEpochs,
      epochs: [],
      selectedFeatures,
      targetColumn,
    };

    addSession(session);
    setActiveSessionId(sessionId);
    setIsTraining(true);
    setTrainingComplete(false);
    setCurrentEpoch(0);
    setTrainingEpochs([]);
    setDeployedModelId(null);
    toast.success(MESSAGES.training.started);
  }, [activeDataset, activeConfig, selectedFeatures, targetColumn, addSession]);

  // Simulated epoch ticker
  useEffect(() => {
    if (!isTraining || !activeConfig) return;

    const totalEpochs = activeConfig.epochs;

    intervalRef.current = setInterval(() => {
      setCurrentEpoch((prev) => {
        const next = prev + 1;
        if (next > totalEpochs) {
          // Training complete
          clearInterval(intervalRef.current!);
          setIsTraining(false);
          setTrainingComplete(true);

          if (activeSessionId) {
            updateSession(activeSessionId, {
              status: 'completed',
              completedAt: new Date().toISOString(),
              currentEpoch: totalEpochs,
              finalMetrics: {
                accuracy: 96.8 + Math.random() * 1.5,
                rmse: 0.14 + Math.random() * 0.08,
                mae: 0.11 + Math.random() * 0.06,
                r2: 0.955 + Math.random() * 0.03,
                mape: 1.2 + Math.random() * 0.8,
              },
            });
          }
          toast.success(MESSAGES.training.completed);
          return prev;
        }

        // Simulate realistic metrics
        const progress = next / totalEpochs;
        const noise = () => (Math.random() - 0.5) * 0.04;
        const trainLoss = 2.5 * Math.exp(-4 * progress) + 0.12 + noise() * (1 - progress);
        const valLoss = 3.0 * Math.exp(-3.5 * progress) + 0.18 + noise() * (1 - progress) + Math.random() * 0.03;
        const accuracy = 60 + 37 * (1 - Math.exp(-4 * progress)) + noise() * 20;
        const rmse = 1.8 * Math.exp(-3.5 * progress) + 0.12 + noise() * 0.5;
        const mae = 1.4 * Math.exp(-3.5 * progress) + 0.09 + noise() * 0.3;

        // Attention weights: 8x24 matrix that slowly converges
        const convergence = Math.min(progress * 1.5, 1);
        const attentionWeights = Array.from({ length: 8 }, (_: any, headIdx: number) =>
          Array.from({ length: 24 }, (_: any, posIdx: number) => {
            const peak = Math.exp(-Math.pow(posIdx - (headIdx * 3 + 4), 2) / (10 * (1 - convergence * 0.7)));
            return peak * convergence + Math.random() * (1 - convergence) * 0.6;
          }),
        );

        const epochData: TrainingEpoch = {
          epoch: next,
          trainLoss: Math.max(0.01, trainLoss),
          valLoss: Math.max(0.01, valLoss),
          accuracy: Math.min(99, Math.max(50, accuracy)),
          rmse: Math.max(0.01, rmse),
          mae: Math.max(0.01, mae),
          attentionWeights,
        };

        setTrainingEpochs((prev) => [...prev, epochData]);

        if (activeSessionId) {
          updateSession(activeSessionId, {
            currentEpoch: next,
            epochs: [...(useTrainingStore.getState().sessions.find((s: any) => s.id === activeSessionId)?.epochs ?? []), epochData],
          });
        }

        return next;
      });
    }, 300);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isTraining, activeConfig, activeSessionId, updateSession]);

  const cancelTraining = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setIsTraining(false);
    if (activeSessionId) {
      updateSession(activeSessionId, { status: 'cancelled' });
    }
    toast.warning(MESSAGES.training.interrupted);
  }, [activeSessionId, updateSession]);

  // ==========================================================
  // TAB 5 -- Results data
  // ==========================================================

  const completedSession = sessions.find((s: any) => s.id === activeSessionId && s.status === 'completed');
  const finalMetrics = completedSession?.finalMetrics;

  // Actual vs Predicted data (simulated)
  const actualVsPredicted = useMemo(() => {
    if (!trainingComplete) return [];
    return Array.from({ length: 40 }, (_: any, i: number) => {
      const actual = 2.5 + Math.sin(i * 0.3) * 1.2 + Math.random() * 0.3;
      const predicted = actual + (Math.random() - 0.5) * 0.25;
      return { index: i + 1, actual: Number(actual.toFixed(3)), predicted: Number(predicted.toFixed(3)) };
    });
  }, [trainingComplete]);

  // Residual distribution
  const residualDistribution = useMemo(() => {
    if (!actualVsPredicted.length) return [];
    const residuals = actualVsPredicted.map((d: any) => d.actual - d.predicted);
    const bins = [-0.3, -0.2, -0.1, 0, 0.1, 0.2, 0.3];
    return bins.map((bin: any, i: number) => {
      const count = residuals.filter((r: any) => r >= bin - 0.05 && r < bin + 0.05).length;
      return { bin: bin.toFixed(1), count };
    });
  }, [actualVsPredicted]);

  // Deploy model handler
  const deployModel = useCallback(() => {
    if (!completedSession || !activeConfig || !finalMetrics) return;

    const latestEpoch = trainingEpochs[trainingEpochs.length - 1];
    const modelId = generateId();
    const existingVersions = models.length;

    const newModel: ModelVersion = {
      id: modelId,
      version: `v${(existingVersions + 1).toFixed(0)}.0`,
      trainingSessionId: completedSession.id,
      status: 'active',
      accuracy: finalMetrics.accuracy,
      mae: finalMetrics.mae,
      rmse: finalMetrics.rmse,
      r2: finalMetrics.r2,
      parameters: `${(activeConfig.embeddingDim * activeConfig.attentionHeads * 0.01).toFixed(1)}M`,
      createdAt: new Date().toISOString(),
      epochs: activeConfig.epochs,
      config: activeConfig,
      attentionWeights: latestEpoch?.attentionWeights ?? [],
    };

    addModel(newModel);
    setActiveModel(modelId);
    setDeployedModelId(modelId);
    toast.success(MESSAGES.training.deployed);
  }, [completedSession, activeConfig, finalMetrics, trainingEpochs, models, addModel, setActiveModel]);

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <motion.div {...fadeIn}>
        <h1 className="text-2xl font-bold text-[var(--text-primary)] sm:text-3xl">TS-Transformer Training Center</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">Upload data, configure parameters, train models, and deploy</p>
      </motion.div>

      {/* Tab Navigation */}
      <motion.div
        {...fadeIn}
        className="flex flex-wrap gap-1 glass-card rounded-xl hover:transform-none p-1.5"
      >
        {TABS.map((tab: any, i: number) => {
          const Icon = tab.icon;
          const accessible = canAccessTab(tab.id);
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => accessible && setActiveTab(tab.id)}
              disabled={!accessible}
              className={`relative flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
                isActive
                  ? 'bg-[var(--accent)] text-white shadow-lg shadow-black/20'
                  : accessible
                    ? 'text-[var(--text-muted)] hover:bg-[var(--glass-bg-hover)] hover:text-[var(--text-primary)]'
                    : 'cursor-not-allowed text-[var(--text-faint)] opacity-50'
              }`}
            >
              <Icon size={16} />
              <span className="hidden sm:inline">{tab.label}</span>
              {/* Step number badge */}
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                  isActive
                    ? 'bg-[var(--bg-primary)]/20 text-[var(--bg-primary)]'
                    : accessible
                      ? 'bg-[var(--glass-bg-hover)] text-[var(--text-muted)]'
                      : 'bg-[var(--glass-bg)] text-[var(--text-faint)]'
                }`}
              >
                {i + 1}
              </span>
            </button>
          );
        })}
      </motion.div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {/* ====================================================== */}
        {/* TAB 1: DATASET UPLOAD */}
        {/* ====================================================== */}
        {activeTab === 'upload' && (
          <motion.div key="upload" variants={tabContentVariants} initial="initial" animate="animate" exit="exit" className="space-y-6">
            {/* Drop zone */}
            <div
              onDragOver={(e: any) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`group cursor-pointer rounded-xl border-2 border-dashed p-12 text-center transition-all ${
                dragOver
                  ? 'border-[var(--border-active)] bg-[var(--accent-faint)] shadow-[0_0_30px_rgba(255,255,255,0.08)]'
                  : 'border-[var(--border-hover)] bg-[var(--glass-bg)] hover:border-[var(--border-hover)] hover:shadow-[0_0_20px_rgba(255,255,255,0.06)]'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.csv,.json"
                onChange={handleFileInput}
                className="hidden"
              />
              <motion.div
                animate={dragOver ? { scale: 1.05 } : { scale: 1 }}
                className="flex flex-col items-center gap-4"
              >
                <div className={`flex h-16 w-16 items-center justify-center rounded-2xl transition ${
                  dragOver ? 'bg-[var(--accent-faint)]' : 'bg-[var(--glass-bg)] group-hover:bg-[var(--accent-faint)]'
                }`}>
                  <FilePlus2 size={32} className={`transition ${dragOver ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)] group-hover:text-[var(--text-primary)]'}`} />
                </div>
                <div>
                  <p className="text-lg font-semibold text-[var(--text-primary)]">
                    {dragOver ? 'Drop file here' : 'Drag & drop your dataset'}
                  </p>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">
                    Supports .xlsx, .csv, .json files
                  </p>
                </div>
                <div className="flex gap-2">
                  {[
                    { icon: FileSpreadsheet, label: '.xlsx', color: 'text-emerald-400' },
                    { icon: FileSpreadsheet, label: '.csv', color: 'text-blue-400' },
                    { icon: FileJson, label: '.json', color: 'text-amber-400' },
                  ].map((f: any, i: number) => (
                    <span key={i} className="flex items-center gap-1 rounded-full border border-[var(--border-primary)] bg-[var(--glass-bg)] px-3 py-1 text-xs text-[var(--text-muted)]">
                      <f.icon size={12} className={f.color} />
                      {f.label}
                    </span>
                  ))}
                </div>
              </motion.div>
            </div>

            {/* Dataset preview */}
            {activeDataset && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: 'easeOut' as const }}
                className="space-y-6"
              >
                {/* File metadata badges */}
                <div className="flex flex-wrap gap-3">
                  <span className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-primary)] bg-[var(--glass-bg)] px-3 py-1.5 text-sm text-[var(--text-secondary)]">
                    <FileSpreadsheet size={14} className="text-[var(--text-primary)]" />
                    {activeDataset.fileName}
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-1.5 text-sm text-emerald-400">
                    <BarChart3 size={14} />
                    {activeDataset.rows.toLocaleString()} rows
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-lg border border-blue-500/20 bg-blue-500/[0.06] px-3 py-1.5 text-sm text-blue-400">
                    <Columns3 size={14} />
                    {activeDataset.columns.length} columns
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-3 py-1.5 text-sm text-amber-400">
                    <Download size={14} />
                    {formatBytes(activeDataset.fileSize)}
                  </span>
                </div>

                {/* Column statistics */}
                <div className="glass-card rounded-xl hover:transform-none p-5">
                  <h3 className="mb-4 text-sm font-semibold text-[var(--text-primary)]">Column Statistics</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-[var(--border-primary)]">
                          <th className="pb-3 pr-4 text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Column</th>
                          <th className="pb-3 pr-4 text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Type</th>
                          <th className="pb-3 pr-4 text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Missing</th>
                          <th className="pb-3 pr-4 text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Min</th>
                          <th className="pb-3 pr-4 text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Max</th>
                          <th className="pb-3 text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Mean</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeDataset.columns.map((col: any, i: number) => (
                          <tr key={i} className="border-b border-[var(--border-primary)] last:border-0">
                            <td className="py-2.5 pr-4 font-medium text-[var(--text-primary)]">{col.name}</td>
                            <td className="py-2.5 pr-4">{typeBadge(col.type)}</td>
                            <td className="py-2.5 pr-4">
                              <span className={col.missing > 0 ? 'text-amber-400' : 'text-[var(--text-muted)]'}>
                                {col.missing}
                              </span>
                            </td>
                            <td className="py-2.5 pr-4 font-mono text-[var(--text-muted)]">
                              {col.min !== undefined ? col.min.toFixed(2) : '-'}
                            </td>
                            <td className="py-2.5 pr-4 font-mono text-[var(--text-muted)]">
                              {col.max !== undefined ? col.max.toFixed(2) : '-'}
                            </td>
                            <td className="py-2.5 font-mono text-[var(--text-muted)]">
                              {col.mean !== undefined ? col.mean.toFixed(2) : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Preview table */}
                <div className="glass-card rounded-xl hover:transform-none p-5">
                  <h3 className="mb-4 text-sm font-semibold text-[var(--text-primary)]">
                    Data Preview <span className="font-normal text-[var(--text-muted)]">(first 15 rows)</span>
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-[var(--border-primary)]">
                          <th className="pb-2 pr-3 text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">#</th>
                          {activeDataset.columns.map((col: any, i: number) => (
                            <th key={i} className="pb-2 pr-3 text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
                              {col.name}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {activeDataset.preview.map((row: any, i: number) => (
                          <tr key={i} className="border-b border-[var(--border-primary)] last:border-0">
                            <td className="py-1.5 pr-3 text-[var(--text-faint)]">{i + 1}</td>
                            {activeDataset.columns.map((col: any, j: number) => (
                              <td key={j} className="py-1.5 pr-3 font-mono text-[var(--text-muted)]">
                                {String(row[col.name] ?? '')}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Next step button */}
                <div className="flex justify-end">
                  <button
                    onClick={() => setActiveTab('features')}
                    className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-black/20 transition hover:shadow-black/30"
                  >
                    Continue to Feature Selection
                    <Columns3 size={16} />
                  </button>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* ====================================================== */}
        {/* TAB 2: FEATURE SELECTION */}
        {/* ====================================================== */}
        {activeTab === 'features' && activeDataset && (
          <motion.div key="features" variants={tabContentVariants} initial="initial" animate="animate" exit="exit" className="space-y-6">
            {/* Controls row */}
            <div className="flex flex-wrap items-center gap-4">
              {/* Target variable */}
              <div className="flex-1 min-w-[220px]">
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                  Target Variable (predict)
                </label>
                <div className="relative">
                  <select
                    value={targetColumn}
                    onChange={(e: any) => setTargetColumn(e.target.value)}
                    className="w-full appearance-none glass-card rounded-xl hover:transform-none px-4 py-2.5 pr-10 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--border-active)] focus:ring-1 focus:ring-[var(--border-hover)]"
                  >
                    <option value="" className="bg-[var(--bg-secondary)]">Select target...</option>
                    {activeDataset.columns.map((col: any, i: number) => (
                      <option key={i} value={col.name} className="bg-[var(--bg-secondary)]">
                        {col.name} ({col.type})
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                </div>
              </div>

              {/* Date column */}
              <div className="flex-1 min-w-[220px]">
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                  Date Column
                </label>
                <div className="relative">
                  <select
                    value={dateColumn}
                    onChange={(e: any) => setDateColumn(e.target.value)}
                    className="w-full appearance-none glass-card rounded-xl hover:transform-none px-4 py-2.5 pr-10 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--border-active)] focus:ring-1 focus:ring-[var(--border-hover)]"
                  >
                    <option value="" className="bg-[var(--bg-secondary)]">None</option>
                    {activeDataset.columns.filter((c: any) => c.type === 'date').map((col: any, i: number) => (
                      <option key={i} value={col.name} className="bg-[var(--bg-secondary)]">
                        {col.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                </div>
              </div>

              {/* Quick select numeric */}
              <div className="flex items-end gap-2 pt-5">
                <button
                  onClick={() => {
                    const numericCols = activeDataset.columns.filter((c: any) => c.type === 'numeric').map((c: any) => c.name);
                    setSelectedFeatures(numericCols);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-active)] bg-[var(--accent-faint)] px-4 py-2.5 text-xs font-semibold text-[var(--text-primary)] transition hover:bg-[var(--glass-bg-hover)]"
                >
                  <Hash size={13} />
                  Select All Numeric
                </button>
              </div>
            </div>

            {/* Selected count badge */}
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-active)] bg-[var(--accent-faint)] px-3 py-1 text-xs font-semibold text-[var(--text-primary)]">
                <Check size={12} />
                {selectedFeatures.length} features selected
              </span>
              {targetColumn && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/[0.08] px-3 py-1 text-xs font-semibold text-emerald-400">
                  <Target size={12} />
                  Target: {targetColumn}
                </span>
              )}
            </div>

            {/* Feature checkboxes grid */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {activeDataset.columns.map((col: any, i: number) => {
                const isSelected = selectedFeatures.includes(col.name);
                const isTarget = col.name === targetColumn;
                const numericValues = col.type === 'numeric' && activeDataset.rawData
                  ? activeDataset.rawData.map((r: any) => Number(r[col.name])).filter((n: any) => !isNaN(n))
                  : [];

                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03, duration: 0.3, ease: 'easeOut' as const }}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedFeatures((prev) => prev.filter((f: any) => f !== col.name));
                      } else {
                        setSelectedFeatures((prev) => [...prev, col.name]);
                      }
                    }}
                    className={`cursor-pointer rounded-xl border p-4 transition-all ${
                      isTarget
                        ? 'border-emerald-500/30 bg-emerald-500/[0.04]'
                        : isSelected
                          ? 'border-[var(--border-active)] bg-[var(--accent-faint)] shadow-[0_0_15px_rgba(255,255,255,0.04)]'
                          : 'border-[var(--border-primary)] bg-[var(--glass-bg)] hover:border-[var(--border-hover)]'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`flex h-5 w-5 items-center justify-center rounded border transition ${
                          isSelected
                            ? 'border-[var(--accent)] bg-[var(--accent)]'
                            : 'border-[var(--border-hover)] bg-[var(--glass-bg)]'
                        }`}>
                          {isSelected && <Check size={12} className="text-[var(--bg-primary)]" />}
                        </div>
                        <span className="text-sm font-medium text-[var(--text-primary)]">{col.name}</span>
                      </div>
                      {typeBadge(col.type)}
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-xs text-[var(--text-muted)]">
                        {col.missing > 0 ? (
                          <span className="text-amber-400">{col.missing} missing</span>
                        ) : (
                          'No missing values'
                        )}
                      </span>
                      {isTarget && (
                        <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                          TARGET
                        </span>
                      )}
                    </div>

                    {/* Mini sparkline for numeric columns */}
                    {numericValues.length > 2 && (
                      <div className="mt-2">
                        <MiniSparkline values={numericValues} />
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>

            {/* Next button */}
            <div className="flex justify-end">
              <button
                onClick={() => setActiveTab('config')}
                disabled={selectedFeatures.length === 0 || !targetColumn}
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-black/20 transition hover:shadow-black/30 disabled:opacity-50"
              >
                Continue to Configuration
                <Settings2 size={16} />
              </button>
            </div>
          </motion.div>
        )}

        {/* ====================================================== */}
        {/* TAB 3: TRAINING CONFIGURATION */}
        {/* ====================================================== */}
        {activeTab === 'config' && activeConfig && (
          <motion.div key="config" variants={tabContentVariants} initial="initial" animate="animate" exit="exit" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Main config panel */}
              <div className="lg:col-span-2 space-y-5">
                <div className="glass-card rounded-xl hover:transform-none p-6">
                  <h3 className="mb-6 text-base font-semibold text-[var(--text-primary)]">Model Parameters</h3>

                  <div className="grid gap-5 sm:grid-cols-2">
                    {/* Sequence Length */}
                    <div>
                      <label className="mb-1.5 flex items-center justify-between text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                        <span>Sequence Length</span>
                        <span className="font-mono text-[var(--text-primary)]">{activeConfig.sequenceLength}</span>
                      </label>
                      <input
                        type="range"
                        min={6}
                        max={120}
                        value={activeConfig.sequenceLength}
                        onChange={(e: any) => updateConfig(activeConfig.id, { sequenceLength: Number(e.target.value) })}
                        className="w-full accent-[var(--accent)]"
                      />
                      <div className="mt-1 flex justify-between text-[10px] text-[var(--text-faint)]">
                        <span>6</span><span>120</span>
                      </div>
                    </div>

                    {/* Prediction Horizon */}
                    <div>
                      <label className="mb-1.5 flex items-center justify-between text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                        <span>Prediction Horizon</span>
                        <span className="font-mono text-[var(--text-primary)]">{activeConfig.predictionHorizon}</span>
                      </label>
                      <input
                        type="range"
                        min={1}
                        max={24}
                        value={activeConfig.predictionHorizon}
                        onChange={(e: any) => updateConfig(activeConfig.id, { predictionHorizon: Number(e.target.value) })}
                        className="w-full accent-[var(--accent)]"
                      />
                      <div className="mt-1 flex justify-between text-[10px] text-[var(--text-faint)]">
                        <span>1</span><span>24</span>
                      </div>
                    </div>

                    {/* Batch Size */}
                    <div>
                      <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                        Batch Size
                      </label>
                      <div className="relative">
                        <select
                          value={activeConfig.batchSize}
                          onChange={(e: any) => updateConfig(activeConfig.id, { batchSize: Number(e.target.value) })}
                          className="w-full appearance-none glass-card rounded-xl hover:transform-none px-4 py-2.5 pr-10 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--border-active)]"
                        >
                          {[16, 32, 64, 128].map((v: any) => (
                            <option key={v} value={v} className="bg-[var(--bg-secondary)]">{v}</option>
                          ))}
                        </select>
                        <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                      </div>
                    </div>

                    {/* Learning Rate */}
                    <div>
                      <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                        Learning Rate
                      </label>
                      <input
                        type="number"
                        step={0.0001}
                        min={0.00001}
                        max={1}
                        value={activeConfig.learningRate}
                        onChange={(e: any) => updateConfig(activeConfig.id, { learningRate: Number(e.target.value) })}
                        className="w-full glass-card rounded-xl hover:transform-none px-4 py-2.5 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--border-active)]"
                      />
                    </div>

                    {/* Epochs */}
                    <div>
                      <label className="mb-1.5 flex items-center justify-between text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                        <span>Epochs</span>
                        <span className="font-mono text-[var(--text-primary)]">{activeConfig.epochs}</span>
                      </label>
                      <input
                        type="range"
                        min={10}
                        max={500}
                        value={activeConfig.epochs}
                        onChange={(e: any) => updateConfig(activeConfig.id, { epochs: Number(e.target.value) })}
                        className="w-full accent-[var(--accent)]"
                      />
                      <div className="mt-1 flex justify-between text-[10px] text-[var(--text-faint)]">
                        <span>10</span><span>500</span>
                      </div>
                    </div>

                    {/* Attention Heads */}
                    <div>
                      <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                        Attention Heads
                      </label>
                      <div className="relative">
                        <select
                          value={activeConfig.attentionHeads}
                          onChange={(e: any) => updateConfig(activeConfig.id, { attentionHeads: Number(e.target.value) })}
                          className="w-full appearance-none glass-card rounded-xl hover:transform-none px-4 py-2.5 pr-10 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--border-active)]"
                        >
                          {[2, 4, 8, 16].map((v: any) => (
                            <option key={v} value={v} className="bg-[var(--bg-secondary)]">{v}</option>
                          ))}
                        </select>
                        <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                      </div>
                    </div>

                    {/* Embedding Dimension */}
                    <div>
                      <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                        Embedding Dimension
                      </label>
                      <div className="relative">
                        <select
                          value={activeConfig.embeddingDim}
                          onChange={(e: any) => updateConfig(activeConfig.id, { embeddingDim: Number(e.target.value) })}
                          className="w-full appearance-none glass-card rounded-xl hover:transform-none px-4 py-2.5 pr-10 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--border-active)]"
                        >
                          {[32, 64, 128, 256].map((v: any) => (
                            <option key={v} value={v} className="bg-[var(--bg-secondary)]">{v}</option>
                          ))}
                        </select>
                        <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                      </div>
                    </div>

                    {/* Dropout Rate */}
                    <div>
                      <label className="mb-1.5 flex items-center justify-between text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                        <span>Dropout Rate</span>
                        <span className="font-mono text-[var(--text-primary)]">{activeConfig.dropoutRate.toFixed(2)}</span>
                      </label>
                      <input
                        type="range"
                        min={0}
                        max={50}
                        value={Math.round(activeConfig.dropoutRate * 100)}
                        onChange={(e: any) => updateConfig(activeConfig.id, { dropoutRate: Number(e.target.value) / 100 })}
                        className="w-full accent-[var(--accent)]"
                      />
                      <div className="mt-1 flex justify-between text-[10px] text-[var(--text-faint)]">
                        <span>0.0</span><span>0.5</span>
                      </div>
                    </div>

                    {/* Optimizer */}
                    <div>
                      <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                        Optimizer
                      </label>
                      <div className="relative">
                        <select
                          value={activeConfig.optimizer}
                          onChange={(e: any) => updateConfig(activeConfig.id, { optimizer: e.target.value })}
                          className="w-full appearance-none glass-card rounded-xl hover:transform-none px-4 py-2.5 pr-10 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--border-active)]"
                        >
                          {['Adam', 'AdamW', 'SGD'].map((v: any) => (
                            <option key={v} value={v} className="bg-[var(--bg-secondary)]">{v}</option>
                          ))}
                        </select>
                        <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                      </div>
                    </div>

                    {/* Train/Test Split */}
                    <div>
                      <label className="mb-1.5 flex items-center justify-between text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                        <span>Train/Test Split</span>
                        <span className="font-mono text-[var(--text-primary)]">{activeConfig.trainTestSplit}% / {100 - activeConfig.trainTestSplit}%</span>
                      </label>
                      <input
                        type="range"
                        min={60}
                        max={90}
                        value={activeConfig.trainTestSplit}
                        onChange={(e: any) => updateConfig(activeConfig.id, { trainTestSplit: Number(e.target.value) })}
                        className="w-full accent-[var(--accent)]"
                      />
                      <div className="mt-1 flex justify-between text-[10px] text-[var(--text-faint)]">
                        <span>60%</span><span>90%</span>
                      </div>
                    </div>
                  </div>

                  {/* Save/Load Preset */}
                  <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-[var(--border-primary)] pt-5">
                    <button
                      onClick={() => {
                        const newConfig: TrainingConfig = {
                          ...activeConfig,
                          id: generateId(),
                          name: `Preset ${new Date().toLocaleTimeString()}`,
                        };
                        addConfig(newConfig);
                        toast.success(MESSAGES.admin.settingsSaved);
                      }}
                      className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-active)] bg-[var(--accent-faint)] px-4 py-2 text-xs font-semibold text-[var(--text-primary)] transition hover:bg-[var(--glass-bg-hover)]"
                    >
                      <Save size={14} />
                      Save Preset
                    </button>

                    {configs.length > 1 && (
                      <div className="relative">
                        <select
                          value={activeConfigId}
                          onChange={(e: any) => {
                            const store = useTrainingStore.getState();
                            store.setActiveConfig(e.target.value);
                          }}
                          className="appearance-none glass-card rounded-xl hover:transform-none px-4 py-2 pr-10 text-xs text-[var(--text-primary)] outline-none transition focus:border-[var(--border-active)]"
                        >
                          {configs.map((c: any, i: number) => (
                            <option key={c.id} value={c.id} className="bg-[var(--bg-secondary)]">
                              {c.name}
                            </option>
                          ))}
                        </select>
                        <ChevronDown size={12} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Architecture preview sidebar */}
              <div className="space-y-5">
                <div className="glass-card rounded-xl hover:transform-none p-5">
                  <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                    <Brain size={16} className="text-[var(--text-primary)]" />
                    Architecture Preview
                  </h3>

                  <div className="space-y-3">
                    {[
                      { label: 'Input Shape', value: `(${activeConfig.batchSize}, ${activeConfig.sequenceLength}, ${selectedFeatures.length})` },
                      { label: 'Embedding', value: `${activeConfig.embeddingDim}d` },
                      { label: 'Attention', value: `${activeConfig.attentionHeads} heads` },
                      { label: 'Dropout', value: `${(activeConfig.dropoutRate * 100).toFixed(0)}%` },
                      { label: 'Output', value: `(${activeConfig.predictionHorizon},)` },
                      { label: 'Optimizer', value: activeConfig.optimizer },
                      { label: 'LR', value: activeConfig.learningRate.toString() },
                    ].map((item: any, i: number) => (
                      <div key={i} className="flex items-center justify-between rounded-lg bg-[var(--glass-bg)] px-3 py-2">
                        <span className="text-xs text-[var(--text-muted)]">{item.label}</span>
                        <span className="font-mono text-xs text-[var(--text-primary)]">{item.value}</span>
                      </div>
                    ))}
                  </div>

                  {/* Estimated params */}
                  <div className="mt-4 rounded-lg border border-[var(--border-active)] bg-[var(--accent-faint)] p-3 text-center">
                    <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Est. Parameters</p>
                    <p className="mt-1 text-lg font-bold text-[var(--text-primary)]">
                      {(activeConfig.embeddingDim * activeConfig.attentionHeads * selectedFeatures.length * 0.001).toFixed(1)}M
                    </p>
                  </div>
                </div>

                {/* Train/Test split visual */}
                <div className="glass-card rounded-xl hover:transform-none p-5">
                  <h3 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">Data Split</h3>
                  <div className="flex h-4 overflow-hidden rounded-full">
                    <div
                      className="bg-gradient-to-r from-[var(--accent)] to-[#0052cc] transition-all"
                      style={{ width: `${activeConfig.trainTestSplit}%` }}
                    />
                    <div
                      className="bg-[var(--text-faint)] transition-all"
                      style={{ width: `${100 - activeConfig.trainTestSplit}%` }}
                    />
                  </div>
                  <div className="mt-2 flex justify-between text-xs">
                    <span className="text-[var(--text-primary)]">Train {activeConfig.trainTestSplit}%</span>
                    <span className="text-[var(--text-muted)]">Test {100 - activeConfig.trainTestSplit}%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Continue button */}
            <div className="flex justify-end">
              <button
                onClick={() => setActiveTab('training')}
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-black/20 transition hover:shadow-black/30"
              >
                Continue to Training
                <Activity size={16} />
              </button>
            </div>
          </motion.div>
        )}

        {/* ====================================================== */}
        {/* TAB 4: LIVE TRAINING MONITOR */}
        {/* ====================================================== */}
        {activeTab === 'training' && (
          <motion.div key="training" variants={tabContentVariants} initial="initial" animate="animate" exit="exit" className="space-y-6">
            {/* Controls */}
            <div className="flex flex-wrap items-center gap-3">
              {!isTraining && !trainingComplete && (
                <button
                  onClick={startTraining}
                  disabled={!activeDataset || selectedFeatures.length === 0}
                  className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-black/20 transition hover:shadow-black/30 disabled:opacity-50"
                >
                  <Play size={16} />
                  Start Training
                </button>
              )}
              {isTraining && (
                <button
                  onClick={cancelTraining}
                  className="inline-flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-2.5 text-sm font-semibold text-red-400 transition hover:bg-red-500/20"
                >
                  <Square size={16} />
                  Cancel Training
                </button>
              )}
              {trainingComplete && (
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={18} className="text-emerald-400" />
                  <span className="text-sm font-semibold text-emerald-400">Training Complete!</span>
                  <button
                    onClick={() => setActiveTab('results')}
                    className="ml-3 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-2.5 text-sm font-semibold text-[var(--text-primary)] shadow-lg transition hover:shadow-emerald-500/30"
                  >
                    <Rocket size={16} />
                    View Results
                  </button>
                </div>
              )}

              {/* Epoch progress */}
              {(isTraining || trainingComplete) && activeConfig && (
                <span className="ml-auto text-xs text-[var(--text-muted)]">
                  Epoch {Math.min(currentEpoch, activeConfig.epochs)} / {activeConfig.epochs}
                </span>
              )}
            </div>

            {/* Progress bar */}
            {(isTraining || trainingComplete) && activeConfig && (
              <div>
                <div className="h-3 overflow-hidden rounded-full bg-[var(--glass-bg-hover)]">
                  <motion.div
                    className={`h-full rounded-full ${
                      trainingComplete
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                        : 'bg-gradient-to-r from-[var(--accent)] to-[#3b82f6]'
                    }`}
                    animate={{ width: `${Math.min((currentEpoch / activeConfig.epochs) * 100, 100)}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
                <p className="mt-1 text-right text-xs font-mono text-[var(--text-muted)]">
                  {Math.min((currentEpoch / activeConfig.epochs) * 100, 100).toFixed(1)}%
                </p>
              </div>
            )}

            {/* Metric cards */}
            {trainingEpochs.length > 0 && (
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                {[
                  {
                    label: 'Accuracy',
                    value: `${trainingEpochs[trainingEpochs.length - 1].accuracy.toFixed(1)}%`,
                    icon: Gauge,
                    color: 'text-emerald-400',
                    trend: 'up',
                  },
                  {
                    label: 'RMSE',
                    value: trainingEpochs[trainingEpochs.length - 1].rmse.toFixed(4),
                    icon: TrendingDown,
                    color: 'text-blue-400',
                    trend: 'down',
                  },
                  {
                    label: 'MAE',
                    value: trainingEpochs[trainingEpochs.length - 1].mae.toFixed(4),
                    icon: Target,
                    color: 'text-amber-400',
                    trend: 'down',
                  },
                  {
                    label: 'Speed',
                    value: `${(300 + Math.random() * 50).toFixed(0)} ms/ep`,
                    icon: Timer,
                    color: 'text-[var(--text-primary)]',
                    trend: 'stable',
                  },
                ].map((metric: any, i: number) => {
                  const Icon = metric.icon;
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.05, duration: 0.3, ease: 'easeOut' as const }}
                      className="glass-card rounded-xl hover:transform-none p-4"
                    >
                      <div className="flex items-center gap-2">
                        <Icon size={14} className={metric.color} />
                        <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">{metric.label}</span>
                      </div>
                      <p className={`mt-2 text-xl font-bold ${metric.color}`}>{metric.value}</p>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {/* Loss curves */}
            {trainingEpochs.length > 1 && (
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Train & Val Loss */}
                <div className="glass-card rounded-xl hover:transform-none p-5">
                  <h3 className="mb-4 text-sm font-semibold text-[var(--text-primary)]">Loss Curves</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={trainingEpochs}>
                      <defs>
                        <linearGradient id="trainGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.15} />
                          <stop offset="100%" stopColor="#FFFFFF" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="valGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis dataKey="epoch" stroke="#475569" tick={{ fontSize: 10 }} />
                      <YAxis stroke="#475569" tick={{ fontSize: 10 }} />
                      <Tooltip
                      content={
                        <ChartTooltipContent
                          labelFormatter={(label) => `Epoch ${label}`}
                          valueFormatter={(value) => Number(value).toFixed(4)}
                        />
                      }
                    />
                      <Legend
                        wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }}
                      />
                      <Area
                        type="monotone"
                        dataKey="trainLoss"
                        name="Train Loss"
                        stroke="#FFFFFF"
                        fill="url(#trainGrad)"
                        strokeWidth={2}
                      />
                      <Area
                        type="monotone"
                        dataKey="valLoss"
                        name="Val Loss"
                        stroke="#f59e0b"
                        fill="url(#valGrad)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Accuracy curve */}
                <div className="glass-card rounded-xl hover:transform-none p-5">
                  <h3 className="mb-4 text-sm font-semibold text-[var(--text-primary)]">Accuracy</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={trainingEpochs}>
                      <defs>
                        <linearGradient id="accGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis dataKey="epoch" stroke="#475569" tick={{ fontSize: 10 }} />
                      <YAxis stroke="#475569" tick={{ fontSize: 10 }} domain={[50, 100]} />
                      <Tooltip
                      content={
                        <ChartTooltipContent
                          labelFormatter={(label) => `Epoch ${label}`}
                          valueFormatter={(value) => Number(value).toFixed(4)}
                        />
                      }
                    />
                      <Area
                        type="monotone"
                        dataKey="accuracy"
                        name="Accuracy"
                        stroke="#10b981"
                        fill="url(#accGrad)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Attention Heatmap */}
            {trainingEpochs.length > 0 && (
              <div className="glass-card rounded-xl hover:transform-none p-5">
                <h3 className="mb-4 text-sm font-semibold text-[var(--text-primary)]">
                  Attention Weights Heatmap
                  <span className="ml-2 font-normal text-[var(--text-muted)]">
                    ({trainingEpochs[trainingEpochs.length - 1].attentionWeights.length} heads x {trainingEpochs[trainingEpochs.length - 1].attentionWeights[0]?.length ?? 0} positions)
                  </span>
                </h3>
                <div className="overflow-x-auto">
                  <div className="inline-grid gap-[2px]" style={{
                    gridTemplateColumns: `repeat(${trainingEpochs[trainingEpochs.length - 1].attentionWeights[0]?.length ?? 24}, 1fr)`,
                  }}>
                    {trainingEpochs[trainingEpochs.length - 1].attentionWeights.map((row: any, hi: number) =>
                      row.map((weight: any, pi: number) => {
                        const intensity = Math.min(Math.max(weight, 0), 1);
                        return (
                          <div
                            key={`${hi}-${pi}`}
                            className="h-4 w-4 rounded-[2px] transition-colors"
                            style={{
                              backgroundColor: `rgba(255, 255, 255, ${intensity * 0.85 + 0.05})`,
                            }}
                            title={`Head ${hi + 1}, Pos ${pi + 1}: ${weight.toFixed(3)}`}
                          />
                        );
                      })
                    )}
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-[10px] text-[var(--text-faint)]">Low</span>
                  <div className="flex gap-[1px]">
                    {Array.from({ length: 10 }, (_: any, i: number) => (
                      <div
                        key={i}
                        className="h-3 w-5 rounded-[1px]"
                        style={{ backgroundColor: `rgba(255, 255, 255, ${(i + 1) * 0.1})` }}
                      />
                    ))}
                  </div>
                  <span className="text-[10px] text-[var(--text-faint)]">High</span>
                </div>
              </div>
            )}

            {/* Empty state */}
            {trainingEpochs.length === 0 && !isTraining && (
              <div className="flex flex-col items-center justify-center glass-card rounded-xl hover:transform-none py-20 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--glass-bg)]">
                  <Activity size={32} className="text-[var(--text-faint)]" />
                </div>
                <p className="mt-4 text-sm text-[var(--text-muted)]">No training in progress</p>
                <p className="mt-1 text-xs text-[var(--text-faint)]">Click "Start Training" to begin a new session</p>
              </div>
            )}
          </motion.div>
        )}

        {/* ====================================================== */}
        {/* TAB 5: RESULTS & DEPLOY */}
        {/* ====================================================== */}
        {activeTab === 'results' && trainingComplete && (
          <motion.div key="results" variants={tabContentVariants} initial="initial" animate="animate" exit="exit" className="space-y-6">
            {/* Final metrics */}
            {finalMetrics && (
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
                {[
                  { label: 'Accuracy', value: `${finalMetrics.accuracy.toFixed(1)}%`, color: 'text-emerald-400' },
                  { label: 'RMSE', value: finalMetrics.rmse.toFixed(4), color: 'text-blue-400' },
                  { label: 'MAE', value: finalMetrics.mae.toFixed(4), color: 'text-amber-400' },
                  { label: 'R2 Score', value: finalMetrics.r2.toFixed(4), color: 'text-[var(--text-primary)]' },
                  { label: 'MAPE', value: `${finalMetrics.mape.toFixed(2)}%`, color: 'text-pink-400' },
                ].map((m: any, i: number) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.08, duration: 0.4, ease: 'easeOut' as const }}
                    className="glass-card rounded-xl hover:transform-none p-5 text-center"
                  >
                    <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">{m.label}</p>
                    <p className={`mt-2 text-2xl font-bold ${m.color}`}>{m.value}</p>
                  </motion.div>
                ))}
              </div>
            )}

            {/* Charts */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Actual vs Predicted */}
              <div className="glass-card rounded-xl hover:transform-none p-5">
                <h3 className="mb-4 text-sm font-semibold text-[var(--text-primary)]">Actual vs Predicted</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={actualVsPredicted}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="index" stroke="#475569" tick={{ fontSize: 10 }} />
                    <YAxis stroke="#475569" tick={{ fontSize: 10 }} />
                    <Tooltip
                      content={
                        <ChartTooltipContent
                          labelFormatter={(label) => `Epoch ${label}`}
                          valueFormatter={(value) => Number(value).toFixed(4)}
                        />
                      }
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }} />
                    <Line
                      type="monotone"
                      dataKey="actual"
                      name="Actual"
                      stroke="#FFFFFF"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="predicted"
                      name="Predicted"
                      stroke="#10b981"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Error Distribution */}
              <div className="glass-card rounded-xl hover:transform-none p-5">
                <h3 className="mb-4 text-sm font-semibold text-[var(--text-primary)]">Error Distribution (Residuals)</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={residualDistribution}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="bin" stroke="#475569" tick={{ fontSize: 10 }} />
                    <YAxis stroke="#475569" tick={{ fontSize: 10 }} />
                    <Tooltip
                      content={
                        <ChartTooltipContent
                          labelFormatter={(label) => `Epoch ${label}`}
                          valueFormatter={(value) => Number(value).toFixed(4)}
                        />
                      }
                    />
                    <Bar
                      dataKey="count"
                      name="Count"
                      fill="#D9D9D9"
                      radius={[4, 4, 0, 0]}
                      fillOpacity={0.7}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap items-center gap-4">
              {!deployedModelId ? (
                <button
                  onClick={deployModel}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-3 text-sm font-semibold text-[var(--text-primary)] shadow-lg shadow-emerald-500/25 transition hover:shadow-emerald-500/40"
                >
                  <Rocket size={16} />
                  Deploy Model
                </button>
              ) : (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.4, ease: 'easeOut' as const }}
                  className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-3 text-sm font-semibold text-emerald-400"
                >
                  <CheckCircle2 size={18} />
                  Model Deployed Successfully
                  <Sparkles size={14} className="text-emerald-300" />
                </motion.div>
              )}

              <button
                onClick={() => toast.success(MESSAGES.reports.generated)}
                className="inline-flex items-center gap-2 glass-card rounded-xl hover:transform-none px-5 py-3 text-sm font-medium text-[var(--text-muted)] transition hover:bg-[var(--glass-bg-hover)] hover:text-[var(--text-primary)]"
              >
                <Download size={16} />
                Export Report
              </button>
            </div>

            {/* Deployed model info */}
            {deployedModelId && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.4, ease: 'easeOut' as const }}
                className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-5"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-teal-500">
                    <Zap size={20} className="text-[var(--text-primary)]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[var(--text-primary)]">Model is now live!</p>
                    <p className="text-xs text-[var(--text-muted)]">
                      Deployed at {new Date().toLocaleString()} -- ID: {deployedModelId.slice(0, 12)}...
                    </p>
                  </div>
                </div>

                {finalMetrics && (
                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[
                      { label: 'Accuracy', value: `${finalMetrics.accuracy.toFixed(1)}%` },
                      { label: 'RMSE', value: finalMetrics.rmse.toFixed(4) },
                      { label: 'MAE', value: finalMetrics.mae.toFixed(4) },
                      { label: 'R2', value: finalMetrics.r2.toFixed(4) },
                    ].map((m: any, i: number) => (
                      <div key={i} className="rounded-lg bg-[var(--glass-bg)] p-3 text-center">
                        <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">{m.label}</p>
                        <p className="mt-0.5 text-sm font-bold text-emerald-400">{m.value}</p>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
