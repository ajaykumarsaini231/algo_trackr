"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface PinInputProps {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  disabled?: boolean;
  autoFocus?: boolean;
  onComplete?: (value: string) => void;
  masked?: boolean;
}

/** OTP-style numeric input for the 8-digit admin key. */
export function PinInput({
  value,
  onChange,
  length = 8,
  disabled,
  autoFocus,
  onComplete,
  masked = true,
}: PinInputProps) {
  const refs = React.useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.split("").slice(0, length);

  React.useEffect(() => {
    if (autoFocus) refs.current[0]?.focus();
  }, [autoFocus]);

  function setAt(index: number, digit: string) {
    const chars = value.split("");
    chars[index] = digit;
    const next = chars.join("").slice(0, length);
    onChange(next);
    if (next.length === length && !next.includes("") && onComplete) {
      onComplete(next);
    }
  }

  function handleChange(index: number, raw: string) {
    const digit = raw.replace(/\D/g, "").slice(-1);
    if (!digit) return;
    setAt(index, digit);
    if (index < length - 1) refs.current[index + 1]?.focus();
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      e.preventDefault();
      if (digits[index]) {
        setAt(index, "");
      } else if (index > 0) {
        refs.current[index - 1]?.focus();
        setAt(index - 1, "");
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      refs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < length - 1) {
      refs.current[index + 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (!pasted) return;
    onChange(pasted);
    const focusIdx = Math.min(pasted.length, length - 1);
    refs.current[focusIdx]?.focus();
    if (pasted.length === length && onComplete) onComplete(pasted);
  }

  return (
    <div className="flex justify-center gap-2" onPaste={handlePaste}>
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type={masked ? "password" : "text"}
          inputMode="numeric"
          autoComplete="off"
          maxLength={1}
          disabled={disabled}
          value={digits[i] ?? ""}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onFocus={(e) => e.target.select()}
          className={cn(
            "h-12 w-10 rounded-lg border border-input bg-background text-center text-lg font-bold shadow-sm outline-none transition-all sm:h-14 sm:w-12",
            "focus:border-primary focus:ring-2 focus:ring-ring/40",
            digits[i] && "border-primary/50 bg-primary/5",
            disabled && "cursor-not-allowed opacity-50",
          )}
        />
      ))}
    </div>
  );
}
