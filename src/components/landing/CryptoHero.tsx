"use client";

import { useRef } from "react";
import dynamic from "next/dynamic";
import { TrendingUp, Activity, ArrowRight, Zap } from "lucide-react";
import { KineticHeadline } from "./hero/KineticHeadline";
import { MagneticCTA } from "./hero/MagneticCTA";
import { AnimatedCounter } from "./hero/AnimatedCounter";
import { useLandingScrollParallax } from "./hero/useLandingScroll";

const CryptoScene = dynamic(
  () => import("./hero/CryptoScene").then((m) => ({ default: m.CryptoScene })),
  { ssr: false, loading: () => null }
);

function HudCard({ label, value, delta, positive = true, icon }: {
  label: string; value: string; delta?: string; positive?: boolean; icon: React.ReactNode;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/4 px-4 py-3 backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-white/6 to-transparent" />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[9px] font-bold uppercase tracking-[0.3em] text-white/40">{label}</p>
          <p className="mt-1.5 font-mono text-xl font-bold tracking-tight text-white">{value}</p>
          {delta && (
            <p className={`mt-0.5 font-mono text-[10px] font-semibold ${positive ? "text-info" : "text-danger"}`}>{delta}</p>
          )}
        </div>
        <div className="mt-0.5 text-warning/70">{icon}</div>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-linear-to-r from-transparent via-info/40 to-transparent animate-[hud-scan_3.5s_ease-in-out_infinite]" />
    </div>
  );
}

