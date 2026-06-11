"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";
import { useRef } from "react";
import { intelligenceAPI } from "@/lib/api";
import {
  Brain,
  Layers,
  Target,
  BookOpen,
  TrendingUp,
  TrendingDown,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Zap,
  GitBranch,
  Box,
  ArrowDown,
  Download,
  Database,
  FileText,
  Lightbulb,
} from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";
import type { LucideIcon } from "lucide-react";

const sectionFade = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: "easeOut" as const },
  },
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

const itemFade = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: "easeOut" as const },
  },
};

type ResearchCategory =
  | "articles"
  | "inflation"
  | "deflation"
  | "ai-insights"
  | "architecture"
  | "papers";

const CATEGORIES: {
  id: ResearchCategory;
  label: string;
  icon: React.ElementType;
  description: string;
}[] = [
  {
    id: "articles",
    label: "Articles",
    icon: BookOpen,
    description: "Published research articles and economic commentary",
  },
  {
    id: "inflation",
    label: "Inflation Studies",
    icon: TrendingUp,
    description: "Peer-reviewed inflation analysis and case studies",
  },
  {
    id: "deflation",
    label: "Deflation Studies",
    icon: TrendingDown,
    description: "Research on deflation risk and disinflation dynamics",
  },
  {
    id: "ai-insights",
    label: "AI Insights",
    icon: Lightbulb,
    description: "Model-generated research summaries and findings",
  },
  {
    id: "architecture",
    label: "TS-Transformer Docs",
    icon: Layers,
    description: "Technical documentation for the forecasting architecture",
  },
  {
    id: "papers",
    label: "Downloadable Papers",
    icon: Download,
    description: "Academic papers and whitepapers for download",
  },
];

const architectureLayers = [
  {
    id: "input",
    title: "Input Data",
    icon: Database,
    borderColor: "border-l-[var(--text-muted)]",
    description:
      "Raw economic time series data including CPI, interest rates, exchange rates, GDP growth, and other macroeconomic indicators. Data is normalized and preprocessed before entering the model pipeline.",
  },
  {
    id: "embedding",
    title: "Input Embedding",
    icon: Box,
    borderColor: "border-l-[var(--text-secondary)]",
    description:
      "Transforms raw numerical inputs into dense vector representations. Each economic indicator is projected into a continuous embedding space that captures feature relationships.",
  },
  {
    id: "positional",
    title: "Positional Encoding",
    icon: GitBranch,
    borderColor: "border-l-[var(--text-muted)]",
    description:
      "Injects temporal position information using sinusoidal functions. Since Transformers have no inherent notion of sequence order, positional encodings allow the model to understand the chronological ordering of time steps.",
  },
  {
    id: "attention",
    title: "Multi-Head Attention",
    icon: Brain,
    borderColor: "border-l-[var(--text-primary)]",
    description:
      "The core mechanism of the TS-Transformer. Parallel attention heads independently learn different temporal patterns. Each head computes scaled dot-product attention using Query (Q), Key (K), and Value (V) projections.",
    isSpecial: true,
    subComponents: [
      { label: "Q (Query)", desc: "What am I looking for?" },
      { label: "K (Key)", desc: "What do I contain?" },
      { label: "V (Value)", desc: "What information do I carry?" },
    ],
  },
  {
    id: "ffn",
    title: "Feed-Forward Network",
    icon: Zap,
    borderColor: "border-l-[var(--text-secondary)]",
    description:
      "Two-layer MLP with GELU activation applied independently to each position. Introduces non-linearity for complex pattern learning in economic time series.",
  },
  {
    id: "layernorm",
    title: "Layer Normalization",
    icon: Layers,
    borderColor: "border-l-[var(--text-muted)]",
    description:
      "Normalizes activations across the feature dimension. Applied before each sub-layer (Pre-LN variant) with residual connections. Stabilizes training and enables deeper architectures.",
  },
  {
    id: "output",
    title: "Output Projection",
    icon: Target,
    borderColor: "border-l-[var(--text-secondary)]",
    description:
      "Linear projection layer that maps the final hidden state to the prediction space for inflation rate forecasting.",
  },
  {
    id: "prediction",
    title: "Prediction",
    icon: Sparkles,
    borderColor: "border-l-[var(--text-primary)]",
    description:
      "Final inflation rate prediction for the configured forecast horizon. Output is denormalized back to percentage scale and calibrated against historical baselines for confidence scoring.",
  },
];

function AnimatedSection({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <motion.section
      ref={ref}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      variants={sectionFade}
      className={className}
    >
      {children}
    </motion.section>
  );
}

