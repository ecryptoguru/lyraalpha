"use client";

import { motion } from "framer-motion";
import { useInViewOnce, kineticVariants } from "./motion/useKineticReveal";
import { Star } from "lucide-react";
import { testimonials, type Testimonial } from "./data/testimonials";

function MarqueeRow({ items, reverse = false }: { items: Testimonial[]; reverse?: boolean }) {
  const doubled = [...items, ...items];
  return (
    <div className={`flex w-max gap-4 py-2 ${reverse ? "animate-[marquee-reverse_30s_linear_infinite]" : "animate-[marquee_30s_linear_infinite]"} hover:[animation-play-state:paused]`}>
      {doubled.map((t, i) => (
        <div key={i} className="w-[320px] shrink-0 rounded-2xl border border-white/8 bg-white/2.5 p-4 backdrop-blur-sm transition-all hover:border-white/12 sm:w-[380px] sm:p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/8 font-mono text-xs font-bold text-white/70">{t.name.charAt(0)}</div>
            <div><p className="text-sm font-semibold text-white/80">{t.name}</p><p className="font-mono text-[10px] text-white/35">{t.role}</p></div>
          </div>
          <div className="mt-2 flex gap-0.5">{[...Array(5)].map((_, j) => <Star key={j} className="h-3 w-3 fill-warning text-warning" />)}</div>
          <p className="mt-2 text-sm leading-6 text-white/50 italic">&ldquo;{t.text}&rdquo;</p>
        </div>
      ))}
    </div>
  );
}

export function SocialProofWall() {
  const { ref, inView } = useInViewOnce({ threshold: 0.1 });
  return (
    <section className="relative overflow-hidden bg-[#040816] py-24 sm:py-28">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_40%_at_50%_60%,rgba(245,158,11,0.04),transparent_65%)]" />
      <div ref={ref} className="relative z-10">
        <motion.div className="mx-auto mb-12 max-w-3xl px-4 text-center sm:px-6" variants={kineticVariants.fadeUp} initial="hidden" animate={inView ? "visible" : "hidden"}>
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.38em] text-warning/70">Trusted by analysts worldwide</p>
          <h2 className="mt-4 text-3xl font-light tracking-[-0.04em] text-white sm:text-5xl">Join <span className="text-warning">the smartest</span> investors.</h2>
        </motion.div>
        <div className="space-y-4">
          <MarqueeRow items={testimonials.slice(0, 3)} />
          <MarqueeRow items={testimonials.slice(3, 6)} reverse />
        </div>
      </div>
    </section>
  );
}
