"use client";

import { mutate as globalMutate } from "swr";
import { toast } from "sonner";
import { ApiError, questionsApi } from "@/lib/api-client";
import type { Question, QuestionInput } from "@/types";

/** Revalidate every questions list + the stats endpoint after a mutation. */
export function revalidateQuestions() {
  return globalMutate(
    (key) =>
      typeof key === "string" &&
      (key.startsWith("/api/questions") || key.startsWith("/api/stats")),
    undefined,
    { revalidate: true },
  );
}

function handleError(err: unknown, fallback: string) {
  if (err instanceof ApiError) {
    if (err.status === 401) {
      toast.error("Sign in required", {
        description: "Your session has expired — sign in again to save changes.",
      });
      return;
    }
    if (err.status === 403) {
      toast.error("Admin access required", {
        description: "Catalog changes need an admin account or the Admin Panel key.",
      });
      return;
    }
    if (err.status === 429) {
      toast.error("Slow down", { description: "Too many requests — try again shortly." });
      return;
    }
    toast.error(fallback, { description: err.message });
    return;
  }
  toast.error(fallback);
}

/**
 * Question mutations with toast feedback + automatic revalidation.
 * Updates are OPTIMISTIC on the detail cache: the UI reflects the change
 * instantly and rolls back to server truth if the request fails.
 * All actions are append/update only — nothing is ever hard-deleted.
 */
export function useQuestionMutations() {
  return {
    async create(input: Partial<QuestionInput>): Promise<Question | null> {
      try {
        const q = await questionsApi.create(input);
        await revalidateQuestions();
        toast.success("Question added", { description: q.title });
        return q;
      } catch (err) {
        handleError(err, "Failed to add question");
        return null;
      }
    },

    async update(
      id: string,
      input: Partial<QuestionInput>,
      opts: { silent?: boolean } = {},
    ): Promise<Question | null> {
      const key = `/api/questions/${id}`;
      // Optimistic: apply the patch to the cached detail immediately.
      await globalMutate(
        key,
        (current: Question | undefined) =>
          current ? ({ ...current, ...input } as Question) : current,
        { revalidate: false },
      );
      try {
        const q = await questionsApi.update(id, input);
        // Server truth into the detail cache, then refresh dependent lists.
        await globalMutate(key, q, { revalidate: false });
        await revalidateQuestions();
        if (!opts.silent) toast.success("Saved");
        return q;
      } catch (err) {
        // Roll back the optimistic patch.
        await globalMutate(key);
        handleError(err, "Failed to save changes");
        return null;
      }
    },

    async archive(id: string): Promise<boolean> {
      try {
        await questionsApi.archive(id);
        await Promise.all([revalidateQuestions(), globalMutate(`/api/questions/${id}`)]);
        toast.success("Archived", {
          description: "The question is hidden but never deleted — restore anytime.",
        });
        return true;
      } catch (err) {
        handleError(err, "Failed to archive");
        return false;
      }
    },

    async restore(id: string): Promise<boolean> {
      try {
        await questionsApi.restore(id);
        await Promise.all([revalidateQuestions(), globalMutate(`/api/questions/${id}`)]);
        toast.success("Restored");
        return true;
      } catch (err) {
        handleError(err, "Failed to restore");
        return false;
      }
    },
  };
}
