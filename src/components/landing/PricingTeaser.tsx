"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ArrowRight, Sparkles } from "lucide-react";
import { useInViewOnce, kineticVariants } from "./motion/useKineticReveal";
import Link from "next/link";
import { pricingPlans as plans } from "./data/pricing-teaser";

export function PricingTeaser() {
  const [annual, setAnnual] = useState(true);
  const { ref, inView } = useInViewOnce({ threshold: 0.1 });

  return (
    <section className="relative bg-[#040816] px-4 py-24 sm:px-6 sm:py-28">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_40%_at_50%_60%,rgba(245,158,11,0.04),transparent_65%)]" />
      <div ref={ref} className="container relative z-10 mx-auto max-w-7xl px-0">
        <motion.div className="mx-auto mb-12 max-w-3xl text-center" variants={kineticVariants.fadeUp} initial="hidden" animate={inView ? "visible" : "hidden"}>
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.38em] text-warning/70">Pricing</p>
          <h2 className="mt-4 text-3xl font-light tracking-[-0.04em] text-white sm:text-5xl">Invest in <span className="text-warning">intelligence.</span></h2>
          <div className="mt-6 inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/3 p-1 backdrop-blur-sm">
            <button onClick={() => setAnnual(true)} className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-all ${annual ? "bg-warning text-foreground" : "text-white/50 hover:text-white"}`}>Annual</button>
            <button onClick={() => setAnnual(false)} className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-all ${!annual ? "bg-warning text-foreground" : "text-white/50 hover:text-white"}`}>Monthly</button>
          </div>
          {annual && <p className="mt-2 font-mono text-[10px] text-warning/60">Save up to 20% with annual billing</p>}
        </motion.div>

        <div className="grid gap-4 md:grid-cols-3">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              variants={kineticVariants.card}
              initial="hidden"
              animate={inView ? "visible" : "hidden"}
              transition={{ delay: i * 0.12 }}
              className={`relative overflow-hidden rounded-3xl border p-6 backdrop-blur-sm sm:p-8 ${
                plan.popular
                  ? "border-warning/30 bg-warning/5 shadow-[0_0_60px_rgba(245,158,11,0.08)]"
                  : "border-white/8 bg-white/2.5"
              }`}
            >
              {plan.popular && (
                <div className="absolute right-0 top-0 flex items-center gap-1.5 rounded-bl-xl rounded-tr-3xl bg-warning px-3 py-1.5">
                  <Sparkles className="h-3 w-3 text-foreground" /><span className="font-mono text-[9px] font-bold uppercase tracking-wide text-foreground">Most Popular</span>
                </div>
              )}
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-white/40">{plan.name}</p>
              <AnimatePresence mode="wait">
                <motion.div key={annual ? "a" : "m"} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2 }}>
                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="text-4xl font-extrabold tracking-tight text-white">${annual ? plan.annualPrice : plan.monthlyPrice}</span>
                    <span className="font-mono text-sm text-white/35">/mo</span>
                  </div>
                  {annual && plan.monthlyPrice > 0 && <p className="font-mono text-[10px] text-white/25 line-through">${plan.monthlyPrice}/mo monthly</p>}
                </motion.div>
              </AnimatePresence>
              <p className="mt-2 text-sm text-white/45">{plan.desc}</p>
              <ul className="mt-5 space-y-2.5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${plan.popular ? "text-warning" : "text-info"}`} />
                    <span className="text-sm text-white/55">{f}</span>
                  </li>
                ))}
              </ul>
              <Link href="/sign-up" className={`mt-6 flex items-center justify-center gap-2 rounded-xl border py-3 font-mono text-sm font-bold transition-all ${
                plan.popular
                  ? "border-warning/30 bg-warning/15 text-warning hover:bg-warning/25"
                  : "border-white/10 bg-white/5 text-white hover:bg-white/10"
              }`}>
                {plan.cta}<ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
