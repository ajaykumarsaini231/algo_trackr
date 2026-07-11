"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Archive,
  ArchiveRestore,
  Download,
  LogOut,
  Pencil,
  Plus,
  Search,
  Sprout,
  Upload,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
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
import { DifficultyBadge, StatusBadge } from "@/components/shared/badges";
import { QuestionForm } from "@/components/questions/question-form";
import { ImportDialog } from "@/components/admin/import-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdmin } from "@/hooks/use-admin";
import { useQuestions } from "@/hooks/use-questions";
import { useQuestionMutations } from "@/hooks/use-question-mutations";
import { useStats } from "@/hooks/use-stats";
import { useDebounce } from "@/hooks/use-debounce";
import { seedApi } from "@/lib/api-client";
import { revalidateQuestions } from "@/hooks/use-question-mutations";
import type { Question, QuestionInput } from "@/types";

function ActionTile({
  icon,
  title,
  description,
  onClick,
  accent,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick?: () => void;
  accent: string;
}) {
  return (
    <button
      onClick={onClick}
      className="group flex items-start gap-3 rounded-xl border border-border/60 bg-card/50 p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
    >
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${accent}`}>
        {icon}
      </div>
      <div>
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
    </button>
  );
}

export function AdminPanel() {
  const { logout } = useAdmin();
  const { create, update, archive, restore } = useQuestionMutations();
  const { stats } = useStats();

  const [search, setSearch] = React.useState("");
  const debounced = useDebounce(search, 300);
  const [showArchived, setShowArchived] = React.useState(false);

  const { questions, total, isLoading } = useQuestions({
    search: debounced,
    archived: showArchived || undefined,
    limit: 50,
    sort: "updatedAt:desc",
  });

  const allForTitles = useQuestions({ limit: 2000 });
  const existingTitles = React.useMemo(
    () => new Set(allForTitles.questions.map((q) => q.title.trim().toLowerCase())),
    [allForTitles.questions],
  );

  const [addOpen, setAddOpen] = React.useState(false);
  const [importOpen, setImportOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Question | null>(null);
  const [saving, setSaving] = React.useState(false);

  async function handleAdd(data: QuestionInput) {
    if (existingTitles.has(data.title.trim().toLowerCase())) {
      toast.warning("Possible duplicate", {
        description: `"${data.title}" already exists. Saving anyway as a new entry.`,
      });
    }
    setSaving(true);
    const res = await create(data);
    setSaving(false);
    if (res) setAddOpen(false);
  }

  async function handleEdit(data: QuestionInput) {
    if (!editing) return;
    setSaving(true);
    const res = await update(editing._id, data);
    setSaving(false);
    if (res) setEditing(null);
  }

  async function downloadExport(format: "json" | "csv") {
    try {
      const res = await fetch(`/api/export?format=${format}&all=true`);
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dsa-questions.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported as ${format.toUpperCase()}`);
    } catch (err) {
      toast.error("Export failed", { description: (err as Error).message });
    }
  }

  async function seed() {
    try {
      const res = await seedApi.run();
      await revalidateQuestions();
      toast.success(`Seeded ${res.inserted} sample question(s)`);
    } catch (err) {
      toast.error("Seed failed", { description: (err as Error).message });
    }
  }

  return (
    <div>
      <PageHeader
        title="Admin Panel"
        description="Add, edit, archive, and import questions. Nothing is ever deleted."
        actions={
          <div className="flex items-center gap-2">
            {stats && (
              <span className="hidden rounded-lg border border-border/60 bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground sm:inline">
                {stats.total} active · {stats.archived} archived
              </span>
            )}
            <Button variant="outline" size="sm" className="gap-2" onClick={() => logout()}>
              <LogOut className="h-4 w-4" /> Lock
            </Button>
          </div>
        }
      />

      {/* Action tiles */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <ActionTile
          icon={<Plus className="h-5 w-5 text-indigo-500" />}
          title="Add question"
          description="Create a new entry"
          accent="bg-indigo-500/15"
          onClick={() => setAddOpen(true)}
        />
        <ActionTile
          icon={<Upload className="h-5 w-5 text-violet-500" />}
          title="Bulk import"
          description="CSV or JSON, with preview"
          accent="bg-violet-500/15"
          onClick={() => setImportOpen(true)}
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="group flex items-start gap-3 rounded-xl border border-border/60 bg-card/50 p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15">
                <Download className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <div className="text-sm font-semibold">Export</div>
                <div className="text-xs text-muted-foreground">Download JSON / CSV</div>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => downloadExport("json")}>Export as JSON</DropdownMenuItem>
            <DropdownMenuItem onClick={() => downloadExport("csv")}>Export as CSV</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <ActionTile
          icon={<Sprout className="h-5 w-5 text-amber-500" />}
          title="Seed samples"
          description="Load starter questions"
          accent="bg-amber-500/15"
          onClick={seed}
        />
      </div>

      {/* Management list */}
      <Card glass>
        <CardContent className="p-4">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search questions to manage…"
                className="h-9 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring/40"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Switch checked={showArchived} onCheckedChange={setShowArchived} />
              Show archived
            </label>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : questions.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {showArchived ? "No archived questions." : "No questions yet. Add one or seed samples."}
            </p>
          ) : (
            <div className="divide-y divide-border/60">
              {questions.map((q) => (
                <div key={q._id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <Link href={`/questions/${q._id}`} className="truncate text-sm font-medium hover:text-primary">
                      {q.title}
                    </Link>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{q.topic}</span>
                      {q.subtopic && <span>· {q.subtopic}</span>}
                    </div>
                  </div>
                  <div className="hidden items-center gap-2 sm:flex">
                    <DifficultyBadge difficulty={q.difficulty} />
                    <StatusBadge status={q.status} />
                  </div>
                  <Button variant="ghost" size="icon-sm" onClick={() => setEditing(q)} aria-label="Edit">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  {q.archived ? (
                    <Button variant="ghost" size="icon-sm" onClick={() => restore(q._id)} aria-label="Restore">
                      <ArchiveRestore className="h-4 w-4 text-emerald-500" />
                    </Button>
                  ) : (
                    <Button variant="ghost" size="icon-sm" onClick={() => archive(q._id)} aria-label="Archive">
                      <Archive className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  )}
                </div>
              ))}
              {total > questions.length && (
                <p className="pt-3 text-center text-xs text-muted-foreground">
                  Showing {questions.length} of {total}. Refine your search to find more.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add question</DialogTitle>
          </DialogHeader>
          <QuestionForm onSubmit={handleAdd} onCancel={() => setAddOpen(false)} submitting={saving} submitLabel="Add question" />
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={Boolean(editing)} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit question</DialogTitle>
          </DialogHeader>
          {editing && (
            <QuestionForm
              initial={editing}
              onSubmit={handleEdit}
              onCancel={() => setEditing(null)}
              submitting={saving}
              submitLabel="Save changes"
            />
          )}
        </DialogContent>
      </Dialog>

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        existingTitles={existingTitles}
        onDone={() => revalidateQuestions()}
      />
    </div>
  );
}
