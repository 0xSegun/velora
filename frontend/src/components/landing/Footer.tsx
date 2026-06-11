"use client";

import { motion } from "framer-motion";
import { useBranding, useCms } from "@/hooks/useSiteSettings";

export default function Footer() {
  const { footer, navbar } = useCms();
  const branding = useBranding();
  const year = new Date().getFullYear();
  const copyright = footer.copyright.replace("{year}", String(year));

  return (
    <footer className="relative border-t border-[var(--border-primary)] print:hidden">
      <div className="absolute inset-x-0 top-0 glass-divider" />

      <div className="glass-nav pt-16 pb-8">
        <div className="max-w-6xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="grid grid-cols-2 md:grid-cols-5 gap-8"
          >
            <div className="col-span-2 md:col-span-1">
              <a
                href="#hero"
                className="text-[var(--text-primary)] font-bold text-lg flex items-center gap-2"
                style={{ fontFamily: "var(--font-display), sans-serif" }}
              >
                {branding.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={branding.logoUrl} alt={branding.siteName} className="h-6 w-6 object-contain" />
                ) : (
                  <span>{navbar.brandEmoji}</span>
                )}
                {navbar.brandName || branding.siteName}
              </a>
              <p className="text-sm text-[var(--text-muted)] mt-3 leading-relaxed">
                {footer.tagline || branding.siteDesc}
              </p>
            </div>

            {footer.columns.map((col) => (
              <div key={col.title}>
                <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-4">
                  {col.title}
                </h4>
                <ul className="space-y-2">
                  {col.links.map((link) => (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        className="text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors duration-200"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </motion.div>

          <div className="flex flex-col sm:flex-row justify-between items-center mt-12 pt-8 border-t border-[var(--border-primary)] gap-2">
            <p className="text-sm text-[var(--text-faint)]">{copyright}</p>
            <p className="text-sm text-[var(--text-faint)]">
              {branding.siteDesc}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}