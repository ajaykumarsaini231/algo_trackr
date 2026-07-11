import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        outline: "text-foreground border-border",
        muted: "border-transparent bg-muted text-muted-foreground",
        success:
          "border-emerald-500/25 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
        warning:
          "border-amber-500/25 bg-amber-500/15 text-amber-600 dark:text-amber-400",
        destructive:
          "border-rose-500/25 bg-rose-500/15 text-rose-600 dark:text-rose-400",
        info: "border-blue-500/25 bg-blue-500/15 text-blue-600 dark:text-blue-400",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
