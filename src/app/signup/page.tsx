"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const json = (await res.json().catch(() => null)) as
        | { success: boolean; error?: string }
        | null;

      if (!res.ok || !json?.success) {
        setError(json?.error || "Could not create the account. Try again.");
        return;
      }

      // Account created — establish the session and enter the app.
      const login = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (login?.error) {
        router.push("/signin");
        return;
      }
      router.push("/");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <Logo showSubtitle />
        </div>
        <div className="rounded-lg border bg-card p-6">
          <h1 className="text-lg font-semibold tracking-tight">Create your account</h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            Your progress, favorites and notes — private to you.
          </p>

          <form onSubmit={onSubmit} className="mt-5 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                autoComplete="name"
                maxLength={80}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ada Lovelace"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                maxLength={254}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={200}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters, a letter and a number"
              />
            </div>

            {error && (
              <p role="alert" className="text-[13px] font-medium text-destructive">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Creating account…" : "Create account"}
            </Button>
          </form>
        </div>

        <p className="mt-4 text-center text-[13px] text-muted-foreground">
          Already registered?{" "}
          <Link href="/signin" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
