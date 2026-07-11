"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, LogOut, Menu, Search, Settings, ShieldCheck, UserRound } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { UserAvatar } from "@/components/layout/user-avatar";
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
  const { data: session } = useSession();
  const [q, setQ] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const isRoleAdmin =
    session?.user?.role === "admin" || session?.user?.role === "superadmin";

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
    // Full available width (the sidebar already offsets the left edge):
    // search anchors left, controls anchor to the true right edge.
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background">
      <div className="flex h-14 w-full items-center gap-2 px-4 sm:gap-3 md:px-6 lg:px-8">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={onMenuClick}
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </Button>

        <form onSubmit={submit} className="relative hidden w-full max-w-lg sm:block">
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

        {/* Right cluster, pinned to the far edge */}
        <div className="ml-auto flex items-center gap-1 sm:gap-1.5">
          <Button asChild variant="ghost" size="icon" className="sm:hidden" aria-label="Search">
            <Link href="/search">
              <Search className="h-5 w-5" />
            </Link>
          </Button>

          <NotificationsMenu />

          {isRoleAdmin && (
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="hidden gap-1.5 text-muted-foreground hover:text-foreground md:inline-flex"
            >
              <Link href="/admin" aria-label="Admin console">
                <ShieldCheck className="h-4 w-4" />
                Admin
              </Link>
            </Button>
          )}

          <ThemeToggle />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}

/**
 * Notifications — future-ready surface: the bell and panel exist, real
 * notification sources don't yet, and the empty state says so honestly.
 */
function NotificationsMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Notifications">
          <Bell className="h-[18px] w-[18px]" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>Notifications</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="px-2 py-6 text-center">
          <Bell className="mx-auto h-5 w-5 text-muted-foreground/50" />
          <p className="mt-2 text-[13px] font-medium">Nothing here yet</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Reminders and activity alerts will show up here.
          </p>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Signed-in account menu: identity, profile & settings links, sign out. */
function UserMenu() {
  const { data: session } = useSession();
  const user = session?.user;
  if (!user) return null;

  const label = user.name || user.email || "Account";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="Account menu"
          className="ml-0.5 rounded-full transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <UserAvatar name={label} image={user.image} size="sm" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <div className="flex items-center gap-2.5">
            <UserAvatar name={label} image={user.image} size="md" />
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{label}</div>
              <div className="truncate text-xs text-muted-foreground">{user.email}</div>
            </div>
          </div>
          {(user.role === "admin" || user.role === "superadmin") && (
            <div className="mt-1.5 inline-flex items-center gap-1 rounded border px-1 py-px text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <ShieldCheck className="h-3 w-3" /> {user.role}
            </div>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="cursor-pointer">
          <Link href="/profile">
            <UserRound className="mr-2 h-4 w-4" />
            My Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="cursor-pointer">
          <Link href="/settings">
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </Link>
        </DropdownMenuItem>
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
