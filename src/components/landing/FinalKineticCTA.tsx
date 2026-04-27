"use client";

import { motion } from "framer-motion";
import { ArrowRight, Shield, Zap, Clock } from "lucide-react";
import { useInViewOnce, kineticVariants } from "./motion/useKineticReveal";
import { MagneticCTA } from "./hero/MagneticCTA";

export function FinalKineticCTA() {
  const { ref, inView } = useInViewOnce({ threshold: 0.2 });

  return (
    <section className="relative overflow-hidden bg-[#040816] px-4 py-24 sm:px-6 sm:py-32">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_50%,rgba(245,158,11,0.06),transparent_60%)]" />
      <div ref={ref} className="container relative z-10 mx-auto max-w-4xl px-0 text-center">
        <motion.div variants={kineticVariants.fadeUp} initial="hidden" animate={inView ? "visible" : "hidden"}>
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.38em] text-warning/70">Ready to decode the market?</p>
          <h2 className="mt-6 text-4xl font-extralight leading-tight tracking-[-0.04em] text-white sm:text-6xl lg:text-7xl">
            Stop researching.<br />
            <span className="text-warning">Start executing.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-xl font-mono text-sm leading-7 text-white/45">
            Free Beta access. ELITE plan. 300 credits. No card required.
          </p>
        </motion.div>

        <motion.div variants={kineticVariants.fadeUp} initial="hidden" animate={inView ? "visible" : "hidden"} transition={{ delay: 0.2 }} className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <MagneticCTA href="/sign-up" variant="primary">
            Sign Up Free<ArrowRight className="h-4 w-4" />
          </MagneticCTA>
          <MagneticCTA href="/pricing" variant="outline">
            View Full Pricing
          </MagneticCTA>
        </motion.div>

        <motion.div variants={kineticVariants.fadeUp} initial="hidden" animate={inView ? "visible" : "hidden"} transition={{ delay: 0.3 }} className="mt-8 flex flex-wrap items-center justify-center gap-6">
          {[{ icon: Shield, text: "SOC 2 Compliant" }, { icon: Zap, text: "99.9% Uptime SLA" }, { icon: Clock, text: "2-min Setup" }].map((item) => (
            <div key={item.text} className="flex items-center gap-2 font-mono text-[10px] text-white/30">
              <item.icon className="h-3.5 w-3.5" />{item.text}
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
