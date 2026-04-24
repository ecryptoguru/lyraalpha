"use client";

import { useRef } from "react";
import { motion } from "framer-motion";
import { useMagnetic, useReducedMotion } from "../motion/useKineticReveal";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface MagneticCTAProps {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "outline";
  className?: string;
}

export function MagneticCTA({ href, children, variant = "primary", className }: MagneticCTAProps) {
  const ref = useRef<HTMLDivElement>(null);
  const position = useMagnetic(ref, { strength: 0.25 });
  const reduced = useReducedMotion();

  const base =
    variant === "primary"
      ? "relative inline-flex h-14 items-center gap-2.5 rounded-full border border-warning/30 bg-warning px-8 font-bold text-foreground shadow-[0_0_40px_rgba(245,158,11,0.25)] transition-colors duration-300 hover:bg-warning/90 hover:shadow-[0_0_60px_rgba(245,158,11,0.35)]"
      : "relative inline-flex h-14 items-center gap-2.5 rounded-full border border-white/15 bg-white/4 px-8 font-bold text-white/85 backdrop-blur-sm transition-colors duration-300 hover:border-info/35 hover:bg-info/8 hover:text-white";

  return (
    <motion.div
      ref={ref}
      animate={reduced ? {} : { x: position.x, y: position.y }}
      transition={{ type: "spring", stiffness: 150, damping: 15 }}
      className="inline-flex"
    >
      <Link href={href} className={cn(base, className)}>
        {children}
      </Link>
    </motion.div>
  );
}
