"use client";

import { useEffect, useRef } from "react";
import { ArrowRight, Brain, CheckCircle2, TrendingUp, XCircle, Zap } from "lucide-react";
import { ScrollToSectionButton } from "@/components/landing/scroll-to-section-button";
import { PRELAUNCH_WAITLIST_SECTION_ID } from "@/lib/config/prelaunch";

// ─── Panel 1: Market Noise ────────────────────────────────────────────────────

function PanelNoise() {
  const noiseRows = [
    { sym: "BTC",  dir: "↑", val: "+8.34%", color: "text-teal-400" },
    { sym: "ETH",  dir: "↓", val: "-3.12%", color: "text-rose-400" },
    { sym: "SOL",  dir: "↑", val: "+12.1%", color: "text-teal-400" },
    { sym: "BNB",  dir: "↓", val: "-0.92%", color: "text-rose-400" },
    { sym: "XRP",  dir: "↑", val: "+2.33%", color: "text-teal-400" },
    { sym: "ADA",  dir: "↓", val: "-1.44%", color: "text-rose-400" },
    { sym: "AVAX", dir: "↑", val: "+5.67%", color: "text-teal-400" },
    { sym: "DOT",  dir: "↓", val: "-4.21%", color: "text-rose-400" },
  ];

  return (
    <div className="flex h-full w-screen shrink-0 flex-col items-center justify-center px-8 py-16 lg:px-16">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-10">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.4em] text-white/30">
            Phase 01
          </p>
          <h2 className="mt-3 text-4xl font-extralight leading-tight tracking-[-0.04em] text-white sm:text-5xl lg:text-6xl">
            Market{" "}
            <span className="font-light text-rose-400">noise.</span>
          </h2>
          <p className="mt-4 max-w-lg font-mono text-sm leading-7 text-white/42">
            Fragmented signals. Conflicting narratives. 24 platforms, 47 alerts,
            zero clarity. Traditional research leaves you drowning in data.
          </p>
        </div>
        <div className="relative overflow-hidden rounded-2xl border border-white/8 bg-white/3 p-5 backdrop-blur-sm">
          <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-rose-500/5 to-transparent" />
          <div className="grid grid-cols-2 gap-2">
            {noiseRows.map((row, i) => (
              <div
                key={row.sym}
                className="flex items-center justify-between rounded-lg border border-white/6 bg-white/2.5 px-3 py-2"
                style={{ opacity: 0.4 + (i % 3) * 0.2 }}
              >
                <span className="font-mono text-[11px] font-semibold text-white/60">{row.sym}</span>
                <span className={`font-mono text-[11px] font-bold ${row.color}`}>{row.dir} {row.val}</span>
              </div>
            ))}
          </div>
          <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(255,0,0,0.015)_2px,rgba(255,0,0,0.015)_4px)] mix-blend-overlay" />
          <div className="mt-3 rounded-lg border border-rose-500/20 bg-rose-500/8 px-3 py-2">
            <p className="font-mono text-[10px] text-rose-400/70">⚠ 47 conflicting signals detected across 12 sources</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Panel 2: AI Processing ───────────────────────────────────────────────────

