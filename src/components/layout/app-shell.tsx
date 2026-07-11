"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { ImpersonationBanner } from "@/components/admin/impersonation-banner";
import { ActivityTracker } from "@/components/activity/activity-tracker";

/** Routes that render standalone (no sidebar/header chrome). */
const BARE_ROUTES = new Set(["/signin", "/signup"]);

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();
  const bare = BARE_ROUTES.has(pathname);

  // Lock body scroll while the mobile drawer is open.
  React.useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (bare) {
    return <main className="min-h-screen">{children}</main>;
  }

  return (
    <div className="min-h-screen">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 border-r border-border/60 bg-background lg:block">
        <Sidebar />
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 38 }}
              className="fixed inset-y-0 left-0 z-50 w-72 border-r border-border/60 bg-background shadow-2xl lg:hidden"
            >
              <Sidebar onNavigate={() => setOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="lg:pl-60">
        <ActivityTracker />
        <ImpersonationBanner />
        <Header onMenuClick={() => setOpen(true)} />
        <main className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
