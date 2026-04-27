"use client";

import { motion } from "framer-motion";
import { useInViewOnce, kineticVariants } from "./motion/useKineticReveal";
import { ArrowRight } from "lucide-react";

/**
 * NoiseToAlpha — Pillar 2: "Turn Crypto Noise into Actionable Alpha"
 *
 * Visual: Animated transformation diagram
 *  - Left:  chaotic noise (random scattered dots/lines)
 *  - Arrow: processing engine (pulse)
 *  - Right: clean signal (organized data viz)
 *
 * Minimal copy. Visual carries the narrative.
 */

// Reduced from 80→40 dots; cheap modular pattern for deterministic placement
const NOISE_DOTS = Array.from({ length: 40 }, (_, i) => ({
  x: (i * 37) % 100,
  y: (i * 53) % 100,
  delay: (i % 12) * 0.15,
}));

function NoisePanel({ inView }: { inView: boolean }) {
  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-3xl border border-danger/15 bg-danger/4 p-4">
      <p className="absolute left-4 top-4 z-10 font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-danger/70">
        Raw Market Noise
      </p>
      {/* Chaotic dots — only animate when in view to save CPU */}
      <div className="relative h-full w-full" aria-hidden="true">
        {NOISE_DOTS.map((d, i) => (
          <motion.span
            key={i}
            className="absolute h-1 w-1 rounded-full bg-danger/50"
            style={{ left: `${d.x}%`, top: `${d.y}%` }}
            animate={
              inView
                ? { opacity: [0.3, 0.8, 0.3], scale: [1, 1.4, 1] }
                : { opacity: 0.3, scale: 1 }
            }
            transition={{
              duration: 1.5,
              delay: d.delay,
              repeat: inView ? Infinity : 0,
              ease: "easeInOut",
            }}
          />
        ))}
        {/* Chaotic lines */}
        <svg className="absolute inset-0 h-full w-full opacity-30" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <path
            d="M0,50 Q15,20 25,60 T50,40 T75,70 T100,30"
            stroke="rgb(244, 63, 94)"
            strokeWidth="0.3"
            fill="none"
          />
          <path
            d="M0,30 Q20,80 40,20 T70,60 T100,50"
            stroke="rgb(244, 63, 94)"
            strokeWidth="0.3"
            fill="none"
          />
        </svg>
      </div>
      <p className="absolute bottom-4 left-4 right-4 font-mono text-[9px] uppercase tracking-wider text-white/30">
        Headlines · Tweets · Charts · On-chain · Macro
      </p>
    </div>
  );
}

function AlphaPanel({ inView }: { inView: boolean }) {
  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-3xl border border-success/20 bg-success/5 p-4">
      <p className="absolute left-4 top-4 z-10 font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-success/80">
        Actionable Alpha
      </p>
      {/* Clean ascending signal */}
      <div className="relative flex h-full w-full items-center justify-center">
        <svg className="h-3/4 w-full" viewBox="0 0 100 60" preserveAspectRatio="none" aria-hidden="true">
          {/* Grid lines */}
          {[10, 20, 30, 40, 50].map((y) => (
            <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="rgba(255,255,255,0.04)" strokeWidth="0.2" />
          ))}
          {/* Signal area fill */}
          <motion.path
            d="M0,55 L10,50 L20,45 L30,38 L40,42 L50,30 L60,28 L70,20 L80,18 L90,12 L100,8 L100,60 L0,60 Z"
            fill="url(#signalGrad)"
            initial={{ opacity: 0 }}
            animate={{ opacity: inView ? 0.4 : 0 }}
            transition={{ duration: 1.2 }}
          />
          {/* Signal line */}
          <motion.path
            d="M0,55 L10,50 L20,45 L30,38 L40,42 L50,30 L60,28 L70,20 L80,18 L90,12 L100,8"
            stroke="rgb(34, 197, 94)"
            strokeWidth="1.2"
            fill="none"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: inView ? 1 : 0 }}
            transition={{ duration: 2, ease: "easeInOut" }}
          />
          {/* Signal dots */}
          {[10, 30, 50, 70, 90].map((x, i) => {
            const y = [50, 38, 30, 20, 12][i];
            return (
              <motion.circle
                key={x}
                cx={x}
                cy={y}
                r="1.4"
                fill="rgb(34, 197, 94)"
                initial={{ scale: 0 }}
                animate={{ scale: inView ? 1 : 0 }}
                transition={{ delay: 0.3 + i * 0.2, duration: 0.4 }}
              />
            );
          })}
          <defs>
            <linearGradient id="signalGrad" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="rgb(34, 197, 94)" stopOpacity="0.6" />
              <stop offset="100%" stopColor="rgb(34, 197, 94)" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
      </div>
      <p className="absolute bottom-4 left-4 right-4 font-mono text-[9px] uppercase tracking-wider text-success/50">
        Conviction Score · 87 / 100
      </p>
    </div>
  );
}

export function NoiseToAlpha() {
  const { ref, inView } = useInViewOnce({ threshold: 0.2 });

  return (
    <section className="relative bg-[#040816] px-4 py-24 sm:px-6 sm:py-28">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_50%,rgba(34,197,94,0.04),transparent_65%)]" />

      <div ref={ref} className="container relative z-10 mx-auto max-w-6xl px-0">
        <motion.div
          className="mx-auto mb-14 max-w-3xl text-center"
          variants={kineticVariants.fadeUp}
          initial="hidden"
          animate={inView ? "visible" : "hidden"}
        >
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.38em] text-warning/70">
            From noise to clarity
          </p>
          <h2 className="mt-4 text-3xl font-light tracking-[-0.04em] text-white sm:text-5xl">
            Turn Crypto Noise into <span className="text-success">Actionable Alpha.</span>
          </h2>
        </motion.div>

        <motion.div
          className="grid items-center gap-4 md:grid-cols-[1fr_auto_1fr] sm:gap-6"
          variants={kineticVariants.fadeUp}
          initial="hidden"
          animate={inView ? "visible" : "hidden"}
          transition={{ delay: 0.2 }}
        >
          <NoisePanel inView={inView} />
          <div className="flex items-center justify-center gap-3 md:flex-col md:gap-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-warning/30 bg-warning/10">
              {/* Mobile: panels stack vertically → arrow points down. Desktop: side-by-side → arrow points right. */}
              <ArrowRight className="h-5 w-5 rotate-90 text-warning md:hidden" aria-hidden="true" />
              <ArrowRight className="hidden h-5 w-5 text-warning md:block" aria-hidden="true" />
            </div>
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-warning/70 md:text-center">
              6 Engines
            </p>
          </div>
          <AlphaPanel inView={inView} />
        </motion.div>
      </div>
    </section>
  );
}
