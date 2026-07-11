"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/admin", label: "Panel", exact: true },
  { href: "/admin/users", label: "Users", adminOnly: true },
  { href: "/admin/reminders", label: "Reminders", adminOnly: true },
  { href: "/admin/audit", label: "Audit logs", adminOnly: true },
];

/**
 * Sub-navigation across the admin surfaces. "Users" and "Audit logs" need an
 * ADMIN ACCOUNT (role-based, auditable) — the legacy PIN only unlocks the
 * catalog panel — so those tabs only render for admin/superadmin sessions.
 */
export function AdminNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isRoleAdmin =
    session?.user?.role === "admin" || session?.user?.role === "superadmin";

  return (
    <nav className="mb-5 flex items-center gap-1 border-b">
      {LINKS.filter((l) => !l.adminOnly || isRoleAdmin).map((l) => {
        const active = l.exact ? pathname === l.href : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-[13px] font-medium transition-colors",
              active
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
