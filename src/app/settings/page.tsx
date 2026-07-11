"use client";

import * as React from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import {
  Database,
  Download,
  Monitor,
  Moon,
  Settings as SettingsIcon,
  ShieldCheck,
  Sun,
  Upload,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { WhatsAppReminderSettings } from "@/components/settings/whatsapp-reminder-settings";
import { useSettings } from "@/hooks/use-settings";
import { APP_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";

const THEME_OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  const { settings, mutate } = useSettings();
  React.useEffect(() => setMounted(true), []);

  async function updateSetting(patch: Record<string, unknown>) {
    // Optimistic update
    mutate((prev) => (prev ? { ...prev, ...patch } : prev), false);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to save");
      }
      toast.success("Setting saved");
      mutate();
    } catch (err) {
      mutate();
      toast.error("Couldn't save setting", {
        description:
          (err as Error).message === "Admin access required"
            ? "Unlock the Admin Panel to change server settings."
            : (err as Error).message,
      });
    }
  }

  async function downloadExport(format: "json" | "csv") {
    try {
      const res = await fetch(`/api/export?format=${format}&all=true`);
      if (!res.ok) throw new Error("Export requires admin access.");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dsa-questions.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported as ${format.toUpperCase()}`);
    } catch (err) {
      toast.error("Export failed", { description: (err as Error).message });
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Settings"
        description="Personalize your workspace and manage your data."
        icon={<SettingsIcon className="h-5 w-5" />}
      />

      <div className="space-y-4">
        {/* Appearance */}
        <Card glass>
          <CardHeader>
            <CardTitle className="text-base">Appearance</CardTitle>
            <CardDescription>Choose how {APP_NAME} looks on this device.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              {THEME_OPTIONS.map((opt) => {
                const active = mounted && theme === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setTheme(opt.value)}
                    className={cn(
                      "flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all",
                      active
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/40",
                    )}
                  >
                    <opt.icon className={cn("h-5 w-5", active ? "text-primary" : "text-muted-foreground")} />
                    <span className="text-sm font-medium">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Preferences */}
        <Card glass>
          <CardHeader>
            <CardTitle className="text-base">Preferences</CardTitle>
            <CardDescription>Saved to the server (requires admin to change).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="flex items-center justify-between py-2">
              <div>
                <div className="text-sm font-medium">Celebrate completions</div>
                <div className="text-xs text-muted-foreground">Show a flourish when you solve a problem.</div>
              </div>
              <Switch
                checked={settings?.showConfetti ?? true}
                onCheckedChange={(v) => updateSetting({ showConfetti: v })}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between py-2">
              <div>
                <div className="text-sm font-medium">Compact mode</div>
                <div className="text-xs text-muted-foreground">Denser spacing for large libraries.</div>
              </div>
              <Switch
                checked={settings?.compactMode ?? false}
                onCheckedChange={(v) => updateSetting({ compactMode: v })}
              />
            </div>
          </CardContent>
        </Card>

        {/* WhatsApp reminders */}
        <WhatsAppReminderSettings />

        {/* Data management */}
        <Card glass>
          <CardHeader>
            <CardTitle className="text-base">Data &amp; backup</CardTitle>
            <CardDescription>Your questions are never deleted — only archived.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="gap-2" onClick={() => downloadExport("json")}>
              <Download className="h-4 w-4" /> Export JSON
            </Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => downloadExport("csv")}>
              <Download className="h-4 w-4" /> Export CSV
            </Button>
            <Button asChild variant="outline" size="sm" className="gap-2">
              <Link href="/admin">
                <Upload className="h-4 w-4" /> Import (Admin)
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* About */}
        <Card glass>
          <CardHeader>
            <CardTitle className="text-base">About</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Application</span>
              <span className="font-medium">{APP_NAME} v1.0.0</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Stack</span>
              <span className="font-medium">Next.js 15 · React 19 · MongoDB</span>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="h-4 w-4 shrink-0" />
              <span className="text-xs">
                Append-only storage: adding questions never overwrites old data, and updates
                only touch the selected record.
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Database className="h-4 w-4" />
              Collections: questions · topics · companies · patterns · statistics · settings · admin · failed_attempts
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
