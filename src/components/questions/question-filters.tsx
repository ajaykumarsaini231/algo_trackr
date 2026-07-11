"use client";

import * as React from "react";
import { Search, SlidersHorizontal, Star, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useDebounce } from "@/hooks/use-debounce";
import {
  COMPANIES,
  DIFFICULTIES,
  PATTERN_NAMES,
  PLATFORMS,
  SORT_OPTIONS,
  STATUSES,
  TOPIC_NAMES,
} from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { QuestionFilters } from "@/types";

type Dimension =
  | "topic"
  | "company"
  | "pattern"
  | "platform"
  | "difficulty"
  | "status";

interface FiltersProps {
  filters: QuestionFilters;
  onChange: (patch: Partial<QuestionFilters>) => void;
  onReset?: () => void;
  hide?: Dimension[];
  showSearch?: boolean;
}

function FilterSelect({
  value,
  placeholder,
  options,
  onValueChange,
}: {
  value: string;
  placeholder: string;
  options: readonly string[];
  onValueChange: (v: string) => void;
}) {
  return (
    <Select
      value={value || "all"}
      onValueChange={(v) => onValueChange(v === "all" ? "" : v)}
    >
      <SelectTrigger className="h-9 w-full min-w-[8rem] sm:w-auto">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        <SelectItem value="all">{placeholder}</SelectItem>
        {options.map((opt) => (
          <SelectItem key={opt} value={opt}>
            {opt}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function QuestionFiltersBar({
  filters,
  onChange,
  onReset,
  hide = [],
  showSearch = true,
}: FiltersProps) {
  const [searchInput, setSearchInput] = React.useState(filters.search ?? "");
  const debounced = useDebounce(searchInput, 300);
  const firstRender = React.useRef(true);

  React.useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    onChange({ search: debounced });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  // Keep local input in sync when filters are reset externally.
  React.useEffect(() => {
    setSearchInput(filters.search ?? "");
  }, [filters.search]);

  const has = (d: Dimension) => !hide.includes(d);
  const activeCount = [
    filters.topic,
    filters.company,
    filters.pattern,
    filters.platform,
    filters.difficulty,
    filters.status,
    filters.favorite ? "1" : "",
    filters.revision ? "1" : "",
  ].filter(Boolean).length;

  return (
    <div className="mb-6 space-y-3">
      {showSearch && (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by title, topic, company, tag, notes…"
            className="h-10 w-full rounded-lg border border-input bg-background pl-10 pr-10 text-sm outline-none transition-colors focus:border-primary/50 focus:ring-2 focus:ring-ring/40"
          />
          {searchInput && (
            <button
              onClick={() => setSearchInput("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="hidden items-center gap-1.5 text-xs font-medium text-muted-foreground sm:flex">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filters
        </div>

        {has("difficulty") && (
          <FilterSelect
            value={filters.difficulty ?? ""}
            placeholder="Difficulty"
            options={DIFFICULTIES}
            onValueChange={(v) => onChange({ difficulty: v as QuestionFilters["difficulty"] })}
          />
        )}
        {has("status") && (
          <FilterSelect
            value={filters.status ?? ""}
            placeholder="Status"
            options={STATUSES}
            onValueChange={(v) => onChange({ status: v as QuestionFilters["status"] })}
          />
        )}
        {has("topic") && (
          <FilterSelect
            value={filters.topic ?? ""}
            placeholder="Topic"
            options={TOPIC_NAMES}
            onValueChange={(v) => onChange({ topic: v })}
          />
        )}
        {has("pattern") && (
          <FilterSelect
            value={filters.pattern ?? ""}
            placeholder="Pattern"
            options={PATTERN_NAMES}
            onValueChange={(v) => onChange({ pattern: v })}
          />
        )}
        {has("company") && (
          <FilterSelect
            value={filters.company ?? ""}
            placeholder="Company"
            options={COMPANIES}
            onValueChange={(v) => onChange({ company: v })}
          />
        )}
        {has("platform") && (
          <FilterSelect
            value={filters.platform ?? ""}
            placeholder="Platform"
            options={PLATFORMS}
            onValueChange={(v) => onChange({ platform: v })}
          />
        )}

        <Button
          type="button"
          variant={filters.favorite ? "default" : "outline"}
          size="sm"
          className="gap-1.5"
          onClick={() => onChange({ favorite: !filters.favorite })}
        >
          <Star className={cn("h-3.5 w-3.5", filters.favorite && "fill-current")} />
          Favorites
        </Button>

        <Select
          value={filters.sort || "createdAt:desc"}
          onValueChange={(v) => onChange({ sort: v })}
        >
          <SelectTrigger className="h-9 w-auto min-w-[9rem]">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {(activeCount > 0 || filters.search) && onReset && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1 text-muted-foreground"
            onClick={() => {
              setSearchInput("");
              onReset();
            }}
          >
            <X className="h-3.5 w-3.5" />
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}
