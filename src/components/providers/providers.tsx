"use client";

import * as React from "react";
import { SWRConfig } from "swr";
import { MotionConfig } from "framer-motion";
import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

/**
 * Global SWR defaults that make navigation feel instant:
 *  - keepPreviousData: keep the last data on screen while the next key loads
 *    (no blank/skeleton flash when filters, pages or params change)
 *  - revalidateOnFocus off + dedupe/throttle: fewer redundant refetches
 * Individual hooks can still override any of these.
 */
const swrConfig = {
  revalidateOnFocus: false,
  keepPreviousData: true,
  dedupingInterval: 5000,
  focusThrottleInterval: 10000,
  errorRetryCount: 2,
};

/** Single mount point for all client-side context providers. */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider
        attribute="class"
        defaultTheme="dark"
        enableSystem
        disableTransitionOnChange
      >
        <SWRConfig value={swrConfig}>
          {/* Respect the OS "reduce motion" setting for all framer animations. */}
          <MotionConfig reducedMotion="user">
            <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
            <Toaster />
          </MotionConfig>
        </SWRConfig>
      </ThemeProvider>
    </SessionProvider>
  );
}
