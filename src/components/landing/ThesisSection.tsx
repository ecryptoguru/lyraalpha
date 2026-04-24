"use client";

import { motion } from "framer-motion";
import { useInViewOnce, kineticVariants } from "./motion/useKineticReveal";

const theses = [
  {
    num: "01",
    title: "The Synthesis Gap",
    body: "Markets produce infinite signals — prices, flows, sentiment, on-chain activity — but investors still decide in isolation. The bottleneck is never data volume. It is the analytical layer that transforms raw inputs into a coherent conviction framework.",
    accent: "default" as const,
  },
  {
    num: "02",
    title: "Engine-First Architecture",
    body: "LyraAlpha runs proprietary computation engines before any language model speaks. Trend, momentum, volatility, liquidity, sentiment, and trust are scored deterministically. The AI interprets what the engines already computed — it never invents analytical structure.",
    accent: "gold" as const,
  },
  {
    num: "03",
    title: "Auditable Conviction",
    body: "Every score carries provenance. Every signal traces back to its source data, its engine logic, and its confidence band. Generic AI tools sound confident because they are programmed to. LyraAlpha sounds confident because the math underneath is inspectable.",
    accent: "cyan" as const,
  },
];

export function ThesisSection() {
  const { ref, inView } = useInViewOnce({ threshold: 0.2 });

  return (
    <section className="relative bg-[#040816] px-4 py-24 sm:px-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_40%_at_50%_60%,rgba(129,140,248,0.05),transparent_65%)]" />

      <div ref={ref} className="container relative z-10 mx-auto max-w-7xl px-0">
        <motion.div
          className="mx-auto mb-16 max-w-3xl text-center"
          variants={kineticVariants.fadeUp}
          initial="hidden"
          animate={inView ? "visible" : "hidden"}
        >
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.38em] text-warning/70">
            Platform Thesis
          </p>
          <h2 className="mt-4 text-3xl font-light tracking-[-0.04em] text-white sm:text-5xl">
            Built on conviction. <span className="text-warning">Not copy.</span>
          </h2>
        </motion.div>

        <div className="grid gap-4 md:grid-cols-3">
          {theses.map((t, i) => (
            <motion.div
              key={t.num}
              variants={kineticVariants.card}
              initial="hidden"
              animate={inView ? "visible" : "hidden"}
              transition={{ delay: i * 0.12 }}
              className={`group relative overflow-hidden rounded-3xl border p-6 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 sm:p-8 ${
                t.accent === "gold"
                  ? "border-[#FFD700]/20 bg-[#FFD700]/6"
                  : t.accent === "cyan"
                  ? "border-[#00D4FF]/18 bg-[#00D4FF]/5"
                  : "border-white/8 bg-white/2.5"
              }`}
            >
              <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-white/4 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
              <p
                className={`font-mono text-[10px] font-bold uppercase tracking-[0.3em] ${
                  t.accent === "gold" ? "text-[#FFD700]" : t.accent === "cyan" ? "text-[#00D4FF]" : "text-white/50"
                }`}
              >
                {t.num} · {t.title}
              </p>
              <p className="mt-4 text-sm leading-7 text-white/55 sm:text-base">{t.body}</p>
            </motion.div>
          ))}
        </div>

        <motion.div
          variants={kineticVariants.fadeUp}
          initial="hidden"
          animate={inView ? "visible" : "hidden"}
          transition={{ delay: 0.4 }}
          className="relative mt-8 overflow-hidden rounded-2xl border border-warning/15 bg-warning/4 px-6 py-5"
        >
          <div className="pointer-events-none absolute inset-0 bg-linear-to-r from-warning/6 to-transparent" />
          <p className="relative font-mono text-sm leading-7 text-white/60 italic">
            &ldquo;The problem is not access to information. It is the inability to synthesize it into a decision under uncertainty. Every design choice in LyraAlpha traces back to that single constraint.&rdquo;
          </p>
          <p className="mt-2 font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-warning/60">
            LyraAlpha · Core Thesis
          </p>
        </motion.div>
      </div>
    </section>
  );
}
