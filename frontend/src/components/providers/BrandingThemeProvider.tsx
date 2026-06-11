"use client";

import { useEffect } from "react";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { buildGoogleFontsHref, fontFamilyStack } from "@/lib/googleFonts";

const FAVICON_ID = "velora-dynamic-favicon";
const FONTS_ID = "velora-dynamic-fonts";

export default function BrandingThemeProvider() {
  const { branding } = useSiteSettings();
  const { fontSans, fontDisplay, fontMono, faviconUrl, primaryColor } = branding;

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty(
      "--font-sans",
      fontFamilyStack(fontSans || "Inter", "system-ui, sans-serif"),
    );
    root.style.setProperty(
      "--font-display",
      fontFamilyStack(fontDisplay || "Outfit", "system-ui, sans-serif"),
    );
    root.style.setProperty(
      "--font-mono",
      fontFamilyStack(fontMono || "JetBrains Mono", "monospace"),
    );
    if (primaryColor) {
      root.style.setProperty("--brand-primary", primaryColor);
    }

    const href = buildGoogleFontsHref([
      fontSans || "Inter",
      fontDisplay || "Outfit",
      fontMono || "JetBrains Mono",
    ]);
    let link = document.getElementById(FONTS_ID) as HTMLLinkElement | null;
    if (href) {
      if (!link) {
        link = document.createElement("link");
        link.id = FONTS_ID;
        link.rel = "stylesheet";
        document.head.appendChild(link);
      }
      link.href = href;
    } else if (link) {
      link.remove();
    }

    let icon = document.getElementById(FAVICON_ID) as HTMLLinkElement | null;
    if (faviconUrl) {
      if (!icon) {
        icon = document.createElement("link");
        icon.id = FAVICON_ID;
        icon.rel = "icon";
        document.head.appendChild(icon);
      }
      icon.href = faviconUrl;
    } else if (icon) {
      icon.remove();
    }
  }, [fontSans, fontDisplay, fontMono, faviconUrl, primaryColor]);

  return null;
}