import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BarChart2, BookOpen, BrainCircuit, LineChart, Sparkles, TrendingUp } from "lucide-react";

import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";

const tools = [
  {
    eyebrow: "Portfolio · Demo",
    title: "Demo Portfolio",
    description:
      "See the full portfolio intelligence suite running on a sample US portfolio — health score, Monte Carlo simulation, AI-generated rebalance signals, risk metrics, and benchmark comparison.",
    href: "/tools/demo-portfolio",
    icon: BarChart2,
    accent: "teal",
  },
  {
    eyebrow: "Portfolio Intelligence",
    title: "AI Portfolio Analyzer",
    description:
      "Surface your most important concentration, overlap, or fragility issue before you rebalance. The system finds what deserves attention — not everything at once.",
    href: "/tools/ai-portfolio-analyzer",
    icon: TrendingUp,
    accent: "amber",
  },
  {
    eyebrow: "Market Narratives",
    title: "Market Narrative Tracker",
    description:
      "Find out what story is actually driving the market right now — where leadership is building, where risk is rotating, and what that means for your next move.",
    href: "/tools/market-narrative-tracker",
    icon: LineChart,
    accent: "teal",
  },
  {
    eyebrow: "AI Research · Lyra",
    title: "AI Investment Research",
    description:
      "Ask Lyra a hard market question in plain English. She maps it into a scenario, identifies the strongest second-order effects, and routes you into the right analytical surface.",
    href: "/tools/ai-investment-research",
    icon: BrainCircuit,
    accent: "amber",
  },
  {
    eyebrow: "Asset Intelligence",
    title: "AI Stock Analysis",
    description:
      "Drop a single ticker and get a structured read on setup, key drivers, risk, and what deserves attention next — before you spend more time on it.",
    href: "/tools/ai-stock-analysis",
    icon: BookOpen,
    accent: "teal",
  },
] as const;

