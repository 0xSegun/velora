"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_PUBLIC_SETTINGS,
  type PublicSettings,
  deepMergeSettings,
} from "@/lib/siteSettings";
import { SiteSettingsContext } from "@/hooks/useSiteSettings";
import { publicAPI } from "@/lib/api";

export default function SiteSettingsProvider({
  initialSettings,
  children,
}: {
  initialSettings?: PublicSettings;
  children: React.ReactNode;
}) {
  const [settings, setSettings] = useState<PublicSettings>(
    initialSettings ?? DEFAULT_PUBLIC_SETTINGS,
  );

  useEffect(() => {
    publicAPI
      .getSettings()
      .then(({ data }) => {
        setSettings(
          deepMergeSettings(
            DEFAULT_PUBLIC_SETTINGS as unknown as Record<string, unknown>,
            data as Record<string, unknown>,
          ) as unknown as PublicSettings,
        );
      })
      .catch(() => {
        /* keep defaults / SSR initial */
      });
  }, []);

  return (
    <SiteSettingsContext.Provider value={settings}>
      {children}
    </SiteSettingsContext.Provider>
  );
}