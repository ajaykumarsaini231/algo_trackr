"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, Menu, Search, ShieldCheck } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Icon } from "@/components/shared/icon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Header({ onMenuClick }: { onMenuClick: () => void }) {
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    router.push(q.trim() ? `/search?q=${encodeURIComponent(q.trim())}` : "/search");
  }

  // "/" focuses the global search unless the user is already typing somewhere.
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = document.activeElement;
      if (
        el instanceof HTMLElement &&
        (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      inputRef.current?.focus();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    // The inner container mirrors <main>'s (max-w-7xl + paddings) so the
    // search field and controls line up exactly with the page content below.
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-3 px-4 md:px-6 lg:px-8">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onMenuClick}
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" />
      </Button>

      <form onSubmit={submit} className="relative hidden max-w-lg flex-1 sm:block">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search questions, topics, companies…"
          className="h-8 w-full rounded-md border border-input bg-muted/50 pl-8 pr-10 text-[13px] outline-none transition-colors focus:border-primary/50 focus:bg-background focus:ring-2 focus:ring-ring/30"
        />
        <kbd className="pointer-events-none absolute right-2 top-1/2 hidden h-5 -translate-y-1/2 select-none items-center rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground sm:flex">
          /
        </kbd>
      </form>

      <div className="flex flex-1 items-center justify-end gap-1 sm:flex-none">
        <Button asChild variant="ghost" size="icon" className="sm:hidden" aria-label="Search">
          <Link href="/search">
            <Search className="h-5 w-5" />
          </Link>
        </Button>
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="hidden gap-2 text-muted-foreground hover:text-foreground md:inline-flex"
        >
          <Link href="/admin">
            <Icon name="ShieldCheck" className="h-4 w-4" />
            Admin
          </Link>
        </Button>
        <ThemeToggle />
        <UserMenu />
      </div>
      </div>
    </header>
  );
}

/** Signed-in account menu: identity + sign out. */
function UserMenu() {
  const { data: session } = useSession();
  const user = session?.user;
  if (!user) return null;

  const label = user.name || user.email || "Account";
  const initial = (label[0] || "?").toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="Account menu"
          className="ml-1 flex h-7 w-7 items-center justify-center rounded-full bg-foreground text-[12px] font-semibold text-background transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {initial}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="truncate text-sm font-medium">{label}</div>
          <div className="truncate text-xs text-muted-foreground">{user.email}</div>
          {user.role === "admin" && (
            <div className="mt-1 inline-flex items-center gap-1 rounded border px-1 py-px text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <ShieldCheck className="h-3 w-3" /> Admin
            </div>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer"
          onSelect={() => void signOut({ callbackUrl: "/signin" })}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
