/**
 * Subtle global page transition. Wraps the page content (inside the shell's
 * <main>), so it fades content on navigation without touching the sticky
 * header or sidebar. Implemented as a pure CSS animation (see `.page-enter` in
 * globals.css) so framer-motion is not on the hot render path; reduced-motion
 * users get an instant, transform-free swap via the `prefers-reduced-motion`
 * media query. This is a Server Component (no client JS).
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
