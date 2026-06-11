import type { BrandingSettings } from "@/lib/siteSettings";
import { buildGoogleFontsHref, fontFamilyStack } from "@/lib/googleFonts";

export function brandingFontCss(branding: BrandingSettings): string {
  const sans = fontFamilyStack(branding.fontSans || "Inter", "system-ui, sans-serif");
  const display = fontFamilyStack(branding.fontDisplay || "Outfit", "system-ui, sans-serif");
  const mono = fontFamilyStack(branding.fontMono || "JetBrains Mono", "monospace");
  return `:root{--font-sans:${sans};--font-display:${display};--font-mono:${mono};}`;
}

export function brandingFontsHref(branding: BrandingSettings): string {
  return buildGoogleFontsHref([
    branding.fontSans || "Inter",
    branding.fontDisplay || "Outfit",
    branding.fontMono || "JetBrains Mono",
  ]);
}