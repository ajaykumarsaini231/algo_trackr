"use client";

import * as React from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useSession } from "next-auth/react";
import { LogoMark } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";

/** Primary public navigation — also the internal-link surface for crawlers. */
const NAV = [
  { label: "Topics", href: "/topics" },
  { label: "Patterns", href: "/algorithm-patterns" },
  { label: "Companies", href: "/companies" },
  { label: "Sheets", href: "/sheets" },
  { label: "Roadmaps", href: "/roadmaps" },
  { label: "About", href: "/about" },
];

export function PublicHeader() {
  const { status } = useSession();
  const signedIn = status === "authenticated";
  const [open, setOpen] = React.useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex shrink-0 items-center gap-2" aria-label="DSAspire home">
          <LogoMark className="h-7 w-7" />
          <span className="text-base font-bold tracking-tight">
            <span className="text-[#1d4ed8] dark:text-[#5b8bf7]">DSA</span>
            <span className="text-[#14b8a6]">spire</span>
          </span>
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <ThemeToggle />
          {signedIn ? (
            <Link
              href="/dashboard"
              className="inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/signin"
                className="hidden h-9 items-center rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className="inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Get started
              </Link>
            </>
          )}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent md:hidden"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile nav */}
      {open && (
        <nav aria-label="Mobile" className="border-t border-border/60 md:hidden">
          <div className="mx-auto max-w-6xl px-4 py-2">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="block rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}
