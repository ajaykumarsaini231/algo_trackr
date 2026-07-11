import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * DSAspire logo — inline SVG so it renders instantly (no network request,
 * no layout shift). The mark is a three-node graph: apex + left node in
 * brand blue, right node in teal, joined by edges with a blue→teal gradient
 * and a dotted "progress" trail. Colors are fixed brand values chosen to
 * read on both light and dark surfaces. Keep in sync with public/logo.svg.
 */
export const BRAND_BLUE = "#2563eb";
export const BRAND_BLUE_DEEP = "#1d4ed8";
export const TEAL = "#14b8a6";

export function LogoMark({
  className,
  ...props
}: React.SVGProps<SVGSVGElement>) {
  const gid = React.useId();
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <defs>
        <linearGradient id={`${gid}-edge`} x1="60" y1="26" x2="102" y2="96" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={BRAND_BLUE} />
          <stop offset="1" stopColor={TEAL} />
        </linearGradient>
      </defs>
      {/* edges: apex → base-left (blue), apex → base-right (blue→teal) */}
      <path d="M54 38 L26 84" stroke={BRAND_BLUE} strokeWidth="7" strokeLinecap="round" />
      <path d="M66 38 L94 84" stroke={`url(#${gid}-edge)`} strokeWidth="7" strokeLinecap="round" />
      {/* nodes */}
      <circle cx="60" cy="27" r="11" stroke={BRAND_BLUE} strokeWidth="7" />
      <circle cx="19" cy="95" r="11" stroke={BRAND_BLUE} strokeWidth="7" />
      <circle cx="101" cy="95" r="11" stroke={TEAL} strokeWidth="7" />
      {/* progress trail fading blue → teal */}
      <circle cx="44" cy="88" r="3.2" fill={BRAND_BLUE} />
      <circle cx="57" cy="81" r="3.8" fill="#0d9488" />
      <circle cx="70" cy="74" r="4.4" fill={TEAL} />
    </svg>
  );
}

/** Full lockup: mark + two-tone "DSAspire" wordmark. */
export function Logo({
  className,
  markClassName,
  showSubtitle = false,
}: {
  className?: string;
  markClassName?: string;
  showSubtitle?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark className={cn("h-9 w-9 shrink-0", markClassName)} />
      <span className="leading-tight">
        <span className="block text-lg font-bold tracking-tight">
          <span className="text-[#1d4ed8] dark:text-[#5b8bf7]">DSA</span>
          <span style={{ color: TEAL }}>spire</span>
        </span>
        {showSubtitle && (
          <span className="block text-[11px] text-muted-foreground">
            DSA Tracker
          </span>
        )}
      </span>
    </span>
  );
}
