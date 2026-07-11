"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface ProgressRingProps {
  value: number; // 0..100
  size?: number;
  strokeWidth?: number;
  label?: string;
  sublabel?: string;
  className?: string;
}

export function ProgressRing({
  value,
  size = 160,
  strokeWidth = 12,
  label,
  sublabel,
  className,
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, value));
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id="ring-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="50%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#a855f7" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={strokeWidth}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#ring-gradient)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.1, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold tabular-nums">
          {Math.round(clamped)}
          <span className="text-lg text-muted-foreground">%</span>
        </span>
        {label && <span className="text-xs font-medium">{label}</span>}
        {sublabel && (
          <span className="text-[11px] text-muted-foreground">{sublabel}</span>
        )}
      </div>
    </div>
  );
}
