"use client";

import { useCallback } from "react";
import { motion } from "framer-motion";
import {
  Image,
  Loader2,
  Palette,
  Save,
  Share2,
  Type,
} from "lucide-react";
import AssetUploadField from "@/components/admin/AssetUploadField";
import { useAdminSettingsBundle } from "@/hooks/useAdminSettingsBundle";
import { adminAPI } from "@/lib/api";
import { toast } from "@/lib/feedback";
import { GOOGLE_FONT_OPTIONS } from "@/lib/googleFonts";

function FontSelect({
  id,
  label,
  value,
  onChange,
  filter,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  filter?: string;
}) {
  const options = filter
    ? GOOGLE_FONT_OPTIONS.filter((f) => f.category === filter)
    : GOOGLE_FONT_OPTIONS;

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-[var(--text-muted)]">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-[var(--border-hover)] bg-[var(--accent-faint)] px-4 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-active)]"
      >
        {options.map((font) => (
          <option key={font.id} value={font.id}>
            {font.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function BrandingPage() {
  const {
    bundle,
    loading,
    saving,
    saveSection,
    updateBranding,
    updateSeo,
    load,
  } = useAdminSettingsBundle();

  const uploadAsset = useCallback(async (assetType: string, file: File) => {
    const { data } = await adminAPI.uploadBrandingAsset(assetType, file);
    await load();
    return String(data.url ?? "");
  }, [load]);

  const saveBranding = () => void saveSection("branding", bundle.branding as unknown as Record<string, unknown>);
  const saveSeo = () => void saveSection("seo", bundle.seo as unknown as Record<string, unknown>);
  const saveAll = async () => {
    try {
      await adminAPI.updateSettingsBundle({
        branding: bundle.branding as unknown as Record<string, unknown>,
        seo: bundle.seo as unknown as Record<string, unknown>,
      });
      toast.success("All brand settings saved.");
      await load();
    } catch {
      toast.error("Failed to save brand settings.");
    }
  };

  if (loading) {
    return (
      <p className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading brand settings…
      </p>
    );
  }

  const { branding, seo } = bundle;
  const twitterPreview = seo.twitterImage || seo.ogImage;

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-[var(--text-primary)] sm:text-3xl">
          Brand Assets & Typography
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Upload your logo, favicon, social share images, and configure site fonts. Changes apply across the public website.
        </p>
      </motion.div>

      <section className="glass-card space-y-4 rounded-xl p-6">
        <div className="flex items-center gap-2">
          <Image size={18} className="text-[var(--text-primary)]" />
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Logo & Favicon</h2>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <AssetUploadField
            id="brand-logo"
            label="Website Logo"
            hint="PNG or SVG recommended. Shown in navbar and footer."
            value={branding.logoUrl}
            onUrlChange={(url) => updateBranding({ ...branding, logoUrl: url })}
            onUpload={(file) => uploadAsset("logo", file)}
            previewClassName="h-20 w-40"
          />
          <AssetUploadField
            id="brand-favicon"
            label="Favicon"
            hint="ICO, PNG, or SVG. Browser tab icon (32×32 or 64×64)."
            value={branding.faviconUrl}
            onUrlChange={(url) => updateBranding({ ...branding, faviconUrl: url })}
            onUpload={(file) => uploadAsset("favicon", file)}
            previewClassName="h-12 w-12"
            accept="image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon,.ico"
          />
        </div>
        <button
          type="button"
          onClick={saveBranding}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent-faint)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] disabled:opacity-50"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Save logo & favicon
        </button>
      </section>

      <section className="glass-card space-y-4 rounded-xl p-6">
        <div className="flex items-center gap-2">
          <Share2 size={18} className="text-blue-400" />
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Social Share Images</h2>
        </div>
        <p className="text-xs text-[var(--text-muted)]">
          Used when your site is shared on Facebook, LinkedIn, X/Twitter, and messaging apps. Recommended size: 1200×630px.
        </p>
        <div className="grid gap-4 lg:grid-cols-2">
          <AssetUploadField
            id="brand-og"
            label="Open Graph Image"
            hint="Primary share preview image (og:image)."
            value={seo.ogImage}
            onUrlChange={(url) => updateSeo({ ...seo, ogImage: url })}
            onUpload={(file) => uploadAsset("og_image", file)}
            previewClassName="h-24 w-44"
          />
          <AssetUploadField
            id="brand-twitter"
            label="Twitter / X Card Image"
            hint="Optional override. Falls back to Open Graph image if empty."
            value={seo.twitterImage}
            onUrlChange={(url) => updateSeo({ ...seo, twitterImage: url })}
            onUpload={(file) => uploadAsset("twitter_image", file)}
            previewClassName="h-24 w-44"
          />
        </div>
        {twitterPreview && (
          <div className="rounded-xl border border-[var(--border-primary)] p-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--text-faint)]">
              Share preview
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={twitterPreview} alt="Social preview" className="max-h-40 rounded-lg object-cover" />
          </div>
        )}
        <button
          type="button"
          onClick={saveSeo}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent-faint)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] disabled:opacity-50"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Save social images
        </button>
      </section>

      <section className="glass-card space-y-4 rounded-xl p-6">
        <div className="flex items-center gap-2">
          <Type size={18} className="text-emerald-400" />
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Typography</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <FontSelect
            id="font-sans"
            label="Body Font"
            value={branding.fontSans}
            onChange={(v) => updateBranding({ ...branding, fontSans: v })}
            filter="Sans"
          />
          <FontSelect
            id="font-display"
            label="Headings Font"
            value={branding.fontDisplay}
            onChange={(v) => updateBranding({ ...branding, fontDisplay: v })}
          />
          <FontSelect
            id="font-mono"
            label="Monospace Font"
            value={branding.fontMono}
            onChange={(v) => updateBranding({ ...branding, fontMono: v })}
            filter="Mono"
          />
        </div>
        <div
          className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-5"
          style={{
            fontFamily: `var(--font-sans)`,
          }}
        >
          <p
            className="text-2xl font-bold text-[var(--text-primary)]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {branding.siteName} heading preview
          </p>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Body text uses your selected sans font. Headings use the display font across the marketing site and dashboards.
          </p>
          <p
            className="mt-2 text-xs text-[var(--text-faint)]"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            Mono: CPI 24.5% · FX 1360.22 · model v2.1
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="brand-primary" className="mb-1.5 block text-sm font-medium text-[var(--text-muted)]">
              Brand Accent Color
            </label>
            <div className="flex gap-2">
              <input
                id="brand-primary"
                type="color"
                value={branding.primaryColor.startsWith("#") ? branding.primaryColor : "#ffffff"}
                onChange={(e) => updateBranding({ ...branding, primaryColor: e.target.value })}
                className="h-10 w-14 cursor-pointer rounded-lg border border-[var(--border-hover)] bg-transparent"
              />
              <input
                type="text"
                value={branding.primaryColor}
                onChange={(e) => updateBranding({ ...branding, primaryColor: e.target.value })}
                className="flex-1 rounded-xl border border-[var(--border-hover)] bg-[var(--accent-faint)] px-3 py-2 text-sm text-[var(--text-primary)]"
              />
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={saveBranding}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent-faint)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] disabled:opacity-50"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Save typography
        </button>
      </section>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => void saveAll()}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl bg-[var(--text-primary)] px-5 py-2.5 text-sm font-semibold text-[var(--bg-primary)] disabled:opacity-50"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Palette size={14} />}
          Save all brand settings
        </button>
      </div>
    </div>
  );
}