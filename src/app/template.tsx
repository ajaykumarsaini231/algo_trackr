"use client";

import { motion } from "framer-motion";

/**
 * Subtle global page transition. Wraps the page content (inside the shell's
 * <main>), so it fades content on navigation without touching the sticky
 * header or sidebar. Reduced-motion users get an instant, transform-free swap
 * via the app-wide MotionConfig reducedMotion="user".
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
