"use client";

import * as React from "react";
import {
  motion,
  useInView,
  useReducedMotion,
  animate,
  type Variants,
  type HTMLMotionProps,
} from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Shared Framer Motion primitives. All respect the user's reduced-motion
 * setting (Providers sets MotionConfig reducedMotion="user"; counters and the
 * decorative background check it explicitly).
 */

const EASE = [0.22, 1, 0.36, 1] as const;

/** Scroll-reveal: fades + slides in the first time it enters the viewport. */
export function Reveal({
  children,
  className,
  delay = 0,
  y = 16,
  once = true,
  ...rest
}: HTMLMotionProps<"div"> & { delay?: number; y?: number; once?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, margin: "-60px" }}
      transition={{ duration: 0.6, ease: EASE, delay }}
      className={className}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

const staggerContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};
const staggerItem: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE } },
};

/** Staggered container — pair with <StaggerItem>. */
export function Stagger({
  children,
  className,
  once = true,
}: {
  children: React.ReactNode;
  className?: string;
  once?: boolean;
}) {
  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      whileInView="show"
      viewport={{ once, margin: "-60px" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
  ...rest
}: HTMLMotionProps<"div">) {
  return (
    <motion.div variants={staggerItem} className={className} {...rest}>
      {children}
    </motion.div>
  );
}

/** Subtle hover-lift wrapper for cards. */
export function HoverLift({
  children,
  className,
  ...rest
}: HTMLMotionProps<"div">) {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 300, damping: 22 }}
      className={className}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

/** 3D mouse-follow tilt card (disabled for reduced-motion / touch). */
export function TiltCard({
  children,
  className,
  intensity = 6,
}: {
  children: React.ReactNode;
  className?: string;
  intensity?: number;
}) {
  const reduce = useReducedMotion();
  const ref = React.useRef<HTMLDivElement>(null);
  const [t, setT] = React.useState({ rx: 0, ry: 0 });

  function onMove(e: React.MouseEvent) {
    if (reduce || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    setT({ rx: -py * intensity, ry: px * intensity });
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={() => setT({ rx: 0, ry: 0 })}
      style={{ transformStyle: "preserve-3d", perspective: 800 }}
      animate={{ rotateX: t.rx, rotateY: t.ry }}
      transition={{ type: "spring", stiffness: 200, damping: 18 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/** Counts up from 0 to `value` when scrolled into view. */
export function AnimatedCounter({
  value,
  prefix = "",
  suffix = "",
  decimals = 0,
  duration = 1.5,
  className,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  duration?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const ref = React.useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });

  const format = React.useCallback(
    (v: number) =>
      `${prefix}${v.toLocaleString("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}${suffix}`,
    [prefix, suffix, decimals],
  );

  React.useEffect(() => {
    if (!inView || !ref.current) return;
    if (reduce) {
      ref.current.textContent = format(value);
      return;
    }
    const controls = animate(0, value, {
      duration,
      ease: "easeOut",
      onUpdate: (v) => {
        if (ref.current) ref.current.textContent = format(v);
      },
    });
    return () => controls.stop();
  }, [inView, value, duration, reduce, format]);

  return (
    <span ref={ref} className={className}>
      {format(0)}
    </span>
  );
}

/**
 * Decorative animated mesh/blob background. Purely visual; aria-hidden and
 * static for reduced-motion users. Place inside a `relative` container.
 */
export function GradientBackground({ className }: { className?: string }) {
  const reduce = useReducedMotion();
  const float = (dx: number, dy: number) =>
    reduce
      ? undefined
      : {
          x: [0, dx, 0],
          y: [0, dy, 0],
        };
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 -z-10 overflow-hidden", className)}
    >
      <motion.div
        animate={float(40, -30)}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-primary/25 blur-3xl"
      />
      <motion.div
        animate={float(-50, 30)}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        className="absolute right-0 top-10 h-80 w-80 rounded-full bg-[#14b8a6]/20 blur-3xl"
      />
      <motion.div
        animate={float(30, 40)}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
        className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-[#8b5cf6]/20 blur-3xl"
      />
    </div>
  );
}
