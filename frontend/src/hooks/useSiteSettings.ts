"use client";

import { createContext, useContext } from "react";
import { DEFAULT_PUBLIC_SETTINGS, type PublicSettings } from "@/lib/siteSettings";

export const SiteSettingsContext = createContext<PublicSettings>(DEFAULT_PUBLIC_SETTINGS);

export function useSiteSettings(): PublicSettings {
  return useContext(SiteSettingsContext);
}

export function useCms() {
  return useSiteSettings().cms;
}

export function useBranding() {
  return useSiteSettings().branding;
}

export function useDashboardCopy() {
  return useSiteSettings().dashboard;
}

export function useSeoSettings() {
  return useSiteSettings().seo;
}

export function useLegalContent() {
  return useSiteSettings().legal;
}