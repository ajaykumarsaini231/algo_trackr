"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Only same-app relative paths are honored as post-login destinations. */
function safeCallbackUrl(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}

function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = safeCallbackUrl(params.get("callbackUrl"));

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (res?.error) {
        const messages: Record<string, string> = {
          locked: "Too many failed attempts. This account is locked for 15 minutes.",
          blocked: "Your account has been blocked. Contact the administrator.",
          suspended: "Your account is suspended. Contact the administrator.",
        };
        setError(messages[res.code ?? ""] ?? "Invalid email or password.");
        return;
      }
      router.push(callbackUrl);
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
          <h1 className="text-lg font-semibold tracking-tight">Sign in</h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            Track your own progress across 15,000+ questions.
          </p>

          <form onSubmit={onSubmit} className="mt-5 space-y-4">
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
                autoComplete="current-password"
                required
                maxLength={200}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p role="alert" className="text-[13px] font-medium text-destructive">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </div>

        <p className="mt-4 text-center text-[13px] text-muted-foreground">
          No account?{" "}
          <Link href="/signup" className="font-medium text-primary hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <React.Suspense>
      <SignInForm />
    </React.Suspense>
  );
}
