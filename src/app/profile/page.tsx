"use client";

import * as React from "react";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { BadgeCheck, CalendarDays, Clock3, KeyRound, Target } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WhatsAppReminderSettings } from "@/components/settings/whatsapp-reminder-settings";
import { UserAvatar } from "@/components/layout/user-avatar";
import { fetcher } from "@/lib/api-client";
import { cn, formatRelative } from "@/lib/utils";

interface ProfilePayload {
  account: {
    id: string;
    email: string;
    name: string;
    image: string;
    role: "user" | "admin" | "superadmin";
    status: string;
    createdAt: string | null;
    lastLoginAt: string | null;
    lastActiveAt: string | null;
    loginCount: number;
    solvedCount: number;
  };
  preferences: {
    countryCode: string;
    phoneNumber: string;
    timezone: string;
    dailyStudyGoal: number;
    reminderEnabled: boolean;
  };
  today: { activeMinutes: number; goalCompleted: boolean };
}

function Fact({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="truncate text-[13px] font-medium tabular-nums">{value}</div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { data, isLoading, mutate } = useSWR<ProfilePayload>("/api/profile", fetcher);
  const { update: updateSession } = useSession();

  const [name, setName] = React.useState<string | null>(null);
  const [image, setImage] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (data && name === null) {
      setName(data.account.name);
      setImage(data.account.image);
    }
  }, [data, name]);

  async function saveAccount() {
    if (!name?.trim()) {
      toast.error("Name cannot be empty");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), image: image ?? "" }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error || "Failed to save");
      // Refresh the JWT-backed session so the header updates immediately.
      await updateSession({ name: json.data.name, image: json.data.image });
      await mutate();
      toast.success("Profile saved");
    } catch (err) {
      toast.error("Couldn't save profile", { description: (err as Error).message });
    } finally {
      setSaving(false);
    }
  }

  if (isLoading || !data) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title="My Profile" description="Loading…" />
      </div>
    );
  }

  const a = data.account;
  const dirty = name !== a.name || (image ?? "") !== a.image;
  const profileComplete =
    /^\+\d{1,4}$/.test(data.preferences.countryCode) &&
    /^\d{6,14}$/.test(data.preferences.phoneNumber) &&
    data.preferences.timezone.trim() !== "" &&
    data.preferences.dailyStudyGoal >= 5;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="My Profile"
        description="Your account, study preferences and WhatsApp reminders."
      />

      <div className="space-y-4">
        {/* Account */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Account</CardTitle>
            <CardDescription>How you appear across DSAspire.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-4">
              <UserAvatar name={a.name || a.email} image={image ?? a.image} size="lg" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold">{a.name || a.email.split("@")[0]}</span>
                  <span
                    className={cn(
                      "rounded border px-1.5 py-0.5 text-[11px] font-medium",
                      a.role === "user" ? "text-muted-foreground" : "border-primary/40 text-primary",
                    )}
                  >
                    {a.role}
                  </span>
                  <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                    {a.status}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-[13px] text-muted-foreground">{a.email}</p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="pf-name" className="text-xs">Display name</Label>
                <Input
                  id="pf-name"
                  value={name ?? ""}
                  maxLength={80}
                  onChange={(e) => setName(e.target.value)}
                  className="h-8 text-[13px]"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pf-image" className="text-xs">Avatar URL (optional, https)</Label>
                <Input
                  id="pf-image"
                  value={image ?? ""}
                  maxLength={500}
                  placeholder="https://…/me.png"
                  onChange={(e) => setImage(e.target.value.trim())}
                  className="h-8 text-[13px]"
                />
              </div>
            </div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] text-muted-foreground">
                Email is your sign-in identity and can only be changed by an administrator.
              </p>
              <Button size="sm" onClick={saveAccount} disabled={saving || !dirty}>
                {saving ? "Saving…" : "Save profile"}
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-4 border-t pt-4 sm:grid-cols-4">
              <Fact icon={CalendarDays} label="Member since" value={a.createdAt ? formatRelative(a.createdAt) : "—"} />
              <Fact icon={Clock3} label="Last login" value={a.lastLoginAt ? formatRelative(a.lastLoginAt) : "—"} />
              <Fact icon={KeyRound} label="Logins" value={a.loginCount} />
              <Fact icon={BadgeCheck} label="Solved" value={a.solvedCount.toLocaleString()} />
            </div>
          </CardContent>
        </Card>

        {/* Study goal snapshot */}
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-2.5">
              <Target className="h-4 w-4 text-muted-foreground" />
              <span className="text-[13px]">
                Today: <span className="font-semibold tabular-nums">{data.today.activeMinutes} min</span>
                <span className="text-muted-foreground"> / {data.preferences.dailyStudyGoal} min goal</span>
              </span>
            </div>
            <span
              className={cn(
                "rounded px-1.5 py-0.5 text-[11px] font-medium",
                data.today.goalCompleted
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                  : "bg-amber-500/15 text-amber-600 dark:text-amber-400",
              )}
            >
              {data.today.goalCompleted ? "Goal completed" : "In progress"}
            </span>
            {!profileComplete && (
              <p className="w-full text-[11px] text-muted-foreground">
                Complete your WhatsApp number, timezone and daily goal below to unlock reminders.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Contact, timezone, goal, reminder window — single source shared with Settings */}
        <WhatsAppReminderSettings onSaved={() => void mutate()} />
      </div>
    </div>
  );
}
