"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { KeyRound, Loader2, Lock, ShieldCheck, ShieldPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PinInput } from "@/components/admin/pin-input";
import { useAdmin } from "@/hooks/use-admin";
import { ApiError } from "@/lib/api-client";

function useCountdown(until: string | null, onExpire: () => void) {
  const [remaining, setRemaining] = React.useState(0);
  React.useEffect(() => {
    if (!until) return setRemaining(0);
    const tick = () => {
      const secs = Math.max(0, Math.round((new Date(until).getTime() - Date.now()) / 1000));
      setRemaining(secs);
      if (secs <= 0) onExpire();
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [until]);
  return remaining;
}

function fmt(secs: number) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function AdminAuth() {
  const { configured, locked, lockedUntil, attemptsRemaining, login, setup, mutate } = useAdmin();

  const [pin, setPin] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const remaining = useCountdown(locked ? lockedUntil : null, () => mutate());

  async function handleLogin(value?: string) {
    const key = value ?? pin;
    if (key.length !== 8) return setError("Enter all 8 digits.");
    setSubmitting(true);
    setError(null);
    try {
      await login(key);
      // success → parent re-renders to the panel
    } catch (err) {
      setPin("");
      await mutate();
      setError(err instanceof ApiError ? err.message : "Login failed. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSetup() {
    if (pin.length !== 8) return setError("Key must be exactly 8 digits.");
    if (pin !== confirm) return setError("Keys do not match.");
    setSubmitting(true);
    setError(null);
    try {
      await setup(pin, confirm);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Setup failed. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-2">
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <Card glass className="overflow-hidden">
          <div className="relative flex flex-col items-center gap-2 border-b border-border/60 bg-gradient-to-b from-primary/10 to-transparent px-6 py-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-500 shadow-lg shadow-primary/30">
              {configured ? (
                <ShieldCheck className="h-7 w-7 text-white" />
              ) : (
                <ShieldPlus className="h-7 w-7 text-white" />
              )}
            </div>
            <h1 className="text-xl font-bold">
              {configured ? "Admin Access" : "Set up Admin"}
            </h1>
            <p className="max-w-xs text-sm text-muted-foreground">
              {configured
                ? "Enter your 8-digit key to manage questions."
                : "Create a one-time 8-digit key. It's hashed with bcrypt and stored in MongoDB — never in plaintext."}
            </p>
          </div>

          <CardContent className="space-y-5 p-6">
            {locked ? (
              <div className="flex flex-col items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-6 text-center">
                <Lock className="h-8 w-8 text-destructive" />
                <div>
                  <p className="font-semibold text-destructive">Access locked</p>
                  <p className="text-sm text-muted-foreground">
                    Too many failed attempts. Try again in
                  </p>
                </div>
                <div className="font-mono text-3xl font-bold tabular-nums text-destructive">
                  {fmt(remaining)}
                </div>
              </div>
            ) : (
              <>
                <div>
                  {!configured && (
                    <label className="mb-2 block text-center text-xs font-medium text-muted-foreground">
                      New key
                    </label>
                  )}
                  <PinInput
                    value={pin}
                    onChange={(v) => {
                      setPin(v);
                      setError(null);
                    }}
                    autoFocus
                    disabled={submitting}
                    onComplete={configured ? handleLogin : undefined}
                  />
                </div>

                {!configured && (
                  <div>
                    <label className="mb-2 block text-center text-xs font-medium text-muted-foreground">
                      Confirm key
                    </label>
                    <PinInput value={confirm} onChange={setConfirm} disabled={submitting} />
                  </div>
                )}

                {error && (
                  <p className="text-center text-sm font-medium text-destructive">{error}</p>
                )}

                {configured && attemptsRemaining < 5 && attemptsRemaining > 0 && !error && (
                  <p className="text-center text-xs text-amber-500">
                    {attemptsRemaining} attempt(s) remaining before lockout.
                  </p>
                )}

                <Button
                  variant="gradient"
                  className="w-full gap-2"
                  disabled={submitting}
                  onClick={() => (configured ? handleLogin() : handleSetup())}
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <KeyRound className="h-4 w-4" />
                  )}
                  {configured ? "Unlock" : "Create admin key"}
                </Button>

                <p className="text-center text-[11px] text-muted-foreground">
                  Protected by bcrypt · 5 attempts then a 15-minute lockout
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
