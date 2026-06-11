import type { Metadata } from "next";
import AppProviders from "@/components/providers/AppProviders";
import { brandingFontCss, brandingFontsHref } from "@/lib/brandingStyles";
import { getPublicSettings } from "@/lib/getPublicSettings";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getPublicSettings();
  const { seo, branding } = settings;
  const keywords = seo.keywords
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);

  const shareImage = seo.twitterImage || seo.ogImage;

  return {
    title: seo.metaTitle,
    description: seo.metaDescription,
    keywords,
    authors: [{ name: branding.siteName }],
    robots: seo.robots,
    ...(branding.faviconUrl ? { icons: { icon: branding.faviconUrl } } : {}),
    ...(seo.canonicalUrl ? { alternates: { canonical: seo.canonicalUrl } } : {}),
    openGraph: {
      title: seo.ogTitle || seo.metaTitle,
      description: seo.ogDescription || seo.metaDescription,
      type: "website",
      locale: "en_US",
      siteName: branding.siteName,
      ...(seo.ogImage ? { images: [{ url: seo.ogImage }] } : {}),
    },
    twitter: {
      card: (seo.twitterCard as "summary" | "summary_large_image") || "summary_large_image",
      title: seo.ogTitle || seo.metaTitle,
      description: seo.ogDescription || seo.metaDescription,
      ...(seo.twitterSite ? { site: seo.twitterSite } : {}),
      ...(shareImage ? { images: [shareImage] } : {}),
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const initialSettings = await getPublicSettings();
  const fontsHref = brandingFontsHref(initialSettings.branding);

  return (
    <html
      lang={initialSettings.general.defaultLang || "en"}
      className="dark"
      suppressHydrationWarning
    >
      <head>
        {fontsHref ? <link rel="stylesheet" href={fontsHref} /> : null}
        <style dangerouslySetInnerHTML={{ __html: brandingFontCss(initialSettings.branding) }} />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var stored = localStorage.getItem('velora-theme');
                  if (!stored) {
                    var legacy = localStorage.getItem('infinicast-theme');
                    if (legacy) {
                      localStorage.setItem('velora-theme', legacy);
                      localStorage.removeItem('infinicast-theme');
                      stored = legacy;
                    }
                  }
                  if (stored) {
                    var parsed = JSON.parse(stored);
                    var theme = parsed && parsed.state && parsed.state.theme;
                    if (theme === 'light') {
                      document.documentElement.classList.remove('dark');
                      document.documentElement.classList.add('light');
                    }
                  }
                } catch(e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="bg-[var(--bg-primary)] text-[var(--text-secondary)] antialiased noise-overlay">
        <AppProviders initialSettings={initialSettings}>{children}</AppProviders>
      </body>
    </html>
  );
}