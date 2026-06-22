'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { FlaskConical, ExternalLink } from 'lucide-react';
import Link from 'next/link';

export default function AdminResearchPage() {
  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--accent)] to-[#3b82f6] shadow-[0_0_20px_rgba(255,255,255,0.08)]">
            <FlaskConical size={20} className="text-[var(--text-primary)]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">Research Mode</h1>
            <p className="text-sm text-[var(--text-muted)]">Academic research tools and model explainability</p>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-card rounded-xl hover:transform-none p-8 text-center"
      >
        <div className="mx-auto w-16 h-16 rounded-2xl bg-[var(--accent-faint)] flex items-center justify-center mb-4">
          <FlaskConical size={32} className="text-[var(--text-primary)]" />
        </div>
        <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">Research Dashboard</h2>
        <p className="text-sm text-[var(--text-muted)] max-w-md mx-auto mb-6">
          The full Research Mode with architecture diagrams, attention visualizations, feature importance analysis, and model performance metrics is available in the user dashboard.
        </p>
        <Link
          href="/dashboard/research"
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--accent)] to-[#3b82f6] px-6 py-3 text-sm font-semibold text-[var(--text-primary)] shadow-lg shadow-black/20 transition hover:shadow-black/30"
        >
          Open Research Mode <ExternalLink size={16} />
        </Link>
      </motion.div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Model Architecture', value: 'TS-Transformer', sub: 'Multi-Head Attention' },
          { label: 'Total Parameters', value: '1.2M', sub: 'Trainable weights' },
          { label: 'Best Accuracy', value: '97.3%', sub: 'Validation set' },
        ].map((item: any, i: number) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + i * 0.1 }}
            className="glass-card rounded-xl hover:transform-none p-5"
          >
            <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider">{item.label}</p>
            <p className="text-2xl font-bold text-[var(--text-primary)] mt-1">{item.value}</p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">{item.sub}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
