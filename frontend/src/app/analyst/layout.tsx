"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import AuthGuard from "@/components/auth/AuthGuard";
import RoleGuard from "@/components/auth/RoleGuard";
import AnalystSidebar from "@/components/dashboard/AnalystSidebar";
import TopBar from "@/components/dashboard/TopBar";
import AppAmbient from "@/components/ui/AppAmbient";
import BackendStatusBanner from "@/components/ui/BackendStatusBanner";

export default function AnalystLayout({ children }: { children: React.ReactNode }) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <AuthGuard>
      <RoleGuard allowed={["analyst", "admin"]}>
        <div className="app-shell relative flex h-screen overflow-hidden">
          <AppAmbient />
          <div className="app-shell-content relative z-20 hidden shrink-0 lg:block print:hidden">
            <AnalystSidebar />
          </div>

          <AnimatePresence>
            {mobileSidebarOpen && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
                  onClick={() => setMobileSidebarOpen(false)}
                />
                <motion.div
                  initial={{ x: -280 }}
                  animate={{ x: 0 }}
                  exit={{ x: -280 }}
                  className="fixed inset-y-0 left-0 z-50 lg:hidden"
                  onClick={() => setMobileSidebarOpen(false)}
                >
                  <AnalystSidebar />
                </motion.div>
              </>
            )}
          </AnimatePresence>

          <div className="app-shell-content relative z-10 flex min-h-0 min-w-0 flex-1 flex-col">
            <TopBar onOpenMobileSidebar={() => setMobileSidebarOpen(true)} />
            <BackendStatusBanner />
            <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 page-enter">{children}</main>
          </div>
        </div>
      </RoleGuard>
    </AuthGuard>
  );
}