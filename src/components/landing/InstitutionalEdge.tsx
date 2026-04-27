"use client";

import { motion } from "framer-motion";
import { useInViewOnce, kineticVariants } from "./motion/useKineticReveal";
import { Briefcase, BarChart3, Eye } from "lucide-react";

/**
 * InstitutionalEdge — Pillar 3: "Think Like a Fund. Trade Like an Insider."
 *
 * Side-by-side comparison: Retail vs LyraAlpha
 * Each row = a capability gap that retail tools don't have.
 */

const comparisons = [
  {
    icon: Briefcase,
    capability: "Portfolio Stress Testing",
    retail: "Static spreadsheet",
    lyra: "Monte Carlo across 10k regimes",
  },
  {
    icon: BarChart3,
    capability: "Multi-Asset Regime Analysis",
    retail: "Single-asset charts",
    lyra: "Cross-asset correlation matrix",
  },
  {
    icon: Eye,
    capability: "On-Chain Intelligence",
    retail: "Basic whale alerts",
    lyra: "Liquidity, flow, & cohort tracking",
  },
];

export function InstitutionalEdge() {
  const { ref, inView } = useInViewOnce({ threshold: 0.15 });

  return (
    <section id="how-it-works" className="relative bg-[#040816] px-4 py-24 sm:px-6 sm:py-28">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_40%_at_50%_60%,rgba(245,158,11,0.05),transparent_65%)]" />

      <div ref={ref} className="container relative z-10 mx-auto max-w-6xl px-0">
        <motion.div
          className="mx-auto mb-14 max-w-3xl text-center"
          variants={kineticVariants.fadeUp}
          initial="hidden"
          animate={inView ? "visible" : "hidden"}
        >
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.38em] text-warning/70">
            The institutional edge
          </p>
          <h2 className="mt-4 text-3xl font-light tracking-[-0.04em] text-white sm:text-5xl">
            Think like a fund. <span className="text-warning">Trade like an insider.</span>
          </h2>
        </motion.div>

        <div className="overflow-hidden rounded-[2.4rem] border border-white/8 bg-white/2.5 backdrop-blur-sm">
          {/* Header row — hidden on mobile, shown on sm+ */}
          <div className="hidden grid-cols-[1.4fr_1fr_1.4fr] border-b border-white/8 px-4 py-4 sm:grid sm:px-8">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-white/40">
              Capability
            </p>
            <p className="text-center font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-white/30">
              Retail tools
            </p>
            <p className="text-right font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-warning/80">
              LyraAlpha
            </p>
          </div>

          {comparisons.map((row, i) => {
            const Icon = row.icon;
            return (
              <motion.div
                key={row.capability}
                variants={kineticVariants.fadeUp}
                initial="hidden"
                animate={inView ? "visible" : "hidden"}
                transition={{ delay: 0.15 + i * 0.1 }}
                className="border-b border-white/5 px-5 py-5 last:border-b-0 sm:grid sm:grid-cols-[1.4fr_1fr_1.4fr] sm:items-center sm:px-8 sm:py-7"
              >
                {/* Capability + icon */}
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-warning/20 bg-warning/8 text-warning">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <p className="text-sm font-semibold text-white sm:text-base">{row.capability}</p>
                </div>

                {/* Mobile: labelled rows. Desktop: align center/right within grid. */}
                <div className="mt-4 flex items-baseline justify-between gap-3 sm:mt-0 sm:contents">
                  <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/30 sm:hidden">
                    Retail
                  </p>
                  <p className="font-mono text-[12px] text-white/45 sm:text-center sm:text-xs sm:text-white/30">
                    {row.retail}
                  </p>
                </div>
                <div className="mt-2 flex items-baseline justify-between gap-3 sm:mt-0 sm:contents">
                  <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-warning/60 sm:hidden">
                    LyraAlpha
                  </p>
                  <p className="text-sm font-semibold text-warning sm:text-right sm:text-base">
                    {row.lyra}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
