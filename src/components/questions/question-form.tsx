"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RatingStars } from "@/components/shared/rating-stars";
import { TokenInput } from "@/components/questions/token-input";
import {
  COMPANIES,
  DIFFICULTIES,
  INTERVIEW_LEVELS,
  PATTERN_NAMES,
  PLATFORMS,
  STATUSES,
  TOPIC_NAMES,
  getSubtopics,
} from "@/lib/constants";
import { toISODate } from "@/lib/utils";
import type { Question, QuestionInput } from "@/types";

const EMPTY: QuestionInput = {
  title: "",
  problemLink: "",
  platform: "LeetCode",
  difficulty: "Medium",
  topic: "Arrays",
  subtopic: "",
  pattern: "",
  companies: [],
  concept: "",
  approach: "",
  timeComplexity: "",
  spaceComplexity: "",
  solutionLink: "",
  videoLink: "",
  editorialLink: "",
  notes: "",
  revisionNotes: "",
  status: "Not Started",
  favorite: false,
  revisionNeeded: false,
  lastRevisedAt: null,
  revisionDate: null,
  attemptCount: 0,
  rating: 0,
  interviewLevel: "",
  estimatedTime: 0,
  tags: [],
  archived: false,
};

function Field({
  label,
  htmlFor,
  hint,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label htmlFor={htmlFor} className="mb-1.5 block text-xs text-muted-foreground">
        {label}
      </Label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <h3 className="col-span-full mt-2 border-b border-border/60 pb-1.5 text-sm font-semibold text-foreground/90">
    {children}
  </h3>
);

interface QuestionFormProps {
  initial?: Partial<Question>;
  onSubmit: (data: QuestionInput) => void | Promise<void>;
  onCancel?: () => void;
  submitting?: boolean;
  submitLabel?: string;
}

export function QuestionForm({
  initial,
  onSubmit,
  onCancel,
  submitting,
  submitLabel = "Save question",
}: QuestionFormProps) {
  const [form, setForm] = React.useState<QuestionInput>(() => ({
    ...EMPTY,
    ...initial,
    companies: initial?.companies ?? [],
    tags: initial?.tags ?? [],
  }));
  const [error, setError] = React.useState<string | null>(null);

  const set = <K extends keyof QuestionInput>(key: K, value: QuestionInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const subtopics = getSubtopics(form.topic);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return setError("Title is required.");
    if (!form.topic.trim()) return setError("Topic is required.");
    setError(null);
    onSubmit(form);
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SectionTitle>Problem</SectionTitle>

        <Field label="Title *" htmlFor="title" className="sm:col-span-2">
          <Input
            id="title"
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="e.g. Two Sum"
            required
          />
        </Field>

        <Field label="Problem link" htmlFor="problemLink" className="sm:col-span-2">
          <Input
            id="problemLink"
            type="url"
            value={form.problemLink}
            onChange={(e) => set("problemLink", e.target.value)}
            placeholder="https://leetcode.com/problems/..."
          />
        </Field>

        <Field label="Platform">
          <Select value={form.platform} onValueChange={(v) => set("platform", v as QuestionInput["platform"])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {PLATFORMS.map((p) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Difficulty">
          <Select value={form.difficulty} onValueChange={(v) => set("difficulty", v as QuestionInput["difficulty"])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {DIFFICULTIES.map((d) => (
                <SelectItem key={d} value={d}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <SectionTitle>Classification</SectionTitle>

        <Field label="Topic *">
          <Select
            value={form.topic}
            onValueChange={(v) => {
              const subs = getSubtopics(v);
              setForm((f) => ({
                ...f,
                topic: v,
                subtopic: subs.includes(f.subtopic) ? f.subtopic : "",
              }));
            }}
          >
            <SelectTrigger><SelectValue placeholder="Select topic" /></SelectTrigger>
            <SelectContent className="max-h-72">
              {TOPIC_NAMES.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Subtopic">
          <Select
            value={form.subtopic || "none"}
            onValueChange={(v) => set("subtopic", v === "none" ? "" : v)}
          >
            <SelectTrigger><SelectValue placeholder="Select subtopic" /></SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="none">—</SelectItem>
              {subtopics.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Pattern">
          <Select
            value={form.pattern || "none"}
            onValueChange={(v) => set("pattern", v === "none" ? "" : v)}
          >
            <SelectTrigger><SelectValue placeholder="Select pattern" /></SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="none">—</SelectItem>
              {PATTERN_NAMES.map((p) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Status">
          <Select value={form.status} onValueChange={(v) => set("status", v as QuestionInput["status"])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Companies" className="sm:col-span-2">
          <TokenInput
            value={form.companies}
            onChange={(v) => set("companies", v)}
            suggestions={COMPANIES}
            placeholder="Add company tags…"
          />
        </Field>

        <Field label="Tags" className="sm:col-span-2">
          <TokenInput
            value={form.tags}
            onChange={(v) => set("tags", v)}
            placeholder="Add custom tags…"
          />
        </Field>

        <SectionTitle>Approach & complexity</SectionTitle>

        <Field label="Concept" className="sm:col-span-2">
          <Textarea
            value={form.concept}
            onChange={(e) => set("concept", e.target.value)}
            placeholder="Core idea / intuition"
            rows={2}
          />
        </Field>

        <Field label="Approach" className="sm:col-span-2">
          <Textarea
            value={form.approach}
            onChange={(e) => set("approach", e.target.value)}
            placeholder="Step-by-step approach"
            rows={3}
          />
        </Field>

        <Field label="Time complexity" htmlFor="tc">
          <Input id="tc" value={form.timeComplexity} onChange={(e) => set("timeComplexity", e.target.value)} placeholder="O(n)" />
        </Field>
        <Field label="Space complexity" htmlFor="sc">
          <Input id="sc" value={form.spaceComplexity} onChange={(e) => set("spaceComplexity", e.target.value)} placeholder="O(1)" />
        </Field>

        <SectionTitle>Resources</SectionTitle>

        <Field label="My solution link">
          <Input type="url" value={form.solutionLink} onChange={(e) => set("solutionLink", e.target.value)} placeholder="https://github.com/..." />
        </Field>
        <Field label="Video link">
          <Input type="url" value={form.videoLink} onChange={(e) => set("videoLink", e.target.value)} placeholder="https://youtube.com/..." />
        </Field>
        <Field label="Editorial link" className="sm:col-span-2">
          <Input type="url" value={form.editorialLink} onChange={(e) => set("editorialLink", e.target.value)} placeholder="https://..." />
        </Field>

        <SectionTitle>Notes</SectionTitle>

        <Field label="Notes" className="sm:col-span-2">
          <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="General notes, edge cases, gotchas…" rows={3} />
        </Field>
        <Field label="Revision notes" className="sm:col-span-2">
          <Textarea value={form.revisionNotes} onChange={(e) => set("revisionNotes", e.target.value)} placeholder="What to remember when revising" rows={2} />
        </Field>

        <SectionTitle>Metadata</SectionTitle>

        <Field label="Attempt count" htmlFor="ac">
          <Input id="ac" type="number" min={0} value={form.attemptCount} onChange={(e) => set("attemptCount", Number(e.target.value))} />
        </Field>
        <Field label="Estimated time (min)" htmlFor="et">
          <Input id="et" type="number" min={0} value={form.estimatedTime} onChange={(e) => set("estimatedTime", Number(e.target.value))} />
        </Field>

        <Field label="Interview level">
          <Select value={form.interviewLevel || "none"} onValueChange={(v) => set("interviewLevel", (v === "none" ? "" : v) as QuestionInput["interviewLevel"])}>
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">—</SelectItem>
              {INTERVIEW_LEVELS.map((l) => (
                <SelectItem key={l} value={l}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Rating">
          <div className="flex h-9 items-center">
            <RatingStars value={form.rating} onChange={(v) => set("rating", v)} size={20} />
          </div>
        </Field>

        <Field label="Custom revision date" htmlFor="rd">
          <Input
            id="rd"
            type="date"
            value={form.revisionDate ? toISODate(form.revisionDate) : ""}
            onChange={(e) => set("revisionDate", e.target.value ? new Date(e.target.value).toISOString() : null)}
          />
        </Field>
        <Field label="Last revised" htmlFor="lr">
          <Input
            id="lr"
            type="date"
            value={form.lastRevisedAt ? toISODate(form.lastRevisedAt) : ""}
            onChange={(e) => set("lastRevisedAt", e.target.value ? new Date(e.target.value).toISOString() : null)}
          />
        </Field>

        <div className="flex items-center gap-6 sm:col-span-2">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Switch checked={form.favorite} onCheckedChange={(v) => set("favorite", v)} />
            Favorite
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Switch checked={form.revisionNeeded} onCheckedChange={(v) => set("revisionNeeded", v)} />
            Needs revision
          </label>
        </div>
      </div>

      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex items-center justify-end gap-2 border-t border-border/60 pt-4">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" variant="gradient" disabled={submitting} className="gap-2">
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
