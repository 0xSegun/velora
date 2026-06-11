"use client";

import ToastContainer from "@/components/ui/ToastContainer";
import ErrorBoundary from "@/components/ErrorBoundary";
import SmoothScroll from "@/components/providers/SmoothScroll";
import SiteSettingsProvider from "@/components/providers/SiteSettingsProvider";
import PageViewTracker from "@/components/analytics/PageViewTracker";
import SeoScripts from "@/components/seo/SeoScripts";
import BrandingThemeProvider from "@/components/providers/BrandingThemeProvider";
import type { PublicSettings } from "@/lib/siteSettings";

export default function AppProviders({
  children,
  initialSettings,
}: {
  children: React.ReactNode;
  initialSettings?: PublicSettings;
}) {
  return (
    <ErrorBoundary>
      <SiteSettingsProvider initialSettings={initialSettings}>
        <BrandingThemeProvider />
        <SmoothScroll />
        <PageViewTracker />
        <SeoScripts />
        {children}
        <ToastContainer />
      </SiteSettingsProvider>
    </ErrorBoundary>
  );
}