export function CryptoHero() {
  const sectionRef = useRef<HTMLElement>(null);
  const contentRef = useLandingScrollParallax({ translateY: -80, opacityStart: 0.6 });

  return (
    <section ref={sectionRef} className="relative min-h-screen w-full overflow-hidden bg-[#040816]">
      {/* Fallback gradient — always renders before WebGL chunk loads */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_40%,rgba(129,140,248,0.10),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_50%,rgba(34,211,238,0.08),transparent_55%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,8,22,0)_60%,rgba(4,8,22,1)_100%)]" />
      </div>

      <CryptoScene />


      {/* Content */}
      <div
        ref={contentRef}
        className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 pb-28 pt-32 sm:px-6"
      >
        <div className="mx-auto w-full max-w-7xl">
          <div className="grid gap-12 lg:grid-cols-[1fr_340px] lg:items-center xl:grid-cols-[1fr_380px]">

            {/* Left: headline + CTA */}
            <div className="space-y-8">
              {/* Eyebrow */}
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-2 rounded-full border border-info/25 bg-info/8 px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-info">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-info" />
                  Beta · Open Access
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-info/20 bg-info/6 px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-info/80">
                  <Zap className="h-3 w-3 text-info" />
                  US & India · 5 Asset Classes
                </span>
              </div>

              {/* Headline */}
              <div>
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.55em] text-white/55">
                  Stop guessing. Start knowing.
                </p>
                <KineticHeadline
                  lines={["engines compute.", "AI interprets.", "AI OS for Investments."]}
                  accents={[2]}
                  delay={0.15}
                  className="mt-5"
                />
              </div>

              {/* Sub copy */}
              <p className="max-w-xl border-l-2 border-info/50 pl-5 font-mono text-sm leading-8 text-white/75 sm:text-base">
                Engines compute the signals. Lyra interprets them. No hallucinated metrics — ever.
              </p>

              {/* CTAs */}
              <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center">
                <MagneticCTA href="/sign-up" variant="primary">
                  Sign Up Free
                  <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                </MagneticCTA>
                <MagneticCTA href="#scroll-story" variant="outline">
                  See How It Works
                </MagneticCTA>
              </div>
              <p className="font-mono text-[10px] text-white/28 tracking-wide">
                Free to join · No credit card · Priority access for early members
              </p>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3 pt-2">
                {[
                  { to: 250, suffix: "M+", label: "Investors · US & India", accent: "amber" as const },
                  { to: 6, suffix: "", label: "Signals computed first", accent: "info" as const },
                  { to: 5, suffix: "", label: "Asset classes", accent: "default" as const },
                ].map((s) => (
                  <div
                    key={s.label}
                    className={`rounded-2xl border p-4 backdrop-blur-sm ${
                      s.accent === "amber"
                        ? "border-warning/18 bg-warning/5"
                        : s.accent === "info"
                        ? "border-info/15 bg-info/4"
                        : "border-white/8 bg-white/3"
                    }`}
                  >
                    <p className={`font-mono text-2xl font-bold tracking-tight sm:text-3xl ${
                      s.accent === "amber" ? "text-warning" : s.accent === "info" ? "text-info" : "text-white"
                    }`}>
                      <AnimatedCounter to={s.to} suffix={s.suffix} />
                    </p>
                    <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-white/38">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: HUD panel stack */}
            <div className="space-y-3 lg:pt-8">
              <HudCard label="Trend Score" value="78 / 100" delta="Strong directional momentum" positive icon={<TrendingUp className="h-4 w-4" />} />
              <HudCard label="Volatility Score" value="42 / 100" delta="Low regime risk" positive icon={<Activity className="h-4 w-4" />} />
              <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/4 p-4 backdrop-blur-xl">
                <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-white/6 to-transparent" />
                <div className="relative flex items-center justify-between gap-4">
                  <div>
                    <p className="font-mono text-[9px] font-bold uppercase tracking-[0.3em] text-white/40">Price Action</p>
                    <p className="mt-1 font-mono text-lg font-bold text-white">Cross-Asset</p>
                    <p className="font-mono text-[10px] text-info">Illustrative example</p>
                  </div>
                  {/* Mini candlestick SVG */}
                  <svg width="72" height="44" viewBox="0 0 72 44" fill="none" className="opacity-60">
                    {[
                      { x: 4, open: 32, close: 18, high: 10, low: 40, up: false },
                      { x: 14, open: 20, close: 10, high: 6, low: 26, up: true },
                      { x: 24, open: 22, close: 12, high: 8, low: 28, up: true },
                      { x: 34, open: 16, close: 28, high: 10, low: 34, up: false },
                      { x: 44, open: 26, close: 14, high: 8, low: 32, up: true },
                      { x: 54, open: 12, close: 24, high: 6, low: 30, up: false },
                      { x: 64, open: 20, close: 8, high: 4, low: 26, up: true },
                    ].map((b) => (
                      <g key={b.x}>
                        <line x1={b.x + 3} y1={b.high} x2={b.x + 3} y2={b.low} stroke={b.up ? "#22D3EE" : "#818CF8"} strokeWidth="0.8" />
                        <rect x={b.x} y={Math.min(b.open, b.close)} width={6} height={Math.abs(b.open - b.close)} fill={b.up ? "#22D3EE" : "#818CF8"} opacity={0.85} />
                      </g>
                    ))}
                  </svg>
                </div>
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-linear-to-r from-transparent via-warning/40 to-transparent animate-[hud-scan_3.5s_ease-in-out_infinite]" />
              </div>
              <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/4 p-4 backdrop-blur-xl">
                <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-white/6 to-transparent" />
                <div className="relative">
                  <p className="font-mono text-[9px] font-bold uppercase tracking-[0.3em] text-white/40">Market Sentiment</p>
                  <div className="mt-3 flex items-center gap-3">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/8">
                      <div className="h-full rounded-full bg-linear-to-r from-info to-warning" style={{ width: "68%" }} />
                    </div>
                    <span className="font-mono text-sm font-bold text-white">68</span>
                  </div>
                  <div className="mt-2 flex justify-between">
                    <span className="font-mono text-[9px] text-white/30">Bear</span>
                    <span className="font-mono text-[9px] text-warning">Bullish Bias</span>
                    <span className="font-mono text-[9px] text-white/30">Bull</span>
                  </div>
                </div>
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-linear-to-r from-transparent via-info/40 to-transparent animate-[hud-scan_3.5s_ease-in-out_infinite]" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom fade */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-linear-to-t from-[#040816] to-transparent" />
    </section>
  );
}