function PanelSignal() {
  const nodes = [
    { x: 50, y: 20, label: "MACRO",  active: true  },
    { x: 30, y: 50, label: "L1",     active: true  },
    { x: 70, y: 50, label: "L2",     active: true  },
    { x: 30, y: 78, label: "DeFi",   active: true  },
    { x: 70, y: 78, label: "NFT",    active: false },
  ];
  const edges: [number, number][] = [[0,1],[0,2],[1,3],[2,4],[0,3]];

  return (
    <div className="flex h-full w-screen shrink-0 flex-col items-center justify-center px-8 py-16 lg:px-16">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-10">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.4em] text-white/30">Phase 02</p>
          <h2 className="mt-3 text-4xl font-extralight leading-tight tracking-[-0.04em] text-white sm:text-5xl lg:text-6xl">
            AI <span className="font-light text-amber-400">processing.</span>
          </h2>
          <p className="mt-4 max-w-lg font-mono text-sm leading-7 text-white/42">
            The intelligence engine maps relationships across asset classes, filters signal from noise,
            and builds a structured picture of what&apos;s actually moving markets.
          </p>
        </div>
        <div className="relative overflow-hidden rounded-2xl border border-white/8 bg-white/3 p-5 backdrop-blur-sm">
          <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-amber-500/5 to-transparent" />
          <svg viewBox="0 0 100 100" className="mx-auto h-48 w-full" preserveAspectRatio="xMidYMid meet">
            {edges.map(([a, b], i) => (
              <line
                key={i}
                x1={nodes[a].x} y1={nodes[a].y} x2={nodes[b].x} y2={nodes[b].y}
                stroke={nodes[a].active && nodes[b].active ? "#14B8A6" : "rgba(255,255,255,0.1)"}
                strokeWidth="0.5"
                strokeDasharray={nodes[a].active && nodes[b].active ? "none" : "2,2"}
              />
            ))}
            {nodes.map((node) => (
              <g key={node.label}>
                <circle cx={node.x} cy={node.y} r={3.5}
                  fill={node.active ? "#F59E0B" : "rgba(255,255,255,0.15)"}
                  opacity={node.active ? 1 : 0.4}
                />
                <text x={node.x} y={node.y + 7} textAnchor="middle"
                  fill="rgba(255,255,255,0.5)" fontSize="4" fontFamily="monospace">
                  {node.label}
                </text>
              </g>
            ))}
          </svg>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {[
              { label: "Signals mapped", value: "2,847" },
              { label: "Correlations",   value: "94.2%" },
              { label: "Processing",     value: "< 2s"  },
            ].map((s) => (
              <div key={s.label} className="rounded-lg border border-amber-400/15 bg-amber-400/6 px-2 py-2 text-center">
                <p className="font-mono text-base font-bold text-amber-400">{s.value}</p>
                <p className="font-mono text-[9px] uppercase tracking-wide text-white/35">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Panel 3: Actionable Clarity ──────────────────────────────────────────────

function PanelClarity() {
  return (
    <div className="flex h-full w-screen shrink-0 flex-col items-center justify-center px-8 py-16 lg:px-16">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-10">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.4em] text-white/30">Phase 03</p>
          <h2 className="mt-3 text-4xl font-extralight leading-tight tracking-[-0.04em] text-white sm:text-5xl lg:text-6xl">
            Actionable <span className="font-light text-teal-400">clarity.</span>
          </h2>
          <p className="mt-4 max-w-lg font-mono text-sm leading-7 text-white/42">
            From noise to conviction — structured, traceable intelligence you can interrogate and act on with confidence.
          </p>
        </div>
        <div className="relative overflow-hidden rounded-2xl border border-teal-400/20 bg-white/3 backdrop-blur-sm">
          <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-teal-500/6 to-transparent" />
          <div className="border-b border-white/8 px-5 py-4">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-white/35">AI Research Output</p>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-400/25 bg-teal-400/8 px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-wide text-teal-400">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal-400" />
                Current
              </span>
            </div>
          </div>
          <div className="space-y-3 p-5">
            {[
              { icon: <TrendingUp className="h-3.5 w-3.5" />, label: "Conviction Score",    value: "8.4 / 10", color: "text-teal-400"  },
              { icon: <Brain       className="h-3.5 w-3.5" />, label: "Risk-Adjusted Signal",value: "Bullish",  color: "text-amber-400" },
              { icon: <Zap         className="h-3.5 w-3.5" />, label: "Time Horizon",        value: "2–4 weeks",color: "text-white/70"  },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between rounded-lg border border-white/6 bg-white/2.5 px-3 py-2.5">
                <div className="flex items-center gap-2 text-white/40">
                  {row.icon}
                  <span className="font-mono text-[11px] text-white/50">{row.label}</span>
                </div>
                <span className={`font-mono text-sm font-bold ${row.color}`}>{row.value}</span>
              </div>
            ))}
            <div className="rounded-lg border border-teal-400/12 bg-teal-400/4 px-3 py-2.5">
              <p className="font-mono text-[10px] leading-5 text-white/45 italic">
                &ldquo;Semiconductor demand cycle shows asymmetric upside. Macro regime supports risk-on
                positioning. Cross-asset flows confirm institutional accumulation pattern.&rdquo;
              </p>
            </div>
          </div>
          <div className="border-t border-white/8 px-5 py-4">
            <ScrollToSectionButton
              targetId={PRELAUNCH_WAITLIST_SECTION_ID}
              className="w-full justify-center rounded-xl border border-amber-400/25 bg-amber-400/10 py-2.5 font-mono text-sm font-bold text-amber-400 transition-all hover:bg-amber-400/18 hover:text-amber-300"
            >
              Get This Intelligence
              <ArrowRight className="h-3.5 w-3.5" />
            </ScrollToSectionButton>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Panel 4: Crypto Coverage ────────────────────────────────────────────────────

function PanelDualMarket() {
  const layer1Features = [
    "Bitcoin & Ethereum deep analysis",
    "On-chain metrics & network health",
    "Real-time blockchain data sync",
    "DeFi protocol tracking",
    "Staking & yield farming insights",
  ];
  const layer2Features = [
    "Solana, Avalanche, Polygon coverage",
    "Smart contract analysis",
    "Cross-chain bridge monitoring",
    "Layer-2 scaling solutions",
    "Emerging protocol discovery",
  ];
  const coverage = [
    { asset: "Layer 1",      val: "100% Coverage" },
    { asset: "Layer 2",      val: "95% Coverage" },
    { asset: "DeFi",         val: "90% Coverage" },
    { asset: "Stablecoins",  val: "100% Coverage" },
    { asset: "NFTs",         val: "85% Coverage" },
  ];

  return (
    <div className="flex h-full w-screen shrink-0 flex-col items-center justify-center px-8 py-16 lg:px-16">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-8">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.4em] text-white/30">Phase 04</p>
          <h2 className="mt-3 text-4xl font-extralight leading-tight tracking-[-0.04em] text-white sm:text-5xl">
            Full crypto stack.{" "}
            <span className="font-light text-amber-400">Natively.</span>
          </h2>
          <p className="mt-4 max-w-lg font-mono text-sm leading-7 text-white/42">
            Layer 1 foundations, Layer 2 scaling, DeFi protocols, and on-chain metrics — built for crypto from day one.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="relative overflow-hidden rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4">
            <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-amber-500/6 to-transparent" />
            <p className="font-mono text-[9px] font-bold uppercase tracking-[0.3em] text-amber-400/70">01 Layer 1</p>
            <p className="mt-2 text-sm font-semibold text-white">BTC, ETH, SOL, ADA · Core</p>
            <ul className="mt-3 space-y-1.5">
              {layer1Features.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <span className="mt-0.5 text-amber-400/70 text-[10px]">·</span>
                  <span className="font-mono text-[10px] leading-5 text-white/50">{f}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="relative overflow-hidden rounded-2xl border border-teal-400/18 bg-teal-400/4 p-4">
            <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-teal-500/5 to-transparent" />
            <p className="font-mono text-[9px] font-bold uppercase tracking-[0.3em] text-teal-400/70">02 Layer 2 & DeFi</p>
            <p className="mt-2 text-sm font-semibold text-white">Scaling & Innovation</p>
            <ul className="mt-3 space-y-1.5">
              {layer2Features.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <span className="mt-0.5 text-teal-400/70 text-[10px]">·</span>
                  <span className="font-mono text-[10px] leading-5 text-white/50">{f}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="relative overflow-hidden rounded-2xl border border-white/8 bg-white/3 p-4">
            <p className="font-mono text-[9px] font-bold uppercase tracking-[0.3em] text-white/35">03 Coverage</p>
            <p className="mt-2 text-sm font-semibold text-white">Comprehensive ecosystem</p>
            <div className="mt-3 space-y-2">
              {coverage.map((c) => (
                <div key={c.asset} className="flex items-center justify-between border-b border-white/6 pb-1.5 last:border-0 last:pb-0">
                  <span className="font-mono text-[10px] text-white/45">{c.asset}</span>
                  <span className="font-mono text-[10px] font-bold text-white/70">{c.val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Panel 5: Competitive Landscape ──────────────────────────────────────────

function PanelCompetitive() {
  const dimensions = [
    { label: "Deterministic Analytics", score: "10/10" },
    { label: "AI Interpretation",       score: "10/10" },
    { label: "Workflow Depth",           score: "9/10"  },
    { label: "On-Chain Coverage",        score: "10/10" },
    { label: "Trust Infrastructure",     score: "10/10" },
  ];
  const competitors = [
    {
      name: "Chain Explorers",
      sub: "Etherscan, Solscan",
      gap: "no synthesis or interpretation",
      color: "text-rose-400",
    },
    {
      name: "Generic AI",
      sub: "ChatGPT Crypto, Perplexity",
      gap: "no deterministic backbone",
      color: "text-amber-400",
    },
    {
      name: "DeFi Dashboards",
      sub: "DeFi Llama, DefiPulse",
      gap: "data aggregation, not intelligence",
      color: "text-amber-400",
    },
    {
      name: "Niche Crypto Tools",
      sub: "Glassnode, Messari",
      gap: "on-chain only, no AI interpretation",
      color: "text-rose-400",
    },
  ];

  return (
    <div className="flex h-full w-screen shrink-0 flex-col items-center justify-center px-8 py-16 lg:px-16">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-8">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.4em] text-white/30">Phase 05</p>
          <h2 className="mt-3 text-4xl font-extralight leading-tight tracking-[-0.04em] text-white sm:text-5xl">
            Leads across{" "}
            <span className="font-light text-teal-400">all five dimensions.</span>
          </h2>
          <p className="mt-4 max-w-lg font-mono text-sm leading-7 text-white/42">
            Chain explorers, generic AI, DeFi dashboards, and on-chain tools — all have critical gaps.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="relative overflow-hidden rounded-2xl border border-white/8 bg-white/3 p-5">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-white/35">Five Critical Dimensions</p>
            <div className="mt-4 space-y-2.5">
              {dimensions.map((d) => (
                <div key={d.label} className="flex items-center justify-between border-b border-white/5 pb-2 last:border-0">
                  <span className="font-mono text-[11px] text-white/55">{d.label}</span>
                  <span className="font-mono text-sm font-bold text-teal-400">{d.score}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            {competitors.map((c) => (
              <div key={c.name} className="rounded-xl border border-white/6 bg-white/2.5 px-4 py-3">
                <div className="flex items-center gap-2">
                  <XCircle className="h-3.5 w-3.5 shrink-0 text-white/25" />
                  <span className="text-sm font-semibold text-white">{c.name}</span>
                  <span className="font-mono text-[10px] text-white/30">{c.sub}</span>
                </div>
                <p className="mt-1 pl-5 font-mono text-[10px] leading-5 text-white/40">
                  but{" "}<span className={`font-semibold ${c.color}`}>{c.gap}</span>
                </p>
              </div>
            ))}
            <div className="rounded-xl border border-teal-400/25 bg-teal-400/6 px-4 py-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-teal-400" />
                <span className="text-sm font-bold text-teal-400">LyraAlpha AI</span>
              </div>
              <p className="mt-1 pl-5 font-mono text-[10px] leading-5 text-white/55">
                Deterministic computation + Grounded AI + Premium Workflows across the entire crypto ecosystem.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
// CSS sticky horizontal scroll — no GSAP pin-spacer, works inside overflow-y-auto.
// The outer div is 500vh tall. The sticky inner fills 100vh and the track
// slides left driven by a requestAnimationFrame scroll listener.

export function ScrollytellingSection() {
  const outerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const scroller = outerRef.current?.closest("main") as HTMLElement | null ?? document.documentElement;
    const outer = outerRef.current;
    const track = trackRef.current;
    if (!outer || !track) return;

    // Cached layout values — recomputed only on mount/resize, not per-scroll-frame
    let cachedOuterTop = 0;
    let cachedScrollRange = 0;
    let cachedMaxTranslate = 0;

    const recalcLayout = () => {
      const scrollerScrollTop = scroller === document.documentElement
        ? window.scrollY
        : (scroller as HTMLElement).scrollTop;
      const scrollerTop = scroller === document.documentElement
        ? 0
        : (scroller as HTMLElement).getBoundingClientRect().top;
      const outerRect = outer.getBoundingClientRect();
      cachedOuterTop = outerRect.top + scrollerScrollTop - scrollerTop;
      cachedScrollRange = outer.offsetHeight - window.innerHeight;
      cachedMaxTranslate = track.scrollWidth - window.innerWidth;
    };

    recalcLayout();

    let rafId: number;

    const onScroll = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const scrollerScrollTop = scroller === document.documentElement
          ? window.scrollY
          : (scroller as HTMLElement).scrollTop;
        const scrolled = scrollerScrollTop - cachedOuterTop;
        const progress = Math.max(0, Math.min(1, scrolled / cachedScrollRange));
        track.style.transform = `translateX(${-progress * cachedMaxTranslate}px)`;
      });
    };

    const ro = new ResizeObserver(recalcLayout);
    ro.observe(outer);

    scroller.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      scroller.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, []);

  return (
    <div
      id="scrollytelling"
      ref={outerRef}
      className="relative bg-[#040816]"
      style={{ height: "500vh" }}
    >
      {/* Sticky viewport container */}
      <div className="sticky top-0 h-screen overflow-hidden bg-[#040816]">
        {/* Section label */}
        <div className="pointer-events-none absolute left-6 top-6 z-20 font-mono text-[9px] font-bold uppercase tracking-[0.35em] text-white/20">
          Scroll to explore →
        </div>

        {/* Progress dots */}
        <div className="pointer-events-none absolute right-6 top-1/2 z-20 flex -translate-y-1/2 flex-col gap-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-1.5 w-1.5 rounded-full border border-white/20 bg-white/15" />
          ))}
        </div>

        {/* Horizontal sliding track */}
        <div
          ref={trackRef}
          className="flex h-full"
          style={{ width: "500vw", willChange: "transform" }}
        >
          <div className="relative h-full border-r border-white/5">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_30%_50%,rgba(239,68,68,0.04),transparent_60%)]" />
            <PanelNoise />
          </div>
          <div className="relative h-full border-r border-white/5">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_50%,rgba(245,158,11,0.05),transparent_60%)]" />
            <PanelSignal />
          </div>
          <div className="relative h-full border-r border-white/5">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_70%_50%,rgba(20,184,166,0.06),transparent_60%)]" />
            <PanelClarity />
          </div>
          <div className="relative h-full border-r border-white/5">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_50%,rgba(245,158,11,0.05),transparent_60%)]" />
            <PanelDualMarket />
          </div>
          <div className="relative h-full">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_60%_50%,rgba(20,184,166,0.05),transparent_60%)]" />
            <PanelCompetitive />
          </div>
        </div>

        {/* Bottom fade */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-linear-to-t from-[#040816] to-transparent" />
      </div>
    </div>
  );
}
