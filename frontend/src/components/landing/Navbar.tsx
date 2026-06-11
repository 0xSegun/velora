"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";
import { useBranding, useCms } from "@/hooks/useSiteSettings";

export default function Navbar() {
  const { navbar } = useCms();
  const branding = useBranding();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  return (
    <>
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" as const }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 print:hidden ${
          scrolled ? "glass-nav shadow-lg" : "glass-nav"
        }`}
      >
        <nav className="max-w-6xl mx-auto flex items-center justify-between px-4 h-16">
          <a
            href="#hero"
            id="navbar-logo"
            className="flex items-center gap-2 text-[var(--text-primary)] font-bold text-xl"
            style={{ fontFamily: "var(--font-display), sans-serif" }}
          >
            {branding.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={branding.logoUrl} alt={branding.siteName} className="h-8 w-8 object-contain" />
            ) : (
              <span>{navbar.brandEmoji}</span>
            )}
            {navbar.brandName || branding.siteName}
          </a>

          <ul className="hidden lg:flex items-center gap-7">
            {navbar.links.map((link) => (
              <li key={link.label}>
                <a
                  id={`nav-link-${link.label.toLowerCase().replace(/\s+/g, "-")}`}
                  href={link.href}
                  className="text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors duration-200 relative group"
                >
                  {link.label}
                  <span className="absolute -bottom-1 left-0 w-0 h-px bg-[var(--text-primary)] transition-all duration-300 group-hover:w-full" />
                </a>
              </li>
            ))}
          </ul>

          <a
            id="navbar-cta"
            href="/register"
            className="hidden md:inline-flex items-center btn-shine bg-[var(--text-primary)] text-[var(--bg-primary)] text-sm font-medium rounded-full px-6 py-2 hover:shadow-[var(--glow-active)] transition-shadow duration-300"
          >
            {navbar.ctaLabel}
          </a>

          <button
            id="navbar-mobile-toggle"
            onClick={() => setMobileOpen((prev) => !prev)}
            className="lg:hidden text-[var(--text-primary)] p-2 rounded-lg glass"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </nav>
      </motion.header>

      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
            />

            <motion.div
              key="mobile-panel"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 26, stiffness: 200 }}
              className="fixed top-0 right-0 bottom-0 z-50 w-72 glass-panel border-l border-[var(--glass-border)] flex flex-col p-6 pt-20 lg:hidden"
            >
              <ul className="flex flex-col gap-2">
                {navbar.links.map((link) => (
                  <li key={link.label}>
                    <a
                      id={`mobile-link-${link.label.toLowerCase().replace(/\s+/g, "-")}`}
                      href={link.href}
                      onClick={() => setMobileOpen(false)}
                      className="block text-base text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors py-3 px-3 rounded-lg hover:bg-[var(--glass-bg-hover)]"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>

              <a
                id="mobile-cta"
                href="/register"
                onClick={() => setMobileOpen(false)}
                className="mt-8 inline-flex items-center justify-center btn-shine bg-[var(--text-primary)] text-[var(--bg-primary)] text-sm font-medium rounded-full px-6 py-3"
              >
                {navbar.ctaLabel}
              </a>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}