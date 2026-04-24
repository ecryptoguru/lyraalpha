"use client";

import { Cpu, BrainCircuit, ArrowRightLeft } from "lucide-react";
import { motion } from "framer-motion";
import { useInViewOnce, kineticVariants } from "./motion/useKineticReveal";

const steps = [
  {
    title: "The Deterministic Engine",
    body: "DSE Scores, Market Regime, ARCS, and Stress Scenarios are computed before any AI speaks. The model interprets output — it never invents structure.",
    tag: "DSE Scores · Market Regime · ARCS · Stress Scenarios",
    icon: Cpu,
    accent: "warning" as const,
  },
  {
    title: "The AI Agents",
    body: "Lyra handles market intelligence. Myra handles product guidance. Hard architectural boundary between them. Model routing scales with query complexity.",
    tag: "Nano, Mini, Full Routing · Isolated Analysis",
    icon: BrainCircuit,
    accent: "info" as const,
  },
  {
    title: "Premium Workflows",
    body: "Compare Assets, Shock Simulator, and Portfolio Intelligence are repeatable routines built on computed signals — not generic chat.",
    tag: "Compare Assets · Shock Simulator · Portfolio Intelligence",
    icon: ArrowRightLeft,
    accent: "default" as const,
  },
];

export function HowItWorksV2() {
  const { ref, inView } = useInViewOnce({ threshold: 0.15 });

  return (
    <section id="how-it-works" className="relative bg-[#040816] px-4 py-24 sm:px-6 sm:py-28">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_40%_at_50%_60%,rgba(129,140,248,0.05),transparent_65%)]" />

      <div ref={ref} className="container relative z-10 mx-auto max-w-7xl px-0">
        <motion.div className="mx-auto mb-16 max-w-3xl text-center" variants={kineticVariants.fadeUp} initial="hidden" animate={inView ? "visible" : "hidden"}>
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.38em] text-warning/70">
            Three distinct layers
          </p>
          <h2 className="mt-4 text-3xl font-black tracking-[-0.05em] text-white sm:text-5xl">
            Computation ›› Intelligence ›› Workflows.
          </h2>
        </motion.div>

        <div className="grid gap-6 md:grid-cols-3">
          {steps.map((step, i) => {
            const Icon = step.icon;
            const isLast = i === steps.length - 1;
            return (
              <motion.div
                key={step.title}
                variants={kineticVariants.card}
                initial="hidden"
                animate={inView ? "visible" : "hidden"}
                transition={{ delay: i * 0.15 }}
                className="group relative"
              >
                <div
                  className={`relative overflow-hidden rounded-[2.3rem] border border-white/8 p-6 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 sm:p-8 ${
                    step.accent === "warning"
                      ? "shadow-[8px_8px_24px_rgba(0,0,0,0.45),-4px_-4px_16px_rgba(255,255,255,0.03)]"
                      : step.accent === "info"
                      ? "shadow-[8px_8px_24px_rgba(0,0,0,0.45),-4px_-4px_16px_rgba(255,255,255,0.03)]"
                      : "shadow-[8px_8px_24px_rgba(0,0,0,0.45),-4px_-4px_16px_rgba(255,255,255,0.03)]"
                  }`}
                >
                  <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-white/4 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

                  <div className="relative z-10 flex items-center gap-4">
                    <div
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[1.35rem] border transition-transform duration-300 group-hover:scale-105 ${
                        step.accent === "warning"
                          ? "border-warning/20 bg-warning/10 text-warning"
                          : step.accent === "info"
                          ? "border-info/20 bg-info/10 text-info"
                          : "border-white/10 bg-white/5 text-white/60"
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.35em] text-white/36">
                        Step 0{i + 1}
                      </p>
                    </div>
                  </div>

                  <h3 className="relative z-10 mt-6 text-xl font-bold tracking-tight text-white sm:text-[1.75rem]">
                    {step.title}
                  </h3>
                  <p className="relative z-10 mt-3 text-sm leading-7 text-white/55 sm:text-base">
                    {step.body}
                  </p>
                  {step.tag && (
                    <p className="relative z-10 mt-3 font-mono text-[10px] leading-5 text-white/28">
                      {step.tag}
                    </p>
                  )}
                </div>

                {/* Connector arrow on desktop */}
                {!isLast && (
                  <div className="pointer-events-none absolute -right-3 top-1/2 hidden -translate-y-1/2 md:block">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-white/15">
                      <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
