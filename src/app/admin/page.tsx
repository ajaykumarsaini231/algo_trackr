"use client";

import { Loader2 } from "lucide-react";
import { useAdmin } from "@/hooks/use-admin";
import { AdminAuth } from "@/components/admin/admin-auth";
import { AdminPanel } from "@/components/admin/admin-panel";
import { AdminNav } from "@/components/admin/admin-nav";

export default function AdminPage() {
  const { authenticated, isLoading } = useAdmin();

  if (isLoading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      <AdminNav />
      {authenticated ? <AdminPanel /> : <AdminAuth />}
    </div>
  );
}
