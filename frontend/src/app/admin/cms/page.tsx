'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Type,
  Layers,
  MessageSquareQuote,
  HelpCircle,
  Save,
  Layout,
  BarChart2,
  Megaphone,
  PanelBottom,
  Loader2,
} from 'lucide-react';
import { useAdminSettingsBundle } from '@/hooks/useAdminSettingsBundle';

type TabKey =
  | 'hero'
  | 'features'
  | 'testimonials'
  | 'faq'
  | 'sections'
  | 'footer'
  | 'dashboard';

const tabs: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: 'hero', label: 'Hero', icon: Type },
  { key: 'features', label: 'Features', icon: Layers },
  { key: 'testimonials', label: 'Testimonials', icon: MessageSquareQuote },
  { key: 'faq', label: 'FAQ', icon: HelpCircle },
  { key: 'sections', label: 'Sections', icon: Layout },
  { key: 'footer', label: 'Footer', icon: PanelBottom },
  { key: 'dashboard', label: 'Dashboard Copy', icon: BarChart2 },
];

function CmsInput({
  id,
  label,
  value,
  onChange,
  multiline = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
}) {
  const cls =
    'w-full rounded-xl border border-[var(--border-hover)] bg-[var(--accent-faint)] px-4 py-2.5 text-sm text-[var(--text-primary)] placeholder-slate-600 outline-none transition focus:border-[var(--border-active)]/50 focus:ring-1 focus:ring-[var(--border-hover)]';
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
        {label}
      </label>
      {multiline ? (
        <textarea id={id} value={value} onChange={(e) => onChange(e.target.value)} rows={3} className={`${cls} resize-none`} />
      ) : (
        <input id={id} type="text" value={value} onChange={(e) => onChange(e.target.value)} className={cls} />
      )}
    </div>
  );
}

