"use client";

import * as React from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { MessageCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { fetcher } from "@/lib/api-client";
import { cn, formatRelative } from "@/lib/utils";

interface ReminderSettingsPayload {
  settings: {
    reminderEnabled: boolean;
    countryCode: string;
    phoneNumber: string;
    timezone: string;
    goalMinutes: number;
    reminderStart: string;
    reminderEnd: string;
    reminderInterval: number;
  };
  status: {
    whatsappConfigured: boolean;
    lastReminderSentAt: string | null;
    lastSendStatus: "none" | "ok" | "failed";
    lastSendError: string;
    today: {
      activeMinutes: number;
      goalCompleted: boolean;
      lastHeartbeat: string | null;
    };
  };
}

const INTERVALS = [15, 30, 45, 60];

function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  } catch {
    return "";
  }
}

/**
 * WhatsApp reminder preferences card on the Settings page. The phone number,
 * country code and timezone are mandatory to ENABLE reminders; everything
 * else has sensible defaults (60 min goal, 20:00–23:45 window, every 15 min).
 */
export function WhatsAppReminderSettings({ onSaved }: { onSaved?: () => void } = {}) {
  const { data, isLoading, mutate } = useSWR<ReminderSettingsPayload>(
    "/api/reminders/settings",
    fetcher,
  );

  const [form, setForm] = React.useState<ReminderSettingsPayload["settings"] | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [timezones, setTimezones] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (data && !form) {
      setForm({
        ...data.settings,
        timezone: data.settings.timezone || detectTimezone(),
      });
    }
  }, [data, form]);

  React.useEffect(() => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setTimezones((Intl as any).supportedValuesOf?.("timeZone") ?? []);
    } catch {
      setTimezones([]);
    }
  }, []);

  if (isLoading || !data || !form) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">WhatsApp reminders</CardTitle>
          <CardDescription>Loading…</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const { status } = data;
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f!, ...patch }));
  const phoneComplete = /^\+\d{1,4}$/.test(form.countryCode) && /^\d{6,14}$/.test(form.phoneNumber);
  // Reminders can only be ENABLED once phone, country code, timezone AND a
  // positive daily goal are all present (mirrors the server-side rule).
  const profileComplete =
    phoneComplete && form.timezone.trim() !== "" && form.goalMinutes >= 5;
  const goalPct = Math.min(100, Math.round((status.today.activeMinutes / Math.max(1, form.goalMinutes)) * 100));

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/reminders/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error || "Failed to save");
      toast.success("Reminder settings saved");
      await mutate();
      onSaved?.();
    } catch (err) {
      toast.error("Couldn't save reminder settings", { description: (err as Error).message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageCircle className="h-4 w-4 text-muted-foreground" />
          WhatsApp reminders
        </CardTitle>
        <CardDescription>
          Get a WhatsApp nudge in the evening when today&apos;s study goal isn&apos;t done —
          never while you&apos;re actively using the app.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Today snapshot */}
        <div className="rounded-md border bg-muted/30 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
            <span>
              Today&apos;s active time:{" "}
              <span className="font-semibold tabular-nums">{status.today.activeMinutes} min</span>
              <span className="text-muted-foreground"> / {form.goalMinutes} min goal</span>
            </span>
            <span
              className={cn(
                "rounded px-1.5 py-0.5 text-[11px] font-medium",
                status.today.goalCompleted
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                  : "bg-amber-500/15 text-amber-600 dark:text-amber-400",
              )}
            >
              {status.today.goalCompleted ? "Goal completed" : "In progress"}
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${goalPct}%` }} />
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
            <span>
              Reminders:{" "}
              <span className="font-medium text-foreground">
                {form.reminderEnabled ? "enabled" : "disabled"}
              </span>
            </span>
            <span>
              Last reminder:{" "}
              <span className="font-medium text-foreground">
                {status.lastReminderSentAt ? formatRelative(status.lastReminderSentAt) : "never"}
              </span>
            </span>
            {status.lastSendStatus === "failed" && (
              <span className="text-rose-500" title={status.lastSendError}>
                last send failed
              </span>
            )}
          </div>
        </div>

        {!status.whatsappConfigured && (
          <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
            WhatsApp credentials aren&apos;t configured on the server yet — settings are saved,
            but no messages will be sent until the WHATSAPP_* environment variables are set.
          </p>
        )}

        {/* Enable */}
        <div className="flex items-center justify-between py-1">
          <div>
            <div className="text-sm font-medium">Enable WhatsApp reminders</div>
            <div className="text-xs text-muted-foreground">
              Requires a WhatsApp number and timezone.
            </div>
          </div>
          <Switch
            checked={form.reminderEnabled}
            disabled={!form.reminderEnabled && !profileComplete}
            onCheckedChange={(v) => set({ reminderEnabled: v })}
          />
        </div>
        {!profileComplete && !form.reminderEnabled && (
          <p className="text-[11px] text-muted-foreground">
            To unlock the switch, fill in:{" "}
            {[
              !phoneComplete && "country code + WhatsApp number",
              form.timezone.trim() === "" && "timezone",
              form.goalMinutes < 5 && "daily goal (≥5 min)",
            ]
              .filter(Boolean)
              .join(", ")}
            .
          </p>
        )}

        <Separator />

        {/* Contact */}
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="wa-cc" className="text-xs">Country code *</Label>
            <Input
              id="wa-cc"
              value={form.countryCode}
              onChange={(e) => set({ countryCode: e.target.value.trim() })}
              placeholder="+91"
              maxLength={5}
              className="h-8 text-[13px]"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="wa-phone" className="text-xs">WhatsApp number *</Label>
            <Input
              id="wa-phone"
              value={form.phoneNumber}
              onChange={(e) => set({ phoneNumber: e.target.value.replace(/\D/g, "") })}
              placeholder="9876543210"
              maxLength={14}
              inputMode="numeric"
              className="h-8 text-[13px]"
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="wa-tz" className="text-xs">Timezone *</Label>
            <Input
              id="wa-tz"
              value={form.timezone}
              onChange={(e) => set({ timezone: e.target.value })}
              placeholder="Asia/Kolkata"
              list="wa-tz-list"
              className="h-8 text-[13px]"
            />
            <datalist id="wa-tz-list">
              {timezones.map((tz) => (
                <option key={tz} value={tz} />
              ))}
            </datalist>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wa-goal" className="text-xs">Daily goal (minutes)</Label>
            <Input
              id="wa-goal"
              type="number"
              min={5}
              max={960}
              value={form.goalMinutes}
              onChange={(e) => set({ goalMinutes: Number(e.target.value) })}
              className="h-8 text-[13px]"
            />
          </div>
        </div>

        {/* Window */}
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="wa-start" className="text-xs">Reminder start</Label>
            <Input
              id="wa-start"
              type="time"
              value={form.reminderStart}
              onChange={(e) => set({ reminderStart: e.target.value })}
              className="h-8 text-[13px]"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wa-end" className="text-xs">Reminder end</Label>
            <Input
              id="wa-end"
              type="time"
              value={form.reminderEnd}
              onChange={(e) => set({ reminderEnd: e.target.value })}
              className="h-8 text-[13px]"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wa-interval" className="text-xs">Repeat every</Label>
            <select
              id="wa-interval"
              value={form.reminderInterval}
              onChange={(e) => set({ reminderInterval: Number(e.target.value) })}
              className="h-8 w-full rounded-md border border-input bg-background px-2 text-[13px]"
            >
              {INTERVALS.map((m) => (
                <option key={m} value={m}>{m} minutes</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 pt-1">
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Reminders pause instantly while you&apos;re studying and stop for the day once
            your goal is complete.
          </p>
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save reminders"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
