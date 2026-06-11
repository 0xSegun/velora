"use client";

import Script from "next/script";
import { useSeoSettings } from "@/hooks/useSiteSettings";

export default function SeoScripts() {
  const seo = useSeoSettings();

  return (
    <>
      {seo.googleTagManagerId ? (
        <>
          <Script id="gtm" strategy="afterInteractive">{`
            (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
            new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
            j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
            'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
            })(window,document,'script','dataLayer','${seo.googleTagManagerId}');
          `}</Script>
        </>
      ) : null}
      {seo.googleAnalyticsId ? (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${seo.googleAnalyticsId}`}
            strategy="afterInteractive"
          />
          <Script id="ga4" strategy="afterInteractive">{`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${seo.googleAnalyticsId}');
          `}</Script>
        </>
      ) : null}
      {seo.plausibleDomain ? (
        <Script
          defer
          data-domain={seo.plausibleDomain}
          src="https://plausible.io/js/script.js"
          strategy="afterInteractive"
        />
      ) : null}
    </>
  );
}