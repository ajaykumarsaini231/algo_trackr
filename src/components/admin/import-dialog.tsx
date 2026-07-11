"use client";

import * as React from "react";
import { AlertTriangle, FileUp, Loader2, Upload } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { questionsApi } from "@/lib/api-client";
import { toast } from "sonner";

/** Minimal CSV parser supporting quoted fields, escaped quotes and newlines. */
function parseCSV(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      field = "";
      row = [];
    } else field += c;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  const filtered = rows.filter((r) => r.some((c) => c.trim() !== ""));
  if (filtered.length < 1) return [];
  const headers = filtered[0]!.map((h) => h.trim());
  return filtered.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => (obj[h] = (r[idx] ?? "").trim()));
    return obj;
  });
}

function parseInput(text: string): Record<string, unknown>[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    const json = JSON.parse(trimmed);
    return Array.isArray(json) ? json : [json];
  }
  return parseCSV(trimmed);
}

export function ImportDialog({
  open,
  onOpenChange,
  existingTitles,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  existingTitles: Set<string>;
  onDone: () => void;
}) {
  const [raw, setRaw] = React.useState("");
  const [mode, setMode] = React.useState<"append" | "upsert">("append");
  const [submitting, setSubmitting] = React.useState(false);

  const parsed = React.useMemo(() => {
    try {
      return { rows: parseInput(raw), error: null as string | null };
    } catch (e) {
      return { rows: [] as Record<string, unknown>[], error: (e as Error).message };
    }
  }, [raw]);

  const rows = parsed.rows;
  const duplicates = rows.filter((r) => {
    const title = String(r.title ?? r.Title ?? "").trim().toLowerCase();
    return title && existingTitles.has(title);
  }).length;
  const fresh = rows.length - duplicates;

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setRaw(String(reader.result ?? ""));
    reader.readAsText(file);
  }

  async function submit() {
    if (rows.length === 0) return;
    setSubmitting(true);
    const res = await questionsApi
      .bulkImport({ mode, questions: rows })
      .catch((err) => {
        toast.error("Import failed", { description: err.message });
        return null;
      });
    setSubmitting(false);
    if (res) {
      toast.success("Import complete", {
        description: `${res.inserted} added · ${res.updated} updated · ${res.skipped} skipped`,
      });
      setRaw("");
      onDone();
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk import</DialogTitle>
          <DialogDescription>
            Paste JSON or CSV, or upload a file. Existing questions are never
            deleted — only appended or updated.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm" className="gap-2">
              <label className="cursor-pointer">
                <FileUp className="h-4 w-4" />
                Upload .json / .csv
                <input type="file" accept=".json,.csv,application/json,text/csv" className="hidden" onChange={handleFile} />
              </label>
            </Button>
            <Select value={mode} onValueChange={(v) => setMode(v as "append" | "upsert")}>
              <SelectTrigger className="h-8 w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="append">Append (add new)</SelectItem>
                <SelectItem value="upsert">Upsert (add + update)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder='[{"title":"Two Sum","topic":"Arrays","difficulty":"Easy","platform":"LeetCode"}]  — or CSV with a header row'
            rows={7}
            className="font-mono text-xs"
          />

          {parsed.error && (
            <p className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4" /> Could not parse: {parsed.error}
            </p>
          )}

          {rows.length > 0 && (
            <div className="rounded-lg border border-border">
              <div className="flex items-center justify-between border-b border-border bg-muted/40 px-3 py-2 text-sm">
                <span className="font-medium">Preview · {rows.length} rows</span>
                <span className="flex items-center gap-2">
                  <Badge variant="success">{fresh} new</Badge>
                  {duplicates > 0 && <Badge variant="warning">{duplicates} duplicate</Badge>}
                </span>
              </div>
              <div className="max-h-52 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-card text-muted-foreground">
                    <tr>
                      <th className="px-3 py-1.5 font-medium">Title</th>
                      <th className="px-3 py-1.5 font-medium">Topic</th>
                      <th className="px-3 py-1.5 font-medium">Difficulty</th>
                      <th className="px-3 py-1.5 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 50).map((r, i) => {
                      const title = String(r.title ?? r.Title ?? "").trim();
                      const dup = title && existingTitles.has(title.toLowerCase());
                      return (
                        <tr key={i} className="border-t border-border/60">
                          <td className="max-w-[220px] truncate px-3 py-1.5">{title || "—"}</td>
                          <td className="px-3 py-1.5 text-muted-foreground">{String(r.topic ?? r.Topic ?? "—")}</td>
                          <td className="px-3 py-1.5 text-muted-foreground">{String(r.difficulty ?? r.Difficulty ?? "—")}</td>
                          <td className="px-3 py-1.5">
                            {dup && <span className="text-amber-500">dup</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-border/60 pt-4">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button variant="gradient" className="gap-2" disabled={submitting || rows.length === 0} onClick={submit}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Import {rows.length > 0 ? `${rows.length} rows` : ""}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
