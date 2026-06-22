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
      <div className="max-w-6xl mx-auto px-6 pt-16 pb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-10"
        >
          <div className="col-span-2 md:col-span-1">
            <a
              href="#hero"
              className="text-[var(--text-primary)] font-semibold text-base flex items-center gap-2"
            >
              {branding.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={branding.logoUrl} alt={branding.siteName} className="h-5 w-5 object-contain" />
              ) : (
                <span>{navbar.brandEmoji}</span>
              )}
              {navbar.brandName || branding.siteName}
            </a>
          </div>

          {footer.columns.map((col) => (
            <div key={col.title}>
              <h4 className="text-sm font-medium text-[var(--text-primary)] mb-4">
                {col.title}
              </h4>
              <ul className="space-y-2.5">
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

        <div className="flex flex-col sm:flex-row justify-between items-center mt-14 pt-8 border-t border-[var(--border-primary)] gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[var(--fin-positive)]" />
            <span className="text-xs text-[var(--text-muted)]">All systems operational</span>
          </div>
          <p className="text-xs text-[var(--text-faint)]">{copyright}</p>
        </div>
      </div>
    </footer>
  );
}