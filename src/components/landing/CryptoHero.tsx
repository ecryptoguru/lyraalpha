"use client";

import { useRef } from "react";
import dynamic from "next/dynamic";
import { ArrowRight, Shield, Sparkles } from "lucide-react";
import { KineticHeadline } from "./hero/KineticHeadline";
import { MagneticCTA } from "./hero/MagneticCTA";
import { useLandingScrollParallax } from "./hero/useLandingScroll";

const CryptoLatticeScene = dynamic(
  () => import("./hero/CryptoLatticeScene").then((m) => ({ default: m.CryptoLatticeScene })),
  { ssr: false, loading: () => null }
);

export function CryptoHero() {
  const sectionRef = useRef<HTMLElement>(null);
  const contentRef = useLandingScrollParallax({ translateY: -80, opacityStart: 0.6 });

  return (
    <section
      ref={sectionRef}
      className="relative min-h-screen w-full overflow-hidden bg-[#040816]"
    >
      {/* Fallback gradient — always renders before WebGL chunk loads */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_45%,rgba(247,147,26,0.10),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_50%,rgba(34,211,238,0.08),transparent_55%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,8,22,0)_55%,rgba(4,8,22,1)_100%)]" />
      </div>

      <CryptoLatticeScene />

      {/* Content */}
      <div
        ref={contentRef}
        className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 pb-24 pt-28 sm:px-6"
      >
        <div className="mx-auto w-full max-w-5xl text-center">
          {/* Eyebrow */}
          <div className="flex flex-wrap items-center justify-center gap-2.5">
            <span className="inline-flex items-center gap-2 rounded-full border border-warning/25 bg-warning/8 px-3.5 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-warning">
              <Sparkles className="h-3 w-3" />
              Beta · Free ELITE Access
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-info/20 bg-info/6 px-3.5 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-info/80">
              <Shield className="h-3 w-3" />
              No Hallucinated Metrics
            </span>
          </div>

          {/* Headline — Pillar 1 */}
          <KineticHeadline
            lines={["Institutional", "Crypto Intelligence.", "Retail Pricing."]}
            accents={[2]}
            delay={0.1}
            className="mt-8"
          />

          {/* Sub copy — single sentence */}
          <p className="mx-auto mt-7 max-w-2xl text-base leading-8 text-white/65 sm:text-lg">
            Six engines compute crypto signals. AI interprets them.
            <br className="hidden sm:block" />
            <span className="text-warning"> Trade with conviction — not vibes.</span>
          </p>

          {/* CTAs */}
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            <MagneticCTA href="/sign-up" variant="primary">
              Start Free
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </MagneticCTA>
            <MagneticCTA href="#how-it-works" variant="outline">
              See How It Works
            </MagneticCTA>
          </div>

          <p className="mt-5 font-mono text-[10px] tracking-wide text-white/35">
            300 credits · No credit card · 2-min setup
          </p>
        </div>
      </div>

      {/* Bottom fade */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-linear-to-t from-[#040816] to-transparent" />
    </section>
  );
}
