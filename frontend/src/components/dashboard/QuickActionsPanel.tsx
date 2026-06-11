'use client';

import Link from 'next/link';
import {
  TrendingUp,
  FileText,
  GitCompare,
  Download,
  FlaskConical,
  Globe,
} from 'lucide-react';
import GlowCard from '@/components/ui/GlowCard';

const ACTIONS = [
  { label: 'Generate New Prediction', href: '/dashboard/predictions', icon: TrendingUp },
  { label: 'View Country Report', href: '/dashboard/reports', icon: FileText },
  { label: 'Compare Countries', href: '/dashboard/countries', icon: GitCompare },
  { label: 'Download Economic Report', href: '/dashboard/reports', icon: Download },
  { label: 'Open Research Center', href: '/dashboard/research', icon: FlaskConical },
  { label: 'Manage Tracked Countries', href: '/dashboard#tracked-countries', icon: Globe },
];

export default function QuickActionsPanel() {
  return (
    <GlowCard id="quick-actions" className="p-5">
      <h2 className="mb-4 text-lg font-semibold text-[var(--text-primary)]">Quick Actions</h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {ACTIONS.map((action) => (
          <Link
            key={action.label}
            href={action.href}
            className="flex items-center gap-2 rounded-xl border border-[var(--border-primary)] bg-[var(--accent-faint)]/50 px-3 py-2.5 text-xs font-medium text-[var(--text-secondary)] transition hover:border-[var(--border-hover)] hover:bg-[var(--glass-bg-hover)] hover:text-[var(--text-primary)]"
          >
            <action.icon className="h-4 w-4 shrink-0" />
            {action.label}
          </Link>
        ))}
      </div>
    </GlowCard>
  );
}