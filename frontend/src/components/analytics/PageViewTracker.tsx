"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { publicAPI } from "@/lib/api";

export default function PageViewTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;
    publicAPI
      .trackPageView({
        path: pathname,
        referrer: typeof document !== "undefined" ? document.referrer : "",
        title: typeof document !== "undefined" ? document.title : "",
      })
      .catch(() => {
        /* non-blocking */
      });
  }, [pathname]);

  return null;
}