"use client";

import { motion, useReducedMotion as useFramerReducedMotion } from "framer-motion";
import { useReducedMotion } from "../motion/useKineticReveal";

interface KineticHeadlineProps {
  lines: string[];
  accents?: number[]; // indices of lines to accent with warning
  className?: string;
  delay?: number;
}

export function KineticHeadline({ lines, accents = [], className = "", delay = 0 }: KineticHeadlineProps) {
  const prefersReduced = useReducedMotion();
  const framerReduced = useFramerReducedMotion();
  const reduced = prefersReduced || framerReduced;

  const container = {
    hidden: {},
    visible: {
      transition: { staggerChildren: 0.05, delayChildren: delay },
    },
  };

  const easeOutExpo: [number, number, number, number] = [0.16, 1, 0.3, 1];
  const wordVariant = {
    hidden: { opacity: 0, y: 24 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.55, ease: easeOutExpo },
    },
  };

  return (
    <motion.h1
      className={`font-display text-[2.4rem] font-extralight leading-[0.92] tracking-[-0.055em] text-white sm:text-[3.6rem] lg:text-[4.4rem] xl:text-[5.2rem] ${className}`}
      variants={container}
      initial={reduced ? false : "hidden"}
      animate="visible"
      aria-label={lines.join(" ")}
    >
      {lines.map((line, i) => {
        const isAccent = accents.includes(i);
        return (
          <span key={i} className="block">
            {line.split(" ").map((word, wi) => (
              <motion.span
                key={wi}
                className={`inline-block mr-[0.25em] ${isAccent ? "text-warning font-thin" : ""}`}
                variants={wordVariant}
                style={{ opacity: reduced ? 1 : undefined }}
              >
                {word}
              </motion.span>
            ))}
          </span>
        );
      })}
    </motion.h1>
  );
}