function ArchitectureBox({
  layer,
  index,
}: {
  layer: (typeof architectureLayers)[number];
  index: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const Icon = layer.icon;

  return (
    <motion.div variants={itemFade}>
      {index > 0 && (
        <div className="flex justify-center py-2">
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 32, opacity: 1 }}
            transition={{ delay: index * 0.1, duration: 0.3, ease: "easeOut" as const }}
            className="w-px bg-gradient-to-b from-[var(--text-muted)] to-[var(--border-primary)] relative"
          >
            <ArrowDown className="w-3.5 h-3.5 text-[var(--text-muted)] absolute -bottom-1.5 left-1/2 -translate-x-1/2" />
          </motion.div>
        </div>
      )}

      <button
        onClick={() => setExpanded(!expanded)}
        className={`w-full text-left bg-[var(--glass-bg)] border border-[var(--border-primary)] backdrop-blur-xl rounded-xl
          border-l-4 ${layer.borderColor}
          transition-all duration-300 cursor-pointer
          ${layer.isSpecial ? "p-6" : "p-4"}
          ${expanded ? "ring-1 ring-[var(--border-hover)]" : ""}`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[var(--accent-faint)] text-[var(--text-primary)]">
              <Icon className={layer.isSpecial ? "w-6 h-6" : "w-5 h-5"} />
            </div>
            <div>
              <h4
                className={`font-semibold text-[var(--text-primary)] ${layer.isSpecial ? "text-lg" : "text-sm"}`}
              >
                {layer.title}
              </h4>
              {layer.isSpecial && (
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Multi-head self-attention mechanism
                </p>
              )}
            </div>
          </div>
          <div className="text-[var(--text-muted)]">
            {expanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </div>
        </div>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" as const }}
              className="overflow-hidden"
            >
              <p className="text-sm text-[var(--text-muted)] mt-3 leading-relaxed">
                {layer.description}
              </p>

              {layer.isSpecial && layer.subComponents && (
                <div className="grid grid-cols-3 gap-3 mt-4">
                  {layer.subComponents.map((sub, i) => (
                    <div
                      key={i}
                      className="bg-[var(--glass-bg-hover)] border border-[var(--border-active)] rounded-lg p-3 text-center"
                    >
                      <p className="text-sm font-bold text-[var(--text-primary)]">
                        {sub.label}
                      </p>
                      <p className="text-xs text-[var(--text-muted)] mt-1">
                        {sub.desc}
                      </p>
                    </div>
                  ))}
                </div>
              )}
              {layer.isSpecial && (
                <div className="mt-4 p-3 rounded-lg bg-[var(--accent-faint)] border border-[var(--border-primary)]">
                  <p className="text-xs text-[var(--text-primary)]">
                    Attention(Q, K, V) = softmax(QK^T / sqrt(d_k)) * V
                  </p>
                  <p className="text-xs text-[var(--text-muted)] mt-1">
                    Scaled dot-product attention with per-head dimension splitting
                  </p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </button>
    </motion.div>
  );
}

interface Publication {
  id: string;
  title: string;
  authors: string;
  category: string;
  abstract: string;
  citation?: string | null;
  published_at: string;
}

const CATEGORY_API_MAP: Partial<Record<ResearchCategory, string>> = {
  inflation: "inflation",
  deflation: "deflation",
  "ai-insights": "ai-insights",
  papers: "papers",
  articles: "articles",
  architecture: "architecture",
};

function PublicationsList({
  publications,
  category,
}: {
  publications: Publication[];
  category: ResearchCategory;
}) {
  const filtered = publications.filter((p) => {
    if (category === "papers") return true;
    const apiCat = CATEGORY_API_MAP[category];
    return apiCat ? p.category === apiCat || p.category.includes(apiCat) : true;
  });

  if (!filtered.length) {
    return null;
  }

  return (
    <div className="space-y-4">
      {filtered.map((pub) => (
        <div
          key={pub.id}
          className="glass-card rounded-xl hover:transform-none p-5"
        >
          <h3 className="font-semibold text-[var(--text-primary)]">{pub.title}</h3>
          <p className="mt-1 text-xs text-[var(--text-muted)]">{pub.authors}</p>
          <p className="mt-3 text-sm text-[var(--text-secondary)] leading-relaxed">
            {pub.abstract}
          </p>
          {pub.citation && (
            <p className="mt-3 text-xs text-[var(--text-faint)] italic">{pub.citation}</p>
          )}
        </div>
      ))}
    </div>
  );
}

function CategoryContent({
  category,
  publications,
}: {
  category: ResearchCategory;
  publications: Publication[];
}) {
  if (category === "architecture") {
    return (
      <div className="space-y-6">
        <div className="rounded-xl bg-[var(--glass-bg)] border border-[var(--border-primary)] p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 rounded-xl bg-[var(--accent-faint)] text-[var(--text-primary)]">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[var(--text-primary)]">
                TS-Transformer Architecture
              </h3>
              <p className="text-sm text-[var(--text-muted)]">
                Time-series Transformer for inflation forecasting
              </p>
            </div>
          </div>

          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="max-w-2xl mx-auto"
          >
            {architectureLayers.map((layer, index) => (
              <ArchitectureBox key={layer.id} layer={layer} index={index} />
            ))}
          </motion.div>

          <div className="mt-6 text-center">
            <p className="text-xs text-[var(--text-muted)]">
              Transformer encoder layers stacked sequentially with Pre-LN variant and
              residual connections
            </p>
          </div>
        </div>

        <div className="rounded-xl bg-[var(--glass-bg)] border border-[var(--border-primary)] p-6">
          <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-3">
            Model Overview
          </h4>
          <div className="space-y-3 text-sm text-[var(--text-muted)] leading-relaxed">
            <p>
              The TS-Transformer is a time-series adaptation of the Transformer architecture
              designed specifically for macroeconomic forecasting. Unlike traditional
              recurrent models, it uses self-attention to capture long-range dependencies
              across economic indicators without sequential processing bottlenecks.
            </p>
            <p>
              Input sequences consist of normalized economic features spanning a configurable
              lookback window. The model outputs point forecasts with confidence intervals
              for inflation rates over a multi-month horizon.
            </p>
            <p>
              Key design choices include Pre-Layer Normalization for training stability,
              multi-head attention for parallel pattern detection, and GELU activations in
              feed-forward layers for smooth non-linear transformations.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const emptyConfig: Record<
    Exclude<ResearchCategory, "architecture">,
    { icon: LucideIcon; title: string; description: string }
  > = {
    articles: {
      icon: FileText,
      title: "No research publications available",
      description:
        "Academic articles and economic commentary will appear here once published and indexed.",
    },
    inflation: {
      icon: TrendingUp,
      title: "No inflation studies available",
      description:
        "Peer-reviewed inflation research and case studies will be listed here when published.",
    },
    deflation: {
      icon: TrendingDown,
      title: "No deflation studies available",
      description:
        "Research on deflation risk and disinflation dynamics will appear here once available.",
    },
    "ai-insights": {
      icon: Lightbulb,
      title: "No AI insights available",
      description:
        "Model-generated research summaries will be published here after analysis runs complete.",
    },
    papers: {
      icon: Download,
      title: "No downloadable papers available",
      description:
        "Academic papers and whitepapers will be available for download once they are published.",
    },
  };

  const apiCat = CATEGORY_API_MAP[category];
  const filtered = publications.filter((p) => {
    if (category === "papers") return true;
    return apiCat ? p.category === apiCat || p.category.includes(apiCat) : false;
  });
  if (filtered.length > 0) {
    return <PublicationsList publications={publications} category={category} />;
  }

  const config = emptyConfig[category as Exclude<ResearchCategory, "architecture">];
  return (
    <EmptyState icon={config.icon} title={config.title} description={config.description} />
  );
}

export default function ResearchPage() {
  const [activeCategory, setActiveCategory] =
    useState<ResearchCategory>("architecture");
  const [publications, setPublications] = useState<Publication[]>([]);

  const loadPublications = useCallback(async () => {
    try {
      const { data } = await intelligenceAPI.listResearch();
      const pubs = (data.publications ?? data) as Publication[];
      setPublications(Array.isArray(pubs) ? pubs : []);
    } catch {
      setPublications([]);
    }
  }, []);

  useEffect(() => {
    void loadPublications();
  }, [loadPublications]);

  return (
    <div className="space-y-8 pb-12">
      <AnimatedSection>
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold text-[var(--text-primary)]">
              Research Center
            </h1>
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[var(--accent-faint)] text-[var(--text-secondary)] border border-[var(--border-primary)]">
              Academic
            </span>
          </div>
          <p className="text-[var(--text-muted)] text-sm max-w-2xl">
            Explore published research, economic studies, AI-generated insights, and
            technical documentation for the TS-Transformer forecasting model.
          </p>
        </div>
      </AnimatedSection>

      {/* Category Navigation */}
      <AnimatedSection>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const active = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                id={`research-cat-${cat.id}`}
                onClick={() => setActiveCategory(cat.id)}
                className={`rounded-xl border p-4 text-left transition ${
                  active
                    ? "bg-[var(--accent-faint)] border-[var(--border-active)]"
                    : "bg-[var(--glass-bg)] border-[var(--border-primary)] hover:bg-[var(--glass-bg-hover)] hover:border-[var(--border-hover)]"
                }`}
              >
                <Icon
                  className={`w-5 h-5 mb-2 ${active ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"}`}
                />
                <p className="text-xs font-semibold text-[var(--text-primary)]">
                  {cat.label}
                </p>
                <p className="text-[10px] text-[var(--text-muted)] mt-0.5 line-clamp-2">
                  {cat.description}
                </p>
              </button>
            );
          })}
        </div>
      </AnimatedSection>

      {/* Category Content */}
      <AnimatedSection>
        <CategoryContent category={activeCategory} publications={publications} />
      </AnimatedSection>
    </div>
  );
}