import Link from "next/link";
import { ComponentType } from "react";
import { BookOpen, GitMerge, LineChart, Lock, ShieldCheck, Zap } from "lucide-react";

import { LandingReveal } from "@/components/landing/LandingReveal";
import { ScrollToSectionButton } from "@/components/landing/scroll-to-section-button";
import { PRELAUNCH_WAITLIST_SECTION_ID } from "@/lib/config/prelaunch";

interface FeatureCardProps {
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  className?: string;
  accent?: "amber" | "teal" | "default";
}

function FeatureCard({
  title,
  description,
  icon: Icon,
  className = "",
  accent = "default",
}: FeatureCardProps) {
  const accentStyles = {
    amber: "border-amber-400/20 bg-amber-400/5 hover:border-amber-400/35",
    teal: "border-teal-400/18 bg-teal-400/4 hover:border-teal-400/30",
    default: "border-white/8 bg-white/2.8 hover:border-white/15",
  };

  const iconStyles = {
    amber: "border-amber-400/25 bg-amber-400/10 text-amber-400",
    teal: "border-teal-400/20 bg-teal-400/8 text-teal-400",
    default: "border-white/12 bg-white/5 text-white/60",
  };

  return (
    <div
      className={`group relative overflow-hidden rounded-3xl border p-6 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 sm:p-8 ${accentStyles[accent]} ${className}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-white/4 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
      <div className="relative z-10">
        <div
          className={`mb-6 flex h-12 w-12 items-center justify-center rounded-2xl border transition-transform duration-300 group-hover:scale-105 ${iconStyles[accent]}`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <h3 className="mb-3 text-xl font-semibold tracking-tight text-white sm:text-2xl">
          {title}
        </h3>
        <p className="leading-7 text-white/45">{description}</p>
      </div>
      {/* Corner glow */}
      <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-amber-400/6 blur-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
    </div>
  );
}

const signals = [
  { name: "Trend",      desc: "Directional strength and persistence",    score: "78", accent: "amber" },
  { name: "Momentum",   desc: "Rate of change and acceleration",           score: "65", accent: "default" },
  { name: "Volatility", desc: "Price dispersion and regime risk",          score: "42", accent: "default" },
  { name: "Liquidity",  desc: "Bid-ask spread and trading depth",          score: "88", accent: "teal" },
  { name: "Trust",      desc: "Earnings quality and insider activity",     score: "72", accent: "default" },
  { name: "Sentiment",  desc: "Market psychology and positioning",         score: "55", accent: "default" },
] as const;

const lyraCapabilities = [
  { icon: LineChart,   title: "Regime-Aware Analysis",      desc: "Reads every asset within its current market regime — macro, sector, and asset-level simultaneously.",                         accent: "amber" as const },
  { icon: GitMerge,    title: "Multi-Asset Synthesis",       desc: "Analyzes up to 4 assets across sectors at once — identifying divergence, correlation, and relative regime alignment.",         accent: "teal" as const },
  { icon: Zap,         title: "Shock Simulator",             desc: "Interprets deterministic stress replays — explaining what scenarios revealed and which assets showed genuine resilience.",     accent: "default" as const },
  { icon: BookOpen,    title: "Conversation Memory",         desc: "Maintains context across sessions for deeper, continuous analysis without repeating previous context.",                        accent: "default" as const },
  { icon: ShieldCheck, title: "Research Augmentation",       desc: "Pulls fresh web data with rigorous RAG injection scanning. Every retrieved chunk is scanned before Lyra sees it.",            accent: "default" as const },
  { icon: Lock,        title: "Portfolio Intelligence",      desc: "Reads a portfolio as a system — regime alignment, fragility, benchmark comparison, Monte Carlo framing, and score velocity.", accent: "teal" as const },
] as const;

export function Features() {
  return (
    <section className="relative bg-[#040816] px-4 py-24 sm:px-6">
      {/* Obsidian grid */}
      <div className="pointer-events-none absolute inset-0 obsidian-grid opacity-[0.45]" />
      <div className="pointer-events-none absolute inset-0 bg-linear-to-b from-[#040816] via-transparent to-[#040816]" />

      <div className="container relative z-10 mx-auto max-w-7xl px-0">
        {/* ── Six Core Signals ───────────────────────────────── */}
        <LandingReveal>
          <div className="mx-auto mb-12 max-w-3xl text-center">
            <p className="mb-4 font-mono text-[10px] font-bold uppercase tracking-[0.42em] text-amber-400/70">
              Computed before any AI speaks
            </p>
            <h2 className="text-3xl font-light tracking-[-0.04em] text-white md:text-5xl">
              Six core market signals,{" "}
              <span className="text-amber-400">computed deterministically.</span>
            </h2>
            <p className="mt-6 text-base leading-8 text-white/42">
              Before any AI response, the structured analytical foundation is already in place.
              The model interprets what the engines computed — it never invents the structure.
            </p>
          </div>
        </LandingReveal>

        <LandingReveal delay={80}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {signals.map((sig) => {
              const pct = parseInt(sig.score);
              const accentBar = sig.accent === "amber" ? "bg-amber-400" : sig.accent === "teal" ? "bg-teal-400" : "bg-white/25";
              const accentText = sig.accent === "amber" ? "text-amber-400" : sig.accent === "teal" ? "text-teal-400" : "text-white/55";
              const borderClass = sig.accent === "amber" ? "border-amber-400/18 bg-amber-400/4" : sig.accent === "teal" ? "border-teal-400/15 bg-teal-400/4" : "border-white/8 bg-white/2.8";
              return (
                <div key={sig.name} className={`rounded-2xl border p-5 transition-transform duration-300 hover:-translate-y-1 ${borderClass}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold tracking-tight text-white">{sig.name}</p>
                      <p className="mt-1 text-xs leading-5 text-white/42">{sig.desc}</p>
                    </div>
                    <span className={`shrink-0 font-mono text-lg font-bold ${accentText}`}>{sig.score}<span className="text-xs font-normal text-white/25">/100</span></span>
                  </div>
                  <div className="mt-4 h-px w-full overflow-hidden rounded-full bg-white/8">
                    <div className={`h-full rounded-full transition-all duration-700 ${accentBar}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </LandingReveal>

        {/* ── Lyra Capabilities ──────────────────────────────── */}
        <LandingReveal delay={60}>
          <div className="mx-auto mb-12 mt-24 max-w-3xl text-center">
            <p className="mb-4 font-mono text-[10px] font-bold uppercase tracking-[0.42em] text-amber-400/70">
              Lyra — purpose-built market intelligence agent
            </p>
            <h2 className="text-3xl font-light tracking-[-0.04em] text-white md:text-5xl">
              Lyra doesn&apos;t guess.{" "}
              <span className="text-teal-400">She interprets.</span>
            </h2>
            <p className="mt-6 text-base leading-8 text-white/42">
              Every response flows through a pipeline that computes structured context first —
              then streams analysis under a strict output contract.
            </p>
          </div>
        </LandingReveal>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {lyraCapabilities.map((cap, i) => (
            <LandingReveal key={cap.title} delay={i * 60}>
              <FeatureCard
                title={cap.title}
                description={cap.desc}
                icon={cap.icon}
                accent={cap.accent}
                className="h-full"
              />
            </LandingReveal>
          ))}
        </div>

        <LandingReveal delay={220}>
          <div className="relative mt-12 overflow-hidden rounded-3xl border border-white/8 bg-white/2.5 p-6 backdrop-blur-sm sm:p-8">
            <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-amber-400/5 to-transparent" />
            <div className="relative max-w-3xl">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.38em] text-amber-400/65">
                System entry points
              </p>
              <h3 className="mt-4 text-2xl font-light tracking-[-0.04em] text-white sm:text-4xl">
                Start from the tool that matches your question.
              </h3>
              <p className="mt-4 text-sm leading-7 text-white/42 sm:text-base">
                Portfolio intelligence, market narratives, deep AI research and asset-level analysis.
              </p>
            </div>

            <div className="mt-8 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  eyebrow: "Portfolio",
                  title: "AI Portfolio Analyzer",
                  description: "Best when you want the clearest current risk, overlap or rebalance question.",
                  href: "/dashboard/portfolio",
                  accent: "amber",
                },
                {
                  eyebrow: "Narratives",
                  title: "Market Narrative Tracker",
                  description: "Best when you want to understand the dominant market story before acting.",
                  href: "/dashboard#market-intelligence",
                  accent: "teal",
                },
                {
                  eyebrow: "Research",
                  title: "AI Investment Research",
                  description: "Best when you need reasoning, scenario framing and follow-up questions in one place.",
                  href: "/dashboard/lyra",
                  accent: "default",
                },
                {
                  eyebrow: "Assets",
                  title: "AI Stock Analysis",
                  description: "Best when you want to go from a single name into deeper analytics and next actions.",
                  href: "/dashboard/assets/AAPL",
                  accent: "default",
                },
              ].map((item) => (
                <Link
                  key={item.title}
                  href={item.href}
                  className={`group cursor-pointer rounded-2xl border p-4 transition-all duration-300 hover:-translate-y-1 ${
                    item.accent === "amber"
                      ? "border-amber-400/18 bg-amber-400/5 hover:border-amber-400/30 hover:bg-amber-400/8"
                      : item.accent === "teal"
                      ? "border-teal-400/15 bg-teal-400/4 hover:border-teal-400/28 hover:bg-teal-400/7"
                      : "border-white/8 bg-white/3 hover:border-white/15 hover:bg-white/5"
                  }`}
                >
                  <p
                    className={`font-mono text-[9px] font-bold uppercase tracking-[0.2em] ${
                      item.accent === "amber"
                        ? "text-amber-400/75"
                        : item.accent === "teal"
                        ? "text-teal-400/70"
                        : "text-white/38"
                    }`}
                  >
                    {item.eyebrow}
                  </p>
                  <h4 className="mt-2 text-base font-semibold tracking-tight text-white">
                    {item.title}
                  </h4>
                  <p className="mt-2 text-xs leading-6 text-white/42">{item.description}</p>
                </Link>
              ))}
            </div>

            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <ScrollToSectionButton
                variant="outline"
                targetId={PRELAUNCH_WAITLIST_SECTION_ID}
                className="rounded-full border-white/12 bg-white/4 px-6 min-h-[38px] font-bold text-white/75 backdrop-blur-sm transition-all hover:border-amber-400/30 hover:bg-amber-400/8 hover:text-white"
              >
                Join Waitlist
              </ScrollToSectionButton>
            </div>
          </div>
        </LandingReveal>
      </div>
    </section>
  );
}
