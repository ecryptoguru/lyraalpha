"use client";

import { useEffect, useRef } from "react";
import { animate, useInView, useMotionValue } from "framer-motion";
import { useReducedMotion } from "../motion/useKineticReveal";

interface AnimatedCounterProps {
  to: number;
  suffix?: string;
  prefix?: string;
  decimals?: number;
  duration?: number;
  className?: string;
}

export function AnimatedCounter({ to, suffix = "", prefix = "", decimals = 0, duration = 1.4, className }: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-20px" });
  const reduced = useReducedMotion();
  const mv = useMotionValue(0);

  useEffect(() => {
    if (!inView) return;
    const el = ref.current;
    if (!el) return;

    const formatter = new Intl.NumberFormat("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });

    if (reduced) {
      el.textContent = `${prefix}${formatter.format(to)}${suffix}`;
      return;
    }

    const controls = animate(mv, to, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => {
        if (el) el.textContent = `${prefix}${formatter.format(v)}${suffix}`;
      },
    });
    return () => controls.stop();
  }, [inView, to, suffix, prefix, decimals, duration, reduced, mv]);

  return <span ref={ref} className={`tabular-nums ${className ?? ""}`}>{prefix}0{suffix}</span>;
}