export const metadata: Metadata = {
  title: "Investor Tools | LyraAlpha AI — Portfolio, Research & Market Intelligence",
  description:
    "Free investor tools built on deterministic engine computation. Portfolio health scoring, AI investment research, market narrative tracking, and stock analysis for US and India markets. No guesswork — every AI response is grounded in computed signals.",
  alternates: { canonical: "https://lyraalpha.ai/tools" },
  openGraph: {
    title: "Investor Tools | LyraAlpha AI",
    description:
      "Portfolio intelligence, market narrative tracking, AI research, and stock analysis — grounded in deterministic computation, not generic AI guesswork.",
    url: "https://lyraalpha.ai/tools",
    images: ["/og-image.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Investor Tools | LyraAlpha AI",
    description:
      "Portfolio intelligence, market narrative tracking, AI research, and stock analysis — grounded in deterministic computation, not generic AI guesswork.",
    images: ["/og-image.png"],
  },
};

export default function ToolsPage() {
  return (
    <div
      className="flex h-dvh flex-col overflow-x-hidden bg-[#040816] font-sans text-white selection:bg-amber-300/30"
      suppressHydrationWarning
    >
      {/* Ambient glows */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(245,158,11,0.07),transparent_65%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_80%_60%,rgba(20,184,166,0.05),transparent_55%)]" />
        <div className="absolute inset-0 opacity-[0.04] bg-[linear-gradient(rgba(255,255,255,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-size-[80px_80px]" />
      </div>

      <Navbar />

      <main
        data-scroll-root="landing"
        className="relative z-10 flex-1 overflow-x-clip overflow-y-auto scroll-smooth overscroll-contain will-change-scroll"
      >
        {/* ── Hero ── */}
        <section className="px-4 pb-12 pt-28 sm:px-6 sm:pb-16 sm:pt-32">
          <div className="mx-auto max-w-7xl">
            <div className="overflow-hidden rounded-[2.8rem] border border-white/10 bg-white/2.5 shadow-[0_30px_100px_rgba(0,0,0,0.36)] backdrop-blur-xl">
              <div className="grid gap-0 lg:grid-cols-[1.05fr_0.95fr]">

                {/* Left */}
                <div className="p-8 sm:p-12">
                  <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/25 bg-amber-400/8 px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-amber-300">
                    <Sparkles className="h-3 w-3 text-amber-400" />
                    LyraAlpha AI · Investor tools
                  </span>
                  <h1 className="mt-6 max-w-2xl text-4xl font-bold tracking-[-0.055em] text-white sm:text-5xl lg:text-6xl">
                    Start from the question you actually have.
                  </h1>
                  <p className="mt-5 max-w-xl border-l-2 border-teal-400/40 pl-5 font-mono text-sm leading-8 text-white/65 sm:text-base">
                    Each tool here maps to a real investor decision — portfolio risk, market narrative, single-name setup, or open research. Pick the one that fits your question and the system takes it from there.
                  </p>
                </div>

                {/* Right: how-to panel */}
                <div className="border-t border-white/8 bg-white/[0.018] p-8 lg:border-l lg:border-t-0 sm:p-10">
                  <p className="font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-white/38">
                    How these tools work
                  </p>
                  <div className="mt-5 space-y-3">
                    {[
                      {
                        text: "Every tool runs on deterministic engine computation — DSE scores, regime signals, and risk metrics are computed first. The AI interprets what the engines already calculated.",
                        accent: "teal",
                      },
                      {
                        text: "Pick the system that matches the actual decision you need to make, not the broadest one.",
                        accent: "amber",
                      },
                      {
                        text: "Each surface hands off to the next — portfolio flows into shock simulation, narratives flow into discovery, research flows into asset analysis.",
                        accent: "none",
                      },
                    ].map((item, i) => (
                      <div
                        key={i}
                        className={`rounded-[1.7rem] border p-4 ${
                          item.accent === "teal"
                            ? "border-teal-400/20 bg-teal-400/5"
                            : item.accent === "amber"
                            ? "border-amber-400/20 bg-amber-400/5"
                            : "border-white/8 bg-white/3"
                        }`}
                      >
                        <p className="text-sm leading-7 text-white/68">{item.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Tools grid ── */}
        <section className="px-4 py-8 sm:px-6">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-4 md:grid-cols-2">
              {tools.map((tool) => {
                const Icon = tool.icon;
                return (
                  <Link
                    key={tool.href}
                    href={tool.href}
                    className="group overflow-hidden rounded-[2.1rem] border border-white/8 bg-white/2.5 p-7 shadow-[0_22px_70px_rgba(0,0,0,0.26)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-amber-400/25 hover:bg-amber-400/5"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[1.2rem] border ${
                        tool.accent === "teal"
                          ? "border-teal-400/20 bg-teal-400/8 text-teal-300"
                          : "border-amber-400/20 bg-amber-400/8 text-amber-300"
                      }`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <ArrowRight className="h-4 w-4 shrink-0 text-white/20 transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-amber-400/60" />
                    </div>
                    <p className="mt-5 font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-amber-300/65">
                      {tool.eyebrow}
                    </p>
                    <h2 className="mt-2 text-xl font-bold tracking-tight text-white">
                      {tool.title}
                    </h2>
                    <p className="mt-3 text-sm leading-7 text-white/55">{tool.description}</p>
                    <div className="mt-5 inline-flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-white/40 transition-colors duration-300 group-hover:text-amber-300/70">
                      Open system
                      <ArrowRight className="h-3.5 w-3.5" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── Platform differentiator strip ── */}
        <section className="px-4 py-8 sm:px-6">
          <div className="mx-auto max-w-7xl">
            <div className="rounded-[2.4rem] border border-white/10 bg-white/[0.022] p-8 backdrop-blur-xl sm:p-10">
              <div className="grid gap-8 lg:grid-cols-3">
                {[
                  {
                    label: "Engines compute first",
                    detail:
                      "Six deterministic signals — trend score, volatility regime, momentum, fragility, sentiment, and valuation — are computed before any AI speaks. Lyra interprets outputs, not raw data.",
                    accent: "teal",
                  },
                  {
                    label: "US & India, 5 asset classes",
                    detail:
                      "Equities, crypto, ETFs, mutual funds, and commodities — all in one system. Most AI finance tools are US-equity-only. This one covers both markets from the same analytical engine.",
                    accent: "amber",
                  },
                  {
                    label: "Connected surfaces",
                    detail:
                      "Every tool hands off into the next. Portfolio flows into shock simulation and narratives. Research flows into asset analysis. You're never stuck in one tab.",
                    accent: "none",
                  },
                ].map((item) => (
                  <div key={item.label} className="space-y-3">
                    <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.28em] ${
                      item.accent === "teal"
                        ? "border-teal-400/20 bg-teal-400/8 text-teal-300/80"
                        : item.accent === "amber"
                        ? "border-amber-400/20 bg-amber-400/8 text-amber-300/80"
                        : "border-white/10 bg-white/4 text-white/45"
                    }`}>
                      {item.label}
                    </div>
                    <p className="text-sm leading-7 text-white/58">{item.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="px-4 pb-20 pt-4 sm:px-6">
          <div className="mx-auto max-w-7xl">
            <div className="relative overflow-hidden rounded-[2.4rem] border border-amber-400/20 bg-[linear-gradient(135deg,rgba(245,158,11,0.1),rgba(20,184,166,0.06)_50%,rgba(245,158,11,0.08))] p-8 sm:p-10">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_80%_at_50%_50%,rgba(245,158,11,0.06),transparent_70%)]" />
              <div className="relative flex flex-col items-center gap-5 text-center sm:flex-row sm:justify-between sm:text-left">
                <div>
                  <p className="font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-amber-300/70">
                    Early access · Limited spots
                  </p>
                  <h2 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
                    Ready to stop guessing?
                  </h2>
                  <p className="mt-2 max-w-lg text-sm leading-7 text-white/55">
                    Join the early access waitlist. Priority pricing locked for early members. US and India markets. No credit card required.
                  </p>
                </div>
                <Link
                  href="/#join-waitlist"
                  className="group shrink-0 inline-flex items-center gap-2.5 rounded-full border border-amber-400/30 bg-amber-400 px-8 py-4 font-mono text-sm font-bold text-slate-950 shadow-[0_0_40px_rgba(245,158,11,0.3)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-amber-300 hover:shadow-[0_0_60px_rgba(245,158,11,0.45)]"
                >
                  Claim Early Access
                  <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        <Footer />
      </main>
    </div>
  );
}