export default function CmsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('hero');
  const {
    bundle,
    loading,
    saving,
    updateCms,
    updateDashboard,
    saveSection,
  } = useAdminSettingsBundle();

  const cms = bundle.cms;

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-[var(--text-muted)]">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading CMS content…
      </div>
    );
  }

  const saveCms = () => void saveSection('cms', cms as unknown as Record<string, unknown>);
  const saveDashboard = () => void saveSection('dashboard', bundle.dashboard as unknown as Record<string, unknown>);

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-[var(--text-primary)] sm:text-3xl">Content Management</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Edit landing page and dashboard copy — changes sync to the live site immediately.
        </p>
      </motion.div>

      <div className="flex gap-1 overflow-x-auto glass-card rounded-xl hover:transform-none p-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              id={`cms-tab-${tab.key}`}
              onClick={() => setActiveTab(tab.key)}
              className={`relative flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-medium transition ${
                active ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
              }`}
            >
              {active && (
                <motion.div layoutId="cms-tab-bg" className="absolute inset-0 rounded-lg bg-[var(--accent-faint)]" />
              )}
              <span className="relative z-10 flex items-center gap-2">
                <Icon size={16} />
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'hero' && (
          <motion.div key="hero" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-5 glass-card rounded-xl p-6">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Hero Section</h2>
            <CmsInput id="cms-hero-badge" label="Badge" value={cms.hero.badge} onChange={(v) => updateCms({ ...cms, hero: { ...cms.hero, badge: v } })} />
            <div className="grid gap-4 md:grid-cols-3">
              <CmsInput id="cms-hero-before" label="Headline (before highlight)" value={cms.hero.headlineBefore} onChange={(v) => updateCms({ ...cms, hero: { ...cms.hero, headlineBefore: v } })} />
              <CmsInput id="cms-hero-highlight" label="Highlighted word" value={cms.hero.headlineHighlight} onChange={(v) => updateCms({ ...cms, hero: { ...cms.hero, headlineHighlight: v } })} />
              <CmsInput id="cms-hero-after" label="Headline (after highlight)" value={cms.hero.headlineAfter} onChange={(v) => updateCms({ ...cms, hero: { ...cms.hero, headlineAfter: v } })} />
            </div>
            <CmsInput id="cms-hero-subtitle" label="Subtitle" value={cms.hero.subtitle} onChange={(v) => updateCms({ ...cms, hero: { ...cms.hero, subtitle: v } })} multiline />
            <div className="grid gap-4 md:grid-cols-2">
              <CmsInput id="cms-hero-primary-cta" label="Primary CTA" value={cms.hero.primaryCta} onChange={(v) => updateCms({ ...cms, hero: { ...cms.hero, primaryCta: v } })} />
              <CmsInput id="cms-hero-secondary-cta" label="Secondary CTA" value={cms.hero.secondaryCta} onChange={(v) => updateCms({ ...cms, hero: { ...cms.hero, secondaryCta: v } })} />
            </div>
            {cms.hero.stats.map((stat, idx) => (
              <div key={idx} className="grid gap-4 md:grid-cols-2">
                <CmsInput id={`cms-stat-val-${idx}`} label={`Stat ${idx + 1} value`} value={stat.value} onChange={(v) => {
                  const stats = [...cms.hero.stats];
                  stats[idx] = { ...stats[idx], value: v };
                  updateCms({ ...cms, hero: { ...cms.hero, stats } });
                }} />
                <CmsInput id={`cms-stat-label-${idx}`} label={`Stat ${idx + 1} label`} value={stat.label} onChange={(v) => {
                  const stats = [...cms.hero.stats];
                  stats[idx] = { ...stats[idx], label: v };
                  updateCms({ ...cms, hero: { ...cms.hero, stats } });
                }} />
              </div>
            ))}
            <SaveButton onClick={saveCms} saving={saving} label="Save Hero" />
          </motion.div>
        )}

        {activeTab === 'features' && (
          <motion.div key="features" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-5">
            <CmsInput id="cms-features-eyebrow" label="Section eyebrow" value={cms.features.eyebrow} onChange={(v) => updateCms({ ...cms, features: { ...cms.features, eyebrow: v } })} />
            <CmsInput id="cms-features-title" label="Section title" value={cms.features.title} onChange={(v) => updateCms({ ...cms, features: { ...cms.features, title: v } })} />
            <CmsInput id="cms-features-subtitle" label="Section subtitle" value={cms.features.subtitle} onChange={(v) => updateCms({ ...cms, features: { ...cms.features, subtitle: v } })} multiline />
            {cms.features.items.map((feat, idx) => (
              <div key={idx} className="glass-card rounded-xl p-5">
                <p className="mb-3 text-sm font-semibold text-[var(--text-muted)]">Feature {idx + 1}</p>
                <div className="grid gap-4 md:grid-cols-3">
                  <CmsInput id={`cms-feat-icon-${idx}`} label="Icon" value={feat.icon} onChange={(v) => {
                    const items = [...cms.features.items];
                    items[idx] = { ...items[idx], icon: v };
                    updateCms({ ...cms, features: { ...cms.features, items } });
                  }} />
                  <CmsInput id={`cms-feat-title-${idx}`} label="Title" value={feat.title} onChange={(v) => {
                    const items = [...cms.features.items];
                    items[idx] = { ...items[idx], title: v };
                    updateCms({ ...cms, features: { ...cms.features, items } });
                  }} />
                  <CmsInput id={`cms-feat-desc-${idx}`} label="Description" value={feat.description} onChange={(v) => {
                    const items = [...cms.features.items];
                    items[idx] = { ...items[idx], description: v };
                    updateCms({ ...cms, features: { ...cms.features, items } });
                  }} />
                </div>
              </div>
            ))}
            <SaveButton onClick={saveCms} saving={saving} label="Save Features" />
          </motion.div>
        )}

        {activeTab === 'testimonials' && (
          <motion.div key="testimonials" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-5">
            <CmsInput id="cms-testimonials-title" label="Section title" value={cms.testimonials.title} onChange={(v) => updateCms({ ...cms, testimonials: { ...cms.testimonials, title: v } })} />
            {cms.testimonials.items.map((t, idx) => (
              <div key={idx} className="glass-card rounded-xl p-5 space-y-4">
                <CmsInput id={`cms-test-quote-${idx}`} label="Quote" value={t.quote} onChange={(v) => {
                  const items = [...cms.testimonials.items];
                  items[idx] = { ...items[idx], quote: v };
                  updateCms({ ...cms, testimonials: { ...cms.testimonials, items } });
                }} multiline />
                <div className="grid gap-4 md:grid-cols-2">
                  <CmsInput id={`cms-test-author-${idx}`} label="Author" value={t.author} onChange={(v) => {
                    const items = [...cms.testimonials.items];
                    items[idx] = { ...items[idx], author: v };
                    updateCms({ ...cms, testimonials: { ...cms.testimonials, items } });
                  }} />
                  <CmsInput id={`cms-test-title-${idx}`} label="Role" value={t.title} onChange={(v) => {
                    const items = [...cms.testimonials.items];
                    items[idx] = { ...items[idx], title: v };
                    updateCms({ ...cms, testimonials: { ...cms.testimonials, items } });
                  }} />
                </div>
              </div>
            ))}
            <SaveButton onClick={saveCms} saving={saving} label="Save Testimonials" />
          </motion.div>
        )}

        {activeTab === 'faq' && (
          <motion.div key="faq" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-5">
            <CmsInput id="cms-faq-title" label="Section title" value={cms.faq.title} onChange={(v) => updateCms({ ...cms, faq: { ...cms.faq, title: v } })} />
            {cms.faq.items.map((faq, idx) => (
              <div key={idx} className="glass-card rounded-xl p-5 space-y-4">
                <CmsInput id={`cms-faq-q-${idx}`} label="Question" value={faq.question} onChange={(v) => {
                  const items = [...cms.faq.items];
                  items[idx] = { ...items[idx], question: v };
                  updateCms({ ...cms, faq: { ...cms.faq, items } });
                }} />
                <CmsInput id={`cms-faq-a-${idx}`} label="Answer" value={faq.answer} onChange={(v) => {
                  const items = [...cms.faq.items];
                  items[idx] = { ...items[idx], answer: v };
                  updateCms({ ...cms, faq: { ...cms.faq, items } });
                }} multiline />
              </div>
            ))}
            <SaveButton onClick={saveCms} saving={saving} label="Save FAQ" />
          </motion.div>
        )}

        {activeTab === 'sections' && (
          <motion.div key="sections" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-5 glass-card rounded-xl p-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-[var(--text-primary)]"><Megaphone size={18} /> Navbar & CTA</h2>
            <div className="grid gap-4 md:grid-cols-3">
              <CmsInput id="cms-nav-emoji" label="Brand emoji" value={cms.navbar.brandEmoji} onChange={(v) => updateCms({ ...cms, navbar: { ...cms.navbar, brandEmoji: v } })} />
              <CmsInput id="cms-nav-name" label="Brand name" value={cms.navbar.brandName} onChange={(v) => updateCms({ ...cms, navbar: { ...cms.navbar, brandName: v } })} />
              <CmsInput id="cms-nav-cta" label="Nav CTA" value={cms.navbar.ctaLabel} onChange={(v) => updateCms({ ...cms, navbar: { ...cms.navbar, ctaLabel: v } })} />
            </div>
            <CmsInput id="cms-cta-title" label="CTA title" value={cms.cta.title} onChange={(v) => updateCms({ ...cms, cta: { ...cms.cta, title: v } })} />
            <CmsInput id="cms-cta-subtitle" label="CTA subtitle" value={cms.cta.subtitle} onChange={(v) => updateCms({ ...cms, cta: { ...cms.cta, subtitle: v } })} multiline />
            <CmsInput id="cms-trusted-title" label="Trusted by title" value={cms.trustedBy.title} onChange={(v) => updateCms({ ...cms, trustedBy: { ...cms.trustedBy, title: v } })} />
            <SaveButton onClick={saveCms} saving={saving} label="Save Sections" />
          </motion.div>
        )}

        {activeTab === 'footer' && (
          <motion.div key="footer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-5 glass-card rounded-xl p-6">
            <CmsInput id="cms-footer-tagline" label="Tagline" value={cms.footer.tagline} onChange={(v) => updateCms({ ...cms, footer: { ...cms.footer, tagline: v } })} />
            <CmsInput id="cms-footer-copyright" label="Copyright (use {year})" value={cms.footer.copyright} onChange={(v) => updateCms({ ...cms, footer: { ...cms.footer, copyright: v } })} />
            <SaveButton onClick={saveCms} saving={saving} label="Save Footer" />
          </motion.div>
        )}

        {activeTab === 'dashboard' && (
          <motion.div key="dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-5 glass-card rounded-xl p-6">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Dashboard Labels</h2>
            {Object.entries(bundle.dashboard).map(([key, value]) => (
              <CmsInput
                key={key}
                id={`dash-${key}`}
                label={key.replace(/([A-Z])/g, ' $1').trim()}
                value={String(value)}
                onChange={(v) => updateDashboard({ ...bundle.dashboard, [key]: v })}
              />
            ))}
            <SaveButton onClick={saveDashboard} saving={saving} label="Save Dashboard Copy" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SaveButton({ onClick, saving, label }: { onClick: () => void; saving: boolean; label: string }) {
  return (
    <button
      onClick={onClick}
      disabled={saving}
      className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent-faint)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition hover:bg-white/10 disabled:opacity-50"
    >
      {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
      {saving ? 'Saving…' : label}
    </button>
  );
}