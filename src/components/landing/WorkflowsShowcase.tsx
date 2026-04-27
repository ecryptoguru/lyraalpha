"use client";

import { motion } from "framer-motion";
import { useInViewOnce, kineticVariants } from "./motion/useKineticReveal";
import { ArrowRight, Zap, Activity, Target } from "lucide-react";
import Link from "next/link";

/**
 * WorkflowsShowcase — Pillar 5: "Stop Researching. Start Executing."
 *
 * Three concrete workflows with mini-visual previews.
 * Goal: show, don't tell.
 */

const workflows = [
  {
    icon: Zap,
    title: "Compare Assets",
    desc: "Side-by-side conviction scoring across 4 tickers in seconds.",
    accent: "warning",
    preview: (
      <div className="flex items-end gap-2">
        {[
          { label: "BTC", h: 78, color: "rgb(247, 147, 26)" },
          { label: "ETH", h: 65, color: "rgb(98, 126, 234)" },
          { label: "SOL", h: 82, color: "rgb(20, 241, 149)" },
          { label: "AVAX", h: 54, color: "rgb(232, 65, 66)" },
        ].map((b, i) => (
          <motion.div
            key={b.label}
            className="flex flex-1 flex-col items-center gap-1"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + i * 0.1 }}
          >
            <motion.div
              className="w-full rounded-t-md"
              style={{ background: b.color, height: `${b.h}%`, minHeight: "12px" }}
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ delay: 0.3 + i * 0.1, duration: 0.6, ease: "easeOut" }}
              data-h={b.h}
            />
            <p className="font-mono text-[9px] text-white/40">{b.label}</p>
          </motion.div>
        ))}
      </div>
    ),
  },
  {
    icon: Activity,
    title: "Shock Simulator",
    desc: "Replay 2022 drawdowns or Fed shocks against your portfolio.",
    accent: "info",
    preview: (
      <svg className="h-full w-full" viewBox="0 0 100 50" preserveAspectRatio="none">
        <defs>
          <linearGradient id="shockGrad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="rgb(34, 211, 238)" stopOpacity="0.4" />
            <stop offset="100%" stopColor="rgb(34, 211, 238)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <motion.path
          d="M0,15 L20,18 L30,12 L45,40 L60,35 L75,42 L100,30 L100,50 L0,50 Z"
          fill="url(#shockGrad)"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
        />
        <motion.path
          d="M0,15 L20,18 L30,12 L45,40 L60,35 L75,42 L100,30"
          stroke="rgb(34, 211, 238)"
          strokeWidth="1"
          fill="none"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.4, ease: "easeOut" }}
        />
        <motion.line
          x1="45"
          y1="0"
          x2="45"
          y2="50"
          stroke="rgb(244, 63, 94)"
          strokeWidth="0.5"
          strokeDasharray="2 2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.7 }}
          transition={{ delay: 1.2 }}
        />
      </svg>
    ),
  },
  {
    icon: Target,
    title: "Portfolio Intelligence",
    desc: "Health score, drift detection, and AI-driven rebalancing in one view.",
    accent: "success",
    preview: (
      <div className="flex h-full items-center justify-center">
        <svg width="100" height="100" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
          <motion.circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke="rgb(34, 197, 94)"
            strokeWidth="6"
            strokeDasharray="251.2"
            strokeLinecap="round"
            transform="rotate(-90 50 50)"
            initial={{ strokeDashoffset: 251.2 }}
            animate={{ strokeDashoffset: 251.2 * (1 - 0.78) }}
            transition={{ duration: 1.6, ease: "easeOut" }}
          />
          <text x="50" y="48" textAnchor="middle" className="fill-white font-mono text-2xl font-bold">
            78
          </text>
          <text x="50" y="62" textAnchor="middle" className="fill-white/40 font-mono text-[9px] uppercase tracking-wider">
            Health
          </text>
        </svg>
      </div>
    ),
  },
];

export function WorkflowsShowcase() {
  const { ref, inView } = useInViewOnce({ threshold: 0.1 });

  return (
    <section className="relative bg-[#040816] px-4 py-24 sm:px-6 sm:py-28">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_40%_at_50%_60%,rgba(129,140,248,0.04),transparent_65%)]" />

      <div ref={ref} className="container relative z-10 mx-auto max-w-7xl px-0">
        <motion.div
          className="mx-auto mb-14 max-w-3xl text-center"
          variants={kineticVariants.fadeUp}
          initial="hidden"
          animate={inView ? "visible" : "hidden"}
        >
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.38em] text-warning/70">
            Built for execution
          </p>
          <h2 className="mt-4 text-3xl font-light tracking-[-0.04em] text-white sm:text-5xl">
            Stop researching. <span className="text-warning">Start executing.</span>
          </h2>
        </motion.div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {workflows.map((w, i) => {
            const Icon = w.icon;
            const accentClass =
              w.accent === "warning"
                ? "border-warning/20 bg-warning/8 text-warning"
                : w.accent === "info"
                ? "border-info/20 bg-info/8 text-info"
                : "border-success/20 bg-success/8 text-success";
            return (
              <motion.div
                key={w.title}
                variants={kineticVariants.card}
                initial="hidden"
                animate={inView ? "visible" : "hidden"}
                transition={{ delay: i * 0.12 }}
                className="group relative overflow-hidden rounded-3xl border border-white/8 bg-white/2.5 p-6 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-white/14 sm:p-7"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-xl border transition-transform duration-300 group-hover:scale-105 ${accentClass}`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <h3 className="text-lg font-bold tracking-tight text-white">{w.title}</h3>
                </div>

                {/* Preview viz */}
                <div className="mt-5 h-32 w-full">{w.preview}</div>

                <p className="mt-5 text-sm leading-6 text-white/55">{w.desc}</p>
              </motion.div>
            );
          })}
        </div>

        <motion.div
          className="mt-10 flex items-center justify-center"
          variants={kineticVariants.fadeUp}
          initial="hidden"
          animate={inView ? "visible" : "hidden"}
          transition={{ delay: 0.5 }}
        >
          <Link
            href="/tools"
            className="group inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition-all hover:border-warning/30 hover:bg-warning/8 hover:text-warning"
          >
            Try Free Tools
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
