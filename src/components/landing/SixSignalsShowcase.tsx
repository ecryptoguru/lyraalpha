"use client";

import { motion } from "framer-motion";
import { useInViewOnce, kineticVariants } from "./motion/useKineticReveal";
import { TrendingUp, Activity, Shield, Zap, Brain, BarChart3 } from "lucide-react";

const signals = [
  { label: "Trend", value: 78, max: 100, color: "info", icon: TrendingUp, desc: "Directional strength" },
  { label: "Volatility", value: 42, max: 100, color: "warning", icon: Activity, desc: "Regime risk" },
  { label: "Liquidity", value: 65, max: 100, color: "info", icon: Zap, desc: "Order book depth" },
  { label: "Sentiment", value: 71, max: 100, color: "warning", icon: Brain, desc: "On-chain & social" },
  { label: "Momentum", value: 68, max: 100, color: "info", icon: BarChart3, desc: "RSI · MACD cross" },
  { label: "Trust", value: 82, max: 100, color: "success", icon: Shield, desc: "Network health" },
];

function RadialGauge({ value, max, color, label, icon: Icon, desc }: typeof signals[0] & { inView: boolean }) {
  const pct = (value / max) * 100;
  const circum = 2 * Math.PI * 36;
  const dash = (pct / 100) * circum;
  const colorClass = color === "info" ? "text-info" : color === "warning" ? "text-warning" : "text-success";

  return (
    <motion.div
      variants={kineticVariants.card}
      initial="hidden"
      animate="visible"
      className="group relative overflow-hidden rounded-2xl border border-white/8 bg-white/2.5 p-5 backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:border-white/12"
    >
      <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-white/4 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
      <div className="relative flex items-start gap-4">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${colorClass} bg-current/10`}>
          <Icon className={`h-4 w-4 ${colorClass}`} />
        </div>
        <div className="min-w-0">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-white/40">{label}</p>
          <p className="mt-1 text-sm leading-6 text-white/55">{desc}</p>
        </div>
      </div>
      <div className="mt-5 flex items-center gap-4">
        <svg width="72" height="72" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r="36" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
          <circle cx="40" cy="40" r="36" fill="none" stroke="currentColor" strokeWidth="6"
            strokeDasharray={`${dash} ${circum - dash}`} strokeDashoffset={circum / 4}
            strokeLinecap="round" className={colorClass} style={{ transition: "stroke-dasharray 1.2s ease-out" }} />
        </svg>
        <div>
          <p className={`font-mono text-3xl font-bold tracking-tight ${colorClass}`}>{value}</p>
          <p className="font-mono text-[10px] text-white/30">/ {max}</p>
        </div>
      </div>
    </motion.div>
  );
}

export function SixSignalsShowcase() {
  const { ref, inView } = useInViewOnce({ threshold: 0.1 });
  return (
    <section className="relative bg-[#040816] px-4 py-24 sm:px-6 sm:py-28">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_40%_at_50%_60%,rgba(245,158,11,0.04),transparent_65%)]" />
      <div ref={ref} className="container relative z-10 mx-auto max-w-7xl px-0">
        <motion.div className="mx-auto mb-14 max-w-3xl text-center" variants={kineticVariants.fadeUp} initial="hidden" animate={inView ? "visible" : "hidden"}>
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.38em] text-warning/70">Six engines · One framework</p>
          <h2 className="mt-4 text-3xl font-light tracking-[-0.04em] text-white sm:text-5xl">Your AI <span className="text-warning">edge in crypto markets.</span></h2>
        </motion.div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {signals.map((s) => (
            <RadialGauge key={s.label} {...s} inView={inView} />
          ))}
        </div>
      </div>
    </section>
  );
}
