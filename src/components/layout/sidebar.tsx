"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/lib/nav";
import { APP_TAGLINE } from "@/lib/constants";
import { LogoMark } from "@/components/brand/logo";
import { Icon } from "@/components/shared/icon";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <Link
        href="/"
        onClick={onNavigate}
        className="flex h-14 shrink-0 items-center gap-2 border-b border-border/60 px-4"
      >
        <LogoMark className="h-7 w-7 shrink-0" />
        <div className="leading-none">
          <div className="text-sm font-bold tracking-tight">
            <span className="text-[#1d4ed8] dark:text-[#5b8bf7]">DSA</span>
            <span className="text-[#14b8a6]">spire</span>
          </div>
          <div className="mt-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            DSA Tracker
          </div>
        </div>
      </Link>

      <ScrollArea className="flex-1 px-2 py-3">
        <nav className="flex flex-col gap-0.5">
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  "group flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] transition-colors",
                  active
                    ? "bg-accent font-medium text-foreground"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                )}
              >
                <Icon
                  name={item.icon}
                  className={cn(
                    "h-4 w-4 shrink-0 transition-colors",
                    active
                      ? "text-foreground"
                      : "text-muted-foreground group-hover:text-foreground",
                  )}
                />
                <span>{item.label}</span>
                {item.admin && (
                  <span className="ml-auto rounded border px-1 py-px text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Key
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </ScrollArea>

      <div className="border-t border-border/60 px-4 py-3">
        <p className="text-xs font-medium">{APP_TAGLINE}</p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
          Your data is never deleted — only archived.
        </p>
      </div>
    </div>
  );
}
