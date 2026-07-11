"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  BookOpen,
  Check,
  Clock,
  ExternalLink,
  Github,
  MoreVertical,
  Pencil,
  PlayCircle,
  Plus,
  RotateCw,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DifficultyBadge, StatusBadge, PlatformBadge } from "@/components/shared/badges";
import { RatingStars } from "@/components/shared/rating-stars";
import { EmptyState } from "@/components/shared/empty-state";
import { QuestionForm } from "@/components/questions/question-form";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuestion } from "@/hooks/use-questions";
import { useQuestionMutations } from "@/hooks/use-question-mutations";
import { STATUSES } from "@/lib/constants";
import { cn, formatDate, formatMinutes, slugify } from "@/lib/utils";
import type { QuestionInput, Status } from "@/types";

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value || "—"}</span>
    </div>
  );
}

function LinkButton({
  href,
  icon,
  label,
}: {
  href?: string;
  icon: React.ReactNode;
  label: string;
}) {
  if (!href) return null;
  return (
    <Button asChild variant="outline" size="sm" className="gap-2">
      <a href={href} target="_blank" rel="noopener noreferrer">
        {icon}
        {label}
        <ExternalLink className="h-3 w-3 opacity-60" />
      </a>
    </Button>
  );
}

export default function QuestionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { question: q, isLoading, mutate } = useQuestion(id);
  const { update, archive, restore } = useQuestionMutations();

  const [editOpen, setEditOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [notes, setNotes] = React.useState("");
  const [revisionNotes, setRevisionNotes] = React.useState("");

  React.useEffect(() => {
    if (q) {
      setNotes(q.notes);
      setRevisionNotes(q.revisionNotes);
    }
  }, [q]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-10 w-2/3" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-96 lg:col-span-2" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (!q) {
    return (
      <EmptyState
        title="Question not found"
        description="It may have been archived or the link is incorrect."
        action={
          <Button asChild variant="outline">
            <Link href="/search">Back to search</Link>
          </Button>
        }
      />
    );
  }

  const notesDirty = notes !== q.notes || revisionNotes !== q.revisionNotes;

  async function quick(patch: Partial<QuestionInput>, silent = false) {
    await update(q!._id, patch, { silent });
    mutate();
  }

  async function saveNotes() {
    await quick({ notes, revisionNotes });
  }

  async function handleEditSubmit(data: QuestionInput) {
    setSaving(true);
    const res = await update(q!._id, data);
    setSaving(false);
    if (res) {
      setEditOpen(false);
      mutate();
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <button
        onClick={() => router.back()}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <DifficultyBadge difficulty={q.difficulty} />
            <StatusBadge status={q.status} />
            <PlatformBadge platform={q.platform} />
            {q.revisionNeeded && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-500">
                <RotateCw className="h-3 w-3" /> Revision
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{q.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Link href={`/topics/${slugify(q.topic)}`} className="hover:text-primary">
              {q.topic}
            </Link>
            {q.subtopic && <span>· {q.subtopic}</span>}
            {q.pattern && (
              <Link href={`/patterns/${slugify(q.pattern)}`} className="text-primary hover:underline">
                · {q.pattern}
              </Link>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={q.favorite ? "default" : "outline"}
            size="icon"
            onClick={() => quick({ favorite: !q.favorite }, true)}
            aria-label="Toggle favorite"
          >
            <Star className={cn("h-4 w-4", q.favorite && "fill-current")} />
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4" /> Edit
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label="More actions">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {q.archived ? (
                <DropdownMenuItem onClick={() => restore(q._id).then(() => mutate())}>
                  <ArchiveRestore className="h-4 w-4" /> Restore
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => archive(q._id).then(() => mutate())}>
                  <Archive className="h-4 w-4" /> Archive
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Left: details */}
        <div className="space-y-4 lg:col-span-2">
          {(q.concept || q.approach) && (
            <Card glass>
              <CardHeader>
                <CardTitle className="text-base">Concept & Approach</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {q.concept && (
                  <div>
                    <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Concept
                    </h4>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{q.concept}</p>
                  </div>
                )}
                {q.approach && (
                  <div>
                    <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Approach
                    </h4>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{q.approach}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card glass>
            <CardHeader>
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="divide-y divide-border/60 pt-0">
              <DetailRow label="Platform" value={q.platform} />
              <DetailRow label="Topic" value={q.topic} />
              <DetailRow label="Subtopic" value={q.subtopic} />
              <DetailRow label="Pattern" value={q.pattern} />
              <DetailRow label="Time complexity" value={q.timeComplexity && <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{q.timeComplexity}</code>} />
              <DetailRow label="Space complexity" value={q.spaceComplexity && <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{q.spaceComplexity}</code>} />
              <DetailRow label="Interview level" value={q.interviewLevel} />
              <DetailRow label="Estimated time" value={formatMinutes(q.estimatedTime)} />
              <DetailRow label="Attempts" value={q.attemptCount} />
              <DetailRow label="Created" value={formatDate(q.createdAt)} />
              <DetailRow label="Updated" value={formatDate(q.updatedAt)} />
              <DetailRow label="Last revised" value={q.lastRevisedAt ? formatDate(q.lastRevisedAt) : "—"} />
              <DetailRow label="Revision date" value={q.revisionDate ? formatDate(q.revisionDate) : "—"} />
            </CardContent>
          </Card>

          {(q.companies.length > 0 || q.tags.length > 0) && (
            <Card glass>
              <CardContent className="space-y-3 p-5">
                {q.companies.length > 0 && (
                  <div>
                    <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Companies</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {q.companies.map((c) => (
                        <Link key={c} href={`/companies/${slugify(c)}`} className="rounded-md border border-border bg-muted/50 px-2 py-1 text-xs font-medium hover:border-primary/40 hover:text-primary">
                          {c}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
                {q.tags.length > 0 && (
                  <div>
                    <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tags</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {q.tags.map((t) => (
                        <span key={t} className="rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                          #{t}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Resources */}
          {(q.problemLink || q.solutionLink || q.videoLink || q.editorialLink) && (
            <Card glass>
              <CardHeader>
                <CardTitle className="text-base">Resources</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <LinkButton href={q.problemLink} icon={<ExternalLink className="h-4 w-4" />} label="Problem" />
                <LinkButton href={q.solutionLink} icon={<Github className="h-4 w-4" />} label="My Solution" />
                <LinkButton href={q.videoLink} icon={<PlayCircle className="h-4 w-4" />} label="Video" />
                <LinkButton href={q.editorialLink} icon={<BookOpen className="h-4 w-4" />} label="Editorial" />
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: progress + notes */}
        <div className="space-y-4">
          <Card glass>
            <CardHeader>
              <CardTitle className="text-base">Progress</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                variant={q.status === "Solved" ? "default" : "gradient"}
                className="w-full gap-2"
                onClick={() => quick({ status: "Solved" })}
              >
                <Check className="h-4 w-4" />
                {q.status === "Solved" ? "Solved" : "Mark as Solved"}
              </Button>

              <div>
                <label className="mb-1.5 block text-xs text-muted-foreground">Status</label>
                <Select value={q.status} onValueChange={(v) => quick({ status: v as Status })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={q.favorite ? "default" : "outline"}
                  size="sm"
                  className="gap-1.5"
                  onClick={() => quick({ favorite: !q.favorite }, true)}
                >
                  <Star className={cn("h-3.5 w-3.5", q.favorite && "fill-current")} /> Favorite
                </Button>
                <Button
                  variant={q.revisionNeeded ? "default" : "outline"}
                  size="sm"
                  className="gap-1.5"
                  onClick={() => quick({ revisionNeeded: !q.revisionNeeded }, true)}
                >
                  <RotateCw className="h-3.5 w-3.5" /> Revision
                </Button>
              </div>

              <Button
                variant="outline"
                size="sm"
                className="w-full gap-1.5"
                onClick={() => quick({ attemptCount: q.attemptCount + 1 }, true)}
              >
                <Plus className="h-3.5 w-3.5" /> Log attempt ({q.attemptCount})
              </Button>

              <Separator />

              <div>
                <label className="mb-1.5 block text-xs text-muted-foreground">Rating</label>
                <RatingStars value={q.rating} onChange={(v) => quick({ rating: v }, true)} size={22} />
              </div>
            </CardContent>
          </Card>

          <Card glass>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Notes</CardTitle>
              {notesDirty && (
                <Button size="sm" variant="gradient" className="h-7 gap-1.5" onClick={saveNotes}>
                  <Check className="h-3.5 w-3.5" /> Save
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Your notes, edge cases, gotchas…"
                rows={4}
              />
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <RotateCw className="h-3 w-3" /> Revision notes
                </label>
                <Textarea
                  value={revisionNotes}
                  onChange={(e) => setRevisionNotes(e.target.value)}
                  placeholder="What to recall when revising…"
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit question</DialogTitle>
          </DialogHeader>
          <QuestionForm
            initial={q}
            onSubmit={handleEditSubmit}
            onCancel={() => setEditOpen(false)}
            submitting={saving}
            submitLabel="Save changes"
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
