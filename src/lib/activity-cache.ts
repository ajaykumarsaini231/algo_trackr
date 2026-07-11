import "server-only";
import { Types } from "mongoose";
import { ReminderSettings } from "@/models/ReminderSettings";

/**
 * Tiny in-process cache of the two reminder-settings fields the heartbeat
 * needs (timezone + goal), so a heartbeat doesn't re-read settings on every
 * request. Invalidated by the settings API on save.
 */
const cache = new Map<string, { tz: string; goal: number; at: number }>();
const TTL_MS = 60_000;
const MAX = 20_000;

export async function activityPrefsFor(
  userId: string,
): Promise<{ tz: string; goal: number }> {
  const hit = cache.get(userId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit;
  const doc = await ReminderSettings.findOne({ userId: new Types.ObjectId(userId) })
    .select("timezone goalMinutes")
    .lean();
  const entry = {
    tz: doc?.timezone || "",
    goal: doc?.goalMinutes ?? 60,
    at: Date.now(),
  };
  if (cache.size > MAX) cache.clear();
  cache.set(userId, entry);
  return entry;
}

export function invalidateActivityPrefs(userId: string): void {
  cache.delete(userId);
}
