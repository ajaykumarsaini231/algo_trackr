"use client";

import * as React from "react";
import { useSession } from "next-auth/react";

/**
 * Invisible active-study-time tracker, mounted once in the app shell.
 *
 * Counts a 5-second tick toward study time ONLY when ALL are true:
 *  - the user is signed in
 *  - the tab is visible            (document.visibilityState)
 *  - the window is focused         (focus/blur + document.hasFocus)
 *  - there was input in the last 2 minutes (mouse/keys/scroll/touch)
 *
 * Minimized windows, background/hidden tabs, idle users and closed browsers
 * accumulate nothing. Accumulated seconds are flushed as ONE heartbeat per
 * 60s — and only while there is something to report, so an idle client goes
 * completely silent (the server flips it to inactive after 2 minutes).
 * On tab close / hide, the remainder is saved via navigator.sendBeacon.
 */
const TICK_MS = 5_000;
const FLUSH_MS = 60_000;
const IDLE_MS = 2 * 60_000;

export function ActivityTracker() {
  const { status } = useSession();

  React.useEffect(() => {
    if (status !== "authenticated") return;

    let accumulatedSec = 0;
    let lastInputAt = Date.now();
    let lastFlushAt = Date.now();
    let reportedActive = false; // what the server currently believes
    let disposed = false;

    const tz = (() => {
      try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
      } catch {
        return "";
      }
    })();

    const isActiveNow = () =>
      document.visibilityState === "visible" &&
      document.hasFocus() &&
      Date.now() - lastInputAt < IDLE_MS;

    const onInput = () => {
      lastInputAt = Date.now();
    };

    async function flush(final: boolean) {
      const seconds = Math.min(600, Math.round(accumulatedSec));
      const activeNow = !final && isActiveNow();
      // Nothing accrued and the server already knows we're inactive → stay
      // silent (no backend spam while the user is away).
      if (seconds === 0 && reportedActive === activeNow) return;

      accumulatedSec = 0;
      lastFlushAt = Date.now();
      reportedActive = activeNow;
      const payload = JSON.stringify({ seconds, tz, active: activeNow, final });

      if (final && typeof navigator.sendBeacon === "function") {
        navigator.sendBeacon(
          "/api/activity",
          new Blob([payload], { type: "application/json" }),
        );
        return;
      }
      try {
        await fetch("/api/activity", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
          keepalive: final,
        });
      } catch {
        // Lost heartbeats only under-count study time — never break the app.
      }
    }

    const tick = window.setInterval(() => {
      if (disposed) return;
      if (isActiveNow()) accumulatedSec += TICK_MS / 1000;
      if (Date.now() - lastFlushAt >= FLUSH_MS) void flush(false);
    }, TICK_MS);

    const onVisibility = () => {
      if (document.visibilityState === "hidden") void flush(true);
      else lastInputAt = Date.now(); // returning counts as activity
    };
    const onPageHide = () => void flush(true);
    const onFocus = () => {
      lastInputAt = Date.now();
    };

    const inputEvents: (keyof WindowEventMap)[] = [
      "mousemove",
      "mousedown",
      "keydown",
      "wheel",
      "scroll",
      "touchstart",
    ];
    for (const ev of inputEvents) {
      window.addEventListener(ev, onInput, { passive: true });
    }
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("focus", onFocus);

    // Announce presence immediately so "currently active" flips fast.
    void flush(false);

    return () => {
      disposed = true;
      window.clearInterval(tick);
      for (const ev of inputEvents) window.removeEventListener(ev, onInput);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("focus", onFocus);
    };
  }, [status]);

  return null;
}
