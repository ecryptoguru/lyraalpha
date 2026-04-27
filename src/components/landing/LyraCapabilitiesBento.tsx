"use client";

import { motion } from "framer-motion";
import { useInViewOnce, kineticVariants } from "./motion/useKineticReveal";
import { Brain, BarChart3, Shield, Zap, Globe, Layers } from "lucide-react";

const tiles = [
  { title: "Dual-Agent AI", body: "Lyra reads markets. Myra guides the product. No hallucinations.", icon: Brain, span: "col-span-1 row-span-1" },
  { title: "Cross-Asset", body: "BTC · ETH · SOL · DeFi · macro equities — one regime lens.", icon: Globe, span: "col-span-1 sm:col-span-2 row-span-1" },
  { title: "Portfolio Health", body: "Drift detection, shock simulation, allocation signals.", icon: BarChart3, span: "col-span-1 row-span-1" },
  { title: "On-Chain Flows", body: "Wallet flows, DeFi yields, staking, macro shifts — unified.", icon: Layers, span: "col-span-1 row-span-1" },
  { title: "Auditable Trust", body: "Every score computable. Every signal traceable. No black boxes.", icon: Shield, span: "col-span-1 sm:col-span-2 row-span-1" },
  { title: "Pro Workflows", body: "Compare · simulate · rebalance — without the noise.", icon: Zap, span: "col-span-1 row-span-1" },
];

export function LyraCapabilitiesBento() {
  const { ref, inView } = useInViewOnce({ threshold: 0.1 });
  return (
    <section className="relative bg-[#040816] px-4 py-24 sm:px-6 sm:py-28">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_40%_at_50%_60%,rgba(129,140,248,0.04),transparent_65%)]" />
      <div ref={ref} className="container relative z-10 mx-auto max-w-7xl px-0">
        <motion.div className="mx-auto mb-14 max-w-3xl text-center" variants={kineticVariants.fadeUp} initial="hidden" animate={inView ? "visible" : "hidden"}>
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.38em] text-info/70">One platform · Six capabilities</p>
          <h2 className="mt-4 text-3xl font-light tracking-[-0.04em] text-white sm:text-5xl">Everything you need. <span className="text-info">Nothing you don&apos;t.</span></h2>
        </motion.div>
        <div className="grid auto-rows-[minmax(140px,auto)] grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tiles.map((t, i) => {
            const Icon = t.icon;
            return (
              <motion.div
                key={t.title}
                variants={kineticVariants.card}
                initial="hidden"
                animate={inView ? "visible" : "hidden"}
                transition={{ delay: i * 0.08 }}
                className={`group relative overflow-hidden rounded-2xl border border-white/8 bg-white/2.5 p-5 backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-white/12 sm:p-6 ${t.span}`}
              >
                <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-white/4 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                <div className="relative flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-info/20 bg-info/8 text-info">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-white/40">{t.title}</p>
                    <p className="mt-1.5 text-sm leading-6 text-white/55">{t.body}</p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
