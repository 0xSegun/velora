'use client';

import React, { useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  Key,
  Palette,
  Search as SearchIcon,
  Globe,
  Eye,
  EyeOff,
  Save,
  FileText,
  Loader2,
  Image,
} from 'lucide-react';
import { useAdminSettingsBundle } from '@/hooks/useAdminSettingsBundle';
import ToggleSwitch from '@/components/ui/ToggleSwitch';

const sectionVariants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

function GlassInput({
  id,
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-[var(--text-muted)]">{label}</label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="app-input w-full rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] outline-none transition"
      />
    </div>
  );
}

function PasswordInput({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (v: string) => void }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-[var(--text-muted)]">{label}</label>
      <div className="relative">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="app-input w-full rounded-xl px-4 py-2.5 pr-10 text-sm text-[var(--text-primary)] outline-none"
        />
        <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </div>
  );
}

function GlassTextarea({ id, label, value, onChange, rows = 3 }: { id: string; label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-[var(--text-muted)]">{label}</label>
      <textarea id={id} value={value} onChange={(e) => onChange(e.target.value)} rows={rows} className="app-input w-full resize-none rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] outline-none" />
    </div>
  );
}

function LabeledToggle({ id, label, description, checked, onChange, danger = false }: { id: string; label: string; description?: string; checked: boolean; onChange: (v: boolean) => void; danger?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className={`text-sm font-medium ${danger ? 'text-amber-400' : 'text-[var(--text-secondary)]'}`}>{label}</p>
        {description && <p className="text-xs text-[var(--text-muted)]">{description}</p>}
      </div>
      <ToggleSwitch id={id} checked={checked} onChange={onChange} danger={danger} aria-label={label} />
    </div>
  );
}

