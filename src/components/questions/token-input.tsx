"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface TokenInputProps {
  value: string[];
  onChange: (value: string[]) => void;
  suggestions?: readonly string[];
  placeholder?: string;
  allowCustom?: boolean;
  id?: string;
}

/** Chip-style multi-value input with optional autocomplete suggestions. */
export function TokenInput({
  value,
  onChange,
  suggestions = [],
  placeholder = "Type and press Enter…",
  allowCustom = true,
  id,
}: TokenInputProps) {
  const [input, setInput] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const filtered = suggestions.filter(
    (s) => !value.includes(s) && s.toLowerCase().includes(input.toLowerCase()),
  );

  React.useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function add(v: string) {
    const trimmed = v.trim();
    if (!trimmed) return;
    if (!allowCustom && !suggestions.includes(trimmed)) return;
    if (!value.includes(trimmed)) onChange([...value, trimmed]);
    setInput("");
  }

  function remove(v: string) {
    onChange(value.filter((x) => x !== v));
  }

  return (
    <div ref={containerRef} className="relative">
      <div
        className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1.5 text-sm shadow-sm focus-within:ring-2 focus-within:ring-ring/40"
        onClick={() => setOpen(true)}
      >
        {value.map((v) => (
          <span
            key={v}
            className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
          >
            {v}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                remove(v);
              }}
              className="text-primary/70 hover:text-primary"
              aria-label={`Remove ${v}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          id={id}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add(input);
            } else if (e.key === "Backspace" && !input && value.length) {
              remove(value[value.length - 1]!);
            }
          }}
          placeholder={value.length === 0 ? placeholder : ""}
          className="min-w-[6rem] flex-1 bg-transparent px-1 py-0.5 outline-none placeholder:text-muted-foreground"
        />
      </div>

      {open && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 max-h-52 w-full overflow-auto rounded-md border bg-popover p-1 shadow-md">
          {filtered.slice(0, 30).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                add(s);
              }}
              className={cn(
                "block w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground",
              )}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
