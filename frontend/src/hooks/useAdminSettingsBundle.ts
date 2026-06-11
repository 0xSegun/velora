"use client";

import { useCallback, useEffect, useState } from "react";
import { adminAPI } from "@/lib/api";
import {
  DEFAULT_PUBLIC_SETTINGS,
  type PublicSettings,
  deepMergeSettings,
} from "@/lib/siteSettings";
import { toast } from "@/lib/feedback";

export interface AdminSettingsBundle extends PublicSettings {
  credentials?: {
    fredKey?: string;
    resendKey?: string;
    resendFrom?: string;
  };
}

export function useAdminSettingsBundle() {
  const [bundle, setBundle] = useState<AdminSettingsBundle>(DEFAULT_PUBLIC_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await adminAPI.getSettingsBundle();
      setBundle(
        deepMergeSettings(
          DEFAULT_PUBLIC_SETTINGS as unknown as Record<string, unknown>,
          data as Record<string, unknown>,
        ) as unknown as AdminSettingsBundle,
      );
    } catch {
      toast.error("Failed to load settings from server.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const saveSection = useCallback(
    async (section: keyof PublicSettings | "credentials", payload: Record<string, unknown>) => {
      setSaving(true);
      try {
        if (section === "credentials") {
          const creds: Record<string, string> = {};
          if (payload.fredKey) creds.FRED_API_KEY = String(payload.fredKey);
          if (payload.resendKey) creds.RESEND_API_KEY = String(payload.resendKey);
          if (payload.resendFrom) creds.RESEND_FROM_EMAIL = String(payload.resendFrom);
          if (Object.keys(creds).length) await adminAPI.updateCredentials(creds);
        } else {
          await adminAPI.updateSettingsBundle({ [section]: payload });
        }
        toast.success("Settings saved successfully.");
        await load();
      } catch {
        toast.error("Failed to save settings.");
      } finally {
        setSaving(false);
      }
    },
    [load],
  );

  const updateCms = useCallback((cms: PublicSettings["cms"]) => {
    setBundle((prev) => ({ ...prev, cms }));
  }, []);

  const updateSeo = useCallback((seo: PublicSettings["seo"]) => {
    setBundle((prev) => ({ ...prev, seo }));
  }, []);

  const updateBranding = useCallback((branding: PublicSettings["branding"]) => {
    setBundle((prev) => ({ ...prev, branding }));
  }, []);

  const updateGeneral = useCallback((general: PublicSettings["general"]) => {
    setBundle((prev) => ({ ...prev, general }));
  }, []);

  const updateDashboard = useCallback((dashboard: PublicSettings["dashboard"]) => {
    setBundle((prev) => ({ ...prev, dashboard }));
  }, []);

  const updateLegal = useCallback((legal: PublicSettings["legal"]) => {
    setBundle((prev) => ({ ...prev, legal }));
  }, []);

  return {
    bundle,
    loading,
    saving,
    load,
    saveSection,
    updateCms,
    updateSeo,
    updateBranding,
    updateGeneral,
    updateDashboard,
    updateLegal,
  };
}