function SaveBtn({ onClick, saving, label }: { onClick: () => void; saving: boolean; label: string }) {
  return (
    <button onClick={onClick} disabled={saving} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[var(--accent-faint)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] disabled:opacity-50">
      {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
      {saving ? 'Saving…' : label}
    </button>
  );
}

export default function SettingsPage() {
  const {
    bundle,
    loading,
    saving,
    saveSection,
    updateBranding,
    updateSeo,
    updateGeneral,
    updateLegal,
  } = useAdminSettingsBundle();

  const [credentials, setCredentials] = useState({ fredKey: '', resendKey: '', resendFrom: 'noreply@velora.io' });

  React.useEffect(() => {
    if (bundle.credentials) {
      setCredentials({
        fredKey: bundle.credentials.fredKey ?? '',
        resendKey: bundle.credentials.resendKey ?? '',
        resendFrom: bundle.credentials.resendFrom ?? 'noreply@velora.io',
      });
    }
  }, [bundle.credentials]);

  const saveBranding = useCallback(() => void saveSection('branding', bundle.branding as unknown as Record<string, unknown>), [bundle.branding, saveSection]);
  const saveSeo = useCallback(() => void saveSection('seo', bundle.seo as unknown as Record<string, unknown>), [bundle.seo, saveSection]);
  const saveGeneral = useCallback(() => void saveSection('general', bundle.general as unknown as Record<string, unknown>), [bundle.general, saveSection]);
  const saveLegal = useCallback(() => void saveSection('legal', bundle.legal as unknown as Record<string, unknown>), [bundle.legal, saveSection]);
  const saveCredentials = useCallback(() => void saveSection('credentials', credentials), [credentials, saveSection]);

  if (loading) {
    return <p className="text-sm text-[var(--text-muted)]">Loading platform settings…</p>;
  }

  const { branding, seo, general, legal } = bundle;

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-[var(--text-primary)] sm:text-3xl">Platform Settings</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">SEO, branding, credentials, and legal content — synced to the live site.</p>
      </motion.div>

      <motion.section variants={sectionVariants} initial="hidden" animate="show" className="glass-card rounded-xl p-6">
        <div className="mb-5 flex items-center gap-2.5">
          <Key size={16} className="text-[var(--text-primary)]" />
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">API Credentials</h2>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <PasswordInput id="settings-fred-key" label="FRED API Key" value={credentials.fredKey} onChange={(v) => setCredentials((c) => ({ ...c, fredKey: v }))} />
          <PasswordInput id="settings-resend-key" label="Resend API Key" value={credentials.resendKey} onChange={(v) => setCredentials((c) => ({ ...c, resendKey: v }))} />
          <GlassInput id="settings-resend-from" label="Resend From Email" value={credentials.resendFrom} onChange={(v) => setCredentials((c) => ({ ...c, resendFrom: v }))} />
        </div>
        <p className="mt-2 text-xs text-[var(--text-faint)]">Google OAuth is managed in Authentication settings.</p>
        <SaveBtn onClick={saveCredentials} saving={saving} label="Save Credentials" />
      </motion.section>

      <motion.section variants={sectionVariants} initial="hidden" animate="show" className="glass-card rounded-xl p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5"><Palette size={16} /><h2 className="text-lg font-semibold text-[var(--text-primary)]">Branding</h2></div>
          <Link href="/admin/branding" className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-hover)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
            <Image size={14} /> Logo, favicon, fonts & social images
          </Link>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <GlassInput id="settings-site-name" label="Site Name" value={branding.siteName} onChange={(v) => updateBranding({ ...branding, siteName: v })} />
          <GlassInput id="settings-primary-color" label="Primary Color" value={branding.primaryColor} onChange={(v) => updateBranding({ ...branding, primaryColor: v })} />
          <div className="md:col-span-2"><GlassTextarea id="settings-site-desc" label="Site Description" value={branding.siteDesc} onChange={(v) => updateBranding({ ...branding, siteDesc: v })} /></div>
        </div>
        <SaveBtn onClick={saveBranding} saving={saving} label="Save Branding" />
      </motion.section>

      <motion.section variants={sectionVariants} initial="hidden" animate="show" className="glass-card rounded-xl p-6">
        <div className="mb-5 flex items-center gap-2.5"><SearchIcon size={16} className="text-blue-400" /><h2 className="text-lg font-semibold text-[var(--text-primary)]">SEO & Analytics Scripts</h2></div>
        <div className="grid gap-5 md:grid-cols-2">
          <GlassInput id="settings-meta-title" label="Meta Title" value={seo.metaTitle} onChange={(v) => updateSeo({ ...seo, metaTitle: v })} />
          <GlassInput id="settings-keywords" label="Keywords" value={seo.keywords} onChange={(v) => updateSeo({ ...seo, keywords: v })} />
          <div className="md:col-span-2"><GlassTextarea id="settings-meta-desc" label="Meta Description" value={seo.metaDescription} onChange={(v) => updateSeo({ ...seo, metaDescription: v })} /></div>
          <GlassInput id="settings-og-image" label="OG Image URL" value={seo.ogImage} onChange={(v) => updateSeo({ ...seo, ogImage: v })} placeholder="Or upload in Brand Assets" />
          <GlassInput id="settings-twitter-image" label="Twitter Card Image URL" value={seo.twitterImage} onChange={(v) => updateSeo({ ...seo, twitterImage: v })} placeholder="Optional — falls back to OG image" />
          <GlassInput id="settings-canonical" label="Canonical URL" value={seo.canonicalUrl} onChange={(v) => updateSeo({ ...seo, canonicalUrl: v })} />
          <GlassInput id="settings-robots" label="Robots" value={seo.robots} onChange={(v) => updateSeo({ ...seo, robots: v })} />
          <GlassInput id="settings-twitter" label="Twitter @site" value={seo.twitterSite} onChange={(v) => updateSeo({ ...seo, twitterSite: v })} />
          <GlassInput id="settings-ga" label="Google Analytics ID" value={seo.googleAnalyticsId} onChange={(v) => updateSeo({ ...seo, googleAnalyticsId: v })} placeholder="G-XXXXXXXX" />
          <GlassInput id="settings-gtm" label="Google Tag Manager ID" value={seo.googleTagManagerId} onChange={(v) => updateSeo({ ...seo, googleTagManagerId: v })} placeholder="GTM-XXXXXXX" />
          <GlassInput id="settings-plausible" label="Plausible Domain" value={seo.plausibleDomain} onChange={(v) => updateSeo({ ...seo, plausibleDomain: v })} />
        </div>
        <div className="mt-4 glass-card rounded-xl p-4 text-xs text-[var(--text-muted)]">
          <p className="font-medium text-[var(--text-secondary)]">Search preview</p>
          <p className="mt-2 text-blue-400">{seo.metaTitle}</p>
          <p className="text-emerald-400/80">velora.io</p>
          <p className="mt-1">{seo.metaDescription}</p>
        </div>
        <SaveBtn onClick={saveSeo} saving={saving} label="Save SEO" />
      </motion.section>

      <motion.section variants={sectionVariants} initial="hidden" animate="show" className="glass-card rounded-xl p-6">
        <div className="mb-5 flex items-center gap-2.5"><Globe size={16} className="text-emerald-400" /><h2 className="text-lg font-semibold text-[var(--text-primary)]">General</h2></div>
        <div className="grid gap-5 md:grid-cols-2">
          <GlassInput id="settings-default-country" label="Default Country Code" value={general.defaultCountry} onChange={(v) => updateGeneral({ ...general, defaultCountry: v })} />
          <GlassInput id="settings-default-lang" label="Default Language" value={general.defaultLang} onChange={(v) => updateGeneral({ ...general, defaultLang: v })} />
          <GlassInput id="settings-support-email" label="Support Email" value={general.supportEmail} onChange={(v) => updateGeneral({ ...general, supportEmail: v })} />
          <div className="md:col-span-2"><GlassTextarea id="settings-maintenance-msg" label="Maintenance Message" value={general.maintenanceMessage} onChange={(v) => updateGeneral({ ...general, maintenanceMessage: v })} /></div>
        </div>
        <div className="mt-5 space-y-4">
          <LabeledToggle id="settings-enable-registration" label="Enable Registration" checked={general.enableRegistration} onChange={(v) => updateGeneral({ ...general, enableRegistration: v })} />
          <LabeledToggle id="settings-maintenance-mode" label="Maintenance Mode" checked={general.maintenance} onChange={(v) => updateGeneral({ ...general, maintenance: v })} danger />
        </div>
        <SaveBtn onClick={saveGeneral} saving={saving} label="Save General" />
      </motion.section>

      <motion.section variants={sectionVariants} initial="hidden" animate="show" className="glass-card rounded-xl p-6">
        <div className="mb-5 flex items-center gap-2.5"><FileText size={16} /><h2 className="text-lg font-semibold text-[var(--text-primary)]">Legal Content</h2></div>
        <GlassInput id="legal-privacy-title" label="Privacy Title" value={legal.privacyTitle} onChange={(v) => updateLegal({ ...legal, privacyTitle: v })} />
        <div className="mt-4"><GlassTextarea id="legal-privacy-content" label="Privacy Content" value={legal.privacyContent} onChange={(v) => updateLegal({ ...legal, privacyContent: v })} rows={5} /></div>
        <div className="mt-4"><GlassInput id="legal-terms-title" label="Terms Title" value={legal.termsTitle} onChange={(v) => updateLegal({ ...legal, termsTitle: v })} /></div>
        <div className="mt-4"><GlassTextarea id="legal-terms-content" label="Terms Content" value={legal.termsContent} onChange={(v) => updateLegal({ ...legal, termsContent: v })} rows={5} /></div>
        <SaveBtn onClick={saveLegal} saving={saving} label="Save Legal" />
      </motion.section>
    </div>
  );
}