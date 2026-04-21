"use client";

import { motion } from "framer-motion";
import { staggerContainer, staggerChild } from "@/lib/motion";
import type { ReactNode } from "react";

interface StaggerEntryProps {
  children: ReactNode;
  className?: string;
  /** Stagger delay between children in ms. Default: 40 */
  staggerMs?: number;
}

/**
 * Wraps children in a stagger animation container.
 * Each direct child gets a fade-up entrance with a stagger delay.
 * Use this to coordinate card entry animations on dashboard pages.
 */
export function StaggerEntry({ children, className, staggerMs = 40 }: StaggerEntryProps) {
  return (
    <motion.div
      className={className}
      variants={staggerContainer(staggerMs)}
      initial="hidden"
      animate="visible"
    >
      {children}
    </motion.div>
  );
}

/**
 * Wrap each card/section with this to participate in the stagger.
 */
export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div className={className} variants={staggerChild}>
      {children}
    </motion.div>
  );
}
