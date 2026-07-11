import { cn } from "@/lib/utils";

const COLORS = [
  "from-orange-500 to-amber-500",
  "from-blue-500 to-cyan-500",
  "from-violet-500 to-purple-500",
  "from-emerald-500 to-teal-500",
  "from-rose-500 to-pink-500",
  "from-indigo-500 to-blue-500",
  "from-red-500 to-orange-500",
  "from-fuchsia-500 to-pink-500",
];

function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h << 5) - h + str.charCodeAt(i);
  return Math.abs(h);
}

function initials(name: string): string {
  const parts = name.replace(/[^a-zA-Z0-9 ]/g, "").split(" ").filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
}

export function CompanyAvatar({
  name,
  size = 40,
  className,
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const color = COLORS[hash(name) % COLORS.length];
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br font-bold text-white shadow-sm",
        color,
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {initials(name)}
    </div>
  );
}
