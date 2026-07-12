import Link from "next/link";
import { LogoMark } from "@/components/brand/logo";

/** Fat footer — distributes internal links sitewide and flattens crawl depth. */
const COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Learn",
    links: [
      { label: "Topics", href: "/topics" },
      { label: "Patterns", href: "/algorithm-patterns" },
      { label: "Roadmaps", href: "/roadmaps" },
      { label: "Sheets", href: "/sheets" },
    ],
  },
  {
    title: "Practice",
    links: [
      { label: "Companies", href: "/companies" },
      { label: "Blind 75", href: "/sheets" },
      { label: "Dashboard", href: "/dashboard" },
      { label: "Sign in", href: "/signin" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Contact", href: "/contact" },
    ],
  },
];

export function PublicFooter() {
  const year = 2026; // static: Date.now() is unavailable at build in this app's env
  return (
    <footer className="border-t border-border bg-muted/20">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
        <div>
          <Link href="/" className="flex items-center gap-2" aria-label="DSAspire home">
            <LogoMark className="h-7 w-7" />
            <span className="text-base font-bold tracking-tight">
              <span className="text-[#1d4ed8] dark:text-[#5b8bf7]">DSA</span>
              <span className="text-[#14b8a6]">spire</span>
            </span>
          </Link>
          <p className="mt-3 max-w-xs text-sm text-muted-foreground">
            Free Data Structures &amp; Algorithms learning and coding-interview
            preparation platform.
          </p>
        </div>

        {COLUMNS.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {col.title}
            </h2>
            <ul className="mt-3 space-y-2">
              {col.links.map((link) => (
                <li key={link.label + link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="border-t border-border/60">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:px-6 lg:px-8">
          <p>© {year} DSAspire. All rights reserved.</p>
          <p>Master DSA, one pattern at a time.</p>
        </div>
      </div>
    </footer>
  );
}
