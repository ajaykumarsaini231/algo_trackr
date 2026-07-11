import {
  AlertCircle,
  CheckCircle2,
  Circle,
  MinusCircle,
  RotateCw,
  Timer,
} from "lucide-react";
import { DIFFICULTY_DOT, DIFFICULTY_STYLES, STATUS_STYLES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Difficulty, Status } from "@/types";

export function DifficultyBadge({
  difficulty,
  className,
}: {
  difficulty: Difficulty;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        DIFFICULTY_STYLES[difficulty],
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", DIFFICULTY_DOT[difficulty])} />
      {difficulty}
    </span>
  );
}

const STATUS_ICONS: Record<Status, typeof Circle> = {
  "Not Started": Circle,
  Attempted: Timer,
  Solved: CheckCircle2,
  "Need Revision": AlertCircle,
  Revisit: RotateCw,
  Skipped: MinusCircle,
};

export function StatusBadge({
  status,
  className,
}: {
  status: Status;
  className?: string;
}) {
  const StatusIcon = STATUS_ICONS[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        STATUS_STYLES[status],
        className,
      )}
    >
      <StatusIcon className="h-3 w-3" />
      {status}
    </span>
  );
}

export function PlatformBadge({
  platform,
  className,
}: {
  platform: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border border-border bg-muted/50 px-2 py-0.5 text-[11px] font-medium text-muted-foreground",
        className,
      )}
    >
      {platform}
    </span>
  );
}
