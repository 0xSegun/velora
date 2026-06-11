import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/* ==========================================================
   Training Store — persisted to localStorage
   Manages dataset uploads, training configs, training history
   ========================================================== */

export interface DatasetColumn {
  name: string;
  type: 'numeric' | 'date' | 'categorical' | 'unknown';
  missing: number;
  min?: number;
  max?: number;
  mean?: number;
  sample: string[];
}

export interface UploadedDataset {
  id: string;
  fileName: string;
  fileSize: number;
  uploadedAt: string;
  rows: number;
  columns: DatasetColumn[];
  preview: Record<string, unknown>[];
  rawData: Record<string, unknown>[];
}

export interface TrainingConfig {
  id: string;
  name: string;
  sequenceLength: number;
  predictionHorizon: number;
  batchSize: number;
  learningRate: number;
  epochs: number;
  attentionHeads: number;
  embeddingDim: number;
  dropoutRate: number;
  optimizer: 'Adam' | 'AdamW' | 'SGD';
  trainTestSplit: number;
}

export interface TrainingEpoch {
  epoch: number;
  trainLoss: number;
  valLoss: number;
  accuracy: number;
  rmse: number;
  mae: number;
  attentionWeights: number[][];
}

export interface TrainingSession {
  id: string;
  datasetId: string;
  datasetName: string;
  configId: string;
  configName: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt: string;
  completedAt?: string;
  currentEpoch: number;
  totalEpochs: number;
  epochs: TrainingEpoch[];
  selectedFeatures: string[];
  targetColumn: string;
  finalMetrics?: {
    accuracy: number;
    rmse: number;
    mae: number;
    r2: number;
    mape: number;
  };
}

export interface ModelVersion {
  id: string;
  version: string;
  trainingSessionId: string;
  status: 'active' | 'archived' | 'draft';
  accuracy: number;
  mae: number;
  rmse: number;
  r2: number;
  parameters: string;
  createdAt: string;
  epochs: number;
  config: TrainingConfig;
  attentionWeights: number[][];
}

const defaultConfig: TrainingConfig = {
  id: 'default',
  name: 'Default Config',
  sequenceLength: 24,
  predictionHorizon: 6,
  batchSize: 32,
  learningRate: 0.001,
  epochs: 100,
  attentionHeads: 8,
  embeddingDim: 128,
  dropoutRate: 0.1,
  optimizer: 'AdamW',
  trainTestSplit: 80,
};

// Seed model versions
const seedModels: ModelVersion[] = [
  {
    id: 'model-v2.4',
    version: 'v2.4',
    trainingSessionId: 'seed-session-1',
    status: 'active',
    accuracy: 97.3,
    mae: 0.42,
    rmse: 0.58,
    r2: 0.967,
    parameters: '1.2M',
    createdAt: '2026-05-27T10:00:00Z',
    epochs: 100,
    config: { ...defaultConfig, id: 'cfg-1', name: 'Production Config' },
    attentionWeights: Array.from({ length: 8 }, () =>
      Array.from({ length: 24 }, () => Math.random()),
    ),
  },
  {
    id: 'model-v2.3',
    version: 'v2.3',
    trainingSessionId: 'seed-session-2',
    status: 'archived',
    accuracy: 95.8,
    mae: 0.58,
    rmse: 0.72,
    r2: 0.948,
    parameters: '1.1M',
    createdAt: '2026-05-15T10:00:00Z',
    epochs: 100,
    config: { ...defaultConfig, id: 'cfg-2', name: 'Experiment B' },
    attentionWeights: Array.from({ length: 8 }, () =>
      Array.from({ length: 24 }, () => Math.random()),
    ),
  },
  {
    id: 'model-v2.2',
    version: 'v2.2',
    trainingSessionId: 'seed-session-3',
    status: 'archived',
    accuracy: 94.1,
    mae: 0.71,
    rmse: 0.89,
    r2: 0.931,
    parameters: '950K',
    createdAt: '2026-04-28T10:00:00Z',
    epochs: 80,
    config: { ...defaultConfig, id: 'cfg-3', name: 'Experiment A', epochs: 80 },
    attentionWeights: Array.from({ length: 8 }, () =>
      Array.from({ length: 24 }, () => Math.random()),
    ),
  },
];

interface TrainingStore {
  // Datasets
  datasets: UploadedDataset[];
  addDataset: (dataset: UploadedDataset) => void;
  removeDataset: (id: string) => void;

  // Configs
  configs: TrainingConfig[];
  activeConfigId: string;
  addConfig: (config: TrainingConfig) => void;
  updateConfig: (id: string, updates: Partial<TrainingConfig>) => void;
  setActiveConfig: (id: string) => void;
  deleteConfig: (id: string) => void;

  // Training Sessions
  sessions: TrainingSession[];
  activeSessionId: string | null;
  addSession: (session: TrainingSession) => void;
  updateSession: (id: string, updates: Partial<TrainingSession>) => void;
  setActiveSession: (id: string | null) => void;

  // Model Versions
  models: ModelVersion[];
  activeModelId: string;
  addModel: (model: ModelVersion) => void;
  setActiveModel: (id: string) => void;
  archiveModel: (id: string) => void;
  deleteModel: (id: string) => void;
}

export const useTrainingStore = create<TrainingStore>()(
  persist(
    (set) => ({
      // Datasets
      datasets: [],
      addDataset: (dataset) =>
        set((s) => ({ datasets: [dataset, ...s.datasets] })),
      removeDataset: (id) =>
        set((s) => ({ datasets: s.datasets.filter((d) => d.id !== id) })),

      // Configs
      configs: [defaultConfig],
      activeConfigId: 'default',
      addConfig: (config) =>
        set((s) => ({ configs: [...s.configs, config] })),
      updateConfig: (id, updates) =>
        set((s) => ({
          configs: s.configs.map((c) =>
            c.id === id ? { ...c, ...updates } : c,
          ),
        })),
      setActiveConfig: (id) => set({ activeConfigId: id }),
      deleteConfig: (id) =>
        set((s) => ({
          configs: s.configs.filter((c) => c.id !== id),
          activeConfigId:
            s.activeConfigId === id ? 'default' : s.activeConfigId,
        })),

      // Training Sessions
      sessions: [],
      activeSessionId: null,
      addSession: (session) =>
        set((s) => ({ sessions: [session, ...s.sessions], activeSessionId: session.id })),
      updateSession: (id, updates) =>
        set((s) => ({
          sessions: s.sessions.map((ses) =>
            ses.id === id ? { ...ses, ...updates } : ses,
          ),
        })),
      setActiveSession: (id) => set({ activeSessionId: id }),

      // Model Versions
      models: seedModels,
      activeModelId: 'model-v2.4',
      addModel: (model) =>
        set((s) => ({ models: [model, ...s.models] })),
      setActiveModel: (id) =>
        set((s) => ({
          activeModelId: id,
          models: s.models.map((m) => ({
            ...m,
            status: m.id === id ? 'active' as const : m.status === 'active' ? 'archived' as const : m.status,
          })),
        })),
      archiveModel: (id) =>
        set((s) => ({
          models: s.models.map((m) =>
            m.id === id ? { ...m, status: 'archived' as const } : m,
          ),
        })),
      deleteModel: (id) =>
        set((s) => ({
          models: s.models.filter((m) => m.id !== id),
        })),
    }),
    { name: 'velora-training' },
  ),
);
