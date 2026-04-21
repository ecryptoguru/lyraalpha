"use client";

import { ArrowRight, Search, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { LandingReveal } from "@/components/landing/LandingReveal";
import { ScrollToSectionButton } from "@/components/landing/scroll-to-section-button";
import Link from "next/link";

const launchSignals = [
  "Beta · Open access",
  "ELITE plan · free",
  "Cross-asset research stack",
] as const;

const heroStats = [
  { value: "5", label: "asset classes unified" },
  { value: "24/7", label: "structured intelligence access" },
  { value: "300", label: "beta credits on sign-up · free" },
] as const;

const heroPanels = [
  {
    title: "Beta access",
    value: "Open to everyone",
    detail: "Sign up free — no invite required. Full access during the Beta window.",
    accent: false,
  },
  {
    title: "Your plan",
    value: "ELITE — free",
    detail: "Every beta user gets ELITE plan access and 300 credits. No card required.",
    accent: true,
  },
  {
    title: "Research stack",
    value: "Cross-asset coverage",
    detail: "Crypto, equities, and macro intelligence in a single unified platform.",
    accent: false,
  },
] as const;

export function Hero() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    router.push(q ? `/sign-up?q=${encodeURIComponent(q)}` : "/sign-up");
  };

  return (
    <section className="relative overflow-hidden px-4 pb-24 pt-32 sm:px-6 sm:pb-28 sm:pt-36 md:pb-32 md:pt-40" suppressHydrationWarning>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(129,140,248,0.12),transparent_28%),linear-gradient(180deg,rgba(238,240,255,0.96)_0%,rgba(255,255,255,0.98)_48%,rgba(248,250,252,0.98)_100%)] dark:bg-[radial-gradient(circle_at_top,rgba(129,140,248,0.12),transparent_28%),linear-gradient(180deg,#040816_0%,#060d1c_48%,#040814_100%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.08] bg-[linear-gradient(rgba(148,163,184,0.16)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.12)_1px,transparent_1px)] bg-size-[120px_120px] dark:bg-[linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)]" />
      <div className="landing-drift pointer-events-none absolute -left-40 top-12 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(129,140,248,0.18),transparent_68%)] blur-3xl" />
      <div className="landing-float-slow pointer-events-none absolute -right-32 top-32 h-96 w-96 rounded-full border border-warning/10" />

      <div className="container relative mx-auto max-w-7xl px-0">
        <LandingReveal immediate className="mx-auto max-w-6xl">
          <div className="grid gap-10 xl:grid-cols-[minmax(0,1.25fr)_320px] xl:items-start">
            <div className="space-y-8">
              <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.28em]">
                <span className="inline-flex items-center gap-2 rounded-full border border-info/30 bg-info/8 px-4 py-2 text-info dark:border-info/25 dark:bg-info/10 dark:text-info">
                  <span className="landing-pulse-line h-2 w-2 rounded-full bg-info" />
                  Beta · Open Access
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-white/80 px-4 py-2 text-muted-foreground dark:border-white/10 dark:bg-transparent dark:text-white/55">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Built for serious investors
                </span>
              </div>

              <div className="max-w-5xl">
                <p className="text-[10px] font-bold uppercase tracking-[0.52em] text-muted-foreground sm:text-xs dark:text-white/35">
                  Market intelligence with Institutional-grade analytics
                </p>
                <h1 className="mt-6 max-w-5xl text-[3.3rem] font-bold leading-[0.94] tracking-[-0.06em] text-foreground sm:text-[4.6rem] lg:text-[6.4rem] xl:text-[7.6rem] dark:text-white">
                  Built for conviction.
                  <span className="block tracking-[-0.04em] text-muted-foreground dark:text-white/42">AI OS for Investments</span>
                </h1>
                <div className="mt-8 max-w-3xl border-l border-info/40 pl-5 text-base leading-8 text-foreground sm:text-lg dark:border-info/30 dark:text-white/64">
                  Institutional-grade crypto intelligence, free during Beta. Sign up and get ELITE access with 300 credits — no card required.
                </div>
              </div>

              <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center">
                <Link
                  href="/sign-up"
                  className="landing-shimmer inline-flex h-14 items-center justify-center gap-2 rounded-full border border-warning/35 bg-warning px-8 text-base font-bold text-foreground shadow-[0_18px_60px_rgba(245,158,11,0.25)] transition-transform duration-300 hover:-translate-y-1 hover:bg-warning5251"
                >
                  Sign Up Free
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <ScrollToSectionButton
                  size="lg"
                  variant="outline"
                  targetId="how-it-works"
                  className="h-14 rounded-full border border-border/50 bg-white/90 px-8 text-base font-bold text-foreground transition-transform duration-300 hover:-translate-y-1 hover:border-border/50 hover:bg-white dark:border-white/15 dark:bg-white/2 dark:text-white/82 dark:hover:border-white/30 dark:hover:bg-white/5"
                >
                  See the UX flow
                </ScrollToSectionButton>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {heroStats.map((stat) => (
                  <div key={stat.label} className="h-full">
                    <div className="group rounded-4xl border border-border/50 bg-white/90 p-5 transition-transform duration-300 hover:-translate-y-1 dark:border-white/8 dark:bg-white/3">
                      <p className="text-3xl font-bold tracking-[-0.04em] text-foreground sm:text-4xl dark:text-white">{stat.value}</p>
                      <p className="mt-2 max-w-56 text-sm leading-6 text-muted-foreground dark:text-white/52">{stat.label}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <LandingReveal immediate delay={120} className="xl:pt-10">
              <div className="relative overflow-hidden rounded-[2.25rem] border border-border/50 bg-white/92 p-5 shadow-[0_22px_60px_rgba(15,23,42,0.1)] dark:border-white/10 dark:bg-white/[0.035] dark:shadow-[0_22px_60px_rgba(0,0,0,0.3)]">
                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.65),transparent_28%,transparent_72%,rgba(129,140,248,0.06))] dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.07),transparent_28%,transparent_72%,rgba(129,140,248,0.06))]" />
                <div className="pointer-events-none absolute -right-20 -top-20 h-36 w-36 rounded-full border border-info/15 landing-rotate-frame" />
                <div className="relative space-y-4">
                  {heroPanels.map((panel) => (
                    <div
                      key={panel.title}
                      className={`rounded-[1.75rem] border px-4 py-4 ${
                        panel.accent
                          ? "border-info/25 bg-info/8"
                          : "border-border/50 bg-muted/30 dark:border-white/8 dark:bg-foreground/45"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-muted-foreground dark:text-white/38">{panel.title}</p>
                        {panel.accent ? <Zap className="h-4 w-4 text-info" /> : null}
                      </div>
                      <p className="mt-3 text-lg font-bold tracking-tight text-foreground dark:text-white">{panel.value}</p>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground dark:text-white/52">{panel.detail}</p>
                    </div>
                  ))}
                </div>
              </div>
            </LandingReveal>
          </div>
        </LandingReveal>

        <div className="mt-14 grid gap-8 xl:grid-cols-[1.15fr_0.85fr]">
          <LandingReveal delay={120}>
            <div className="relative overflow-hidden rounded-[2.25rem] border border-border/50 bg-white/94 p-6 shadow-[0_24px_68px_rgba(15,23,42,0.1)] sm:p-7 dark:border-white/10 dark:bg-foreground/70 dark:shadow-[0_24px_68px_rgba(0,0,0,0.34)]">
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(129,140,248,0.06),transparent_20%,transparent_78%,rgba(255,255,255,0.05))]" />
              <div className="flex items-start justify-between gap-6 border-b border-border/50 pb-5 dark:border-white/8">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.38em] text-muted-foreground dark:text-white/35">Asset search</p>
                  <h2 className="mt-3 text-2xl font-bold tracking-tight text-foreground sm:text-3xl dark:text-white">Explore any asset.</h2>
                </div>
                <div className="landing-float-fast hidden rounded-full border border-info/18 bg-info/9 p-3 text-info sm:flex">
                  <Search className="h-5 w-5" />
                </div>
              </div>

              <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_230px]">
                <div>
                  <p className="max-w-2xl text-sm leading-7 text-foreground sm:text-base dark:text-white/58">
                    Search BTC, ETH, SOL or any asset for institutional-grade intelligence. Sign up free to unlock the full experience.
                  </p>
                  <div className="mt-6 flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground dark:text-white/40">
                    {launchSignals.map((signal) => (
                      <span key={signal} className="rounded-full border border-border/50 bg-white/80 px-3 py-2 text-muted-foreground dark:border-white/8 dark:bg-transparent dark:text-white/46">
                        {signal}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="rounded-[1.6rem] border border-info/20 bg-info/6 p-4 dark:border-info/12 dark:bg-info/4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-info/70 dark:text-info/50">Beta offer</p>
                  <div className="mt-3 space-y-2 text-sm leading-6 text-foreground dark:text-white/58">
                    <p className="flex items-center gap-2">
                      <Sparkles className="h-3.5 w-3.5 shrink-0 text-info dark:text-info" />
                      ELITE plan — free
                    </p>
                    <p className="flex items-center gap-2">
                      <Zap className="h-3.5 w-3.5 shrink-0 text-warning dark:text-warning" />
                      300 credits on sign-up
                    </p>
                  </div>
                </div>
              </div>

              <form onSubmit={handleSearch} className="relative mt-8">
                <div className="flex items-center gap-3 rounded-[1.7rem] border border-border/50 bg-white px-4 py-3 shadow-[0_4px_24px_rgba(15,23,42,0.07)] transition-shadow focus-within:shadow-[0_4px_32px_rgba(15,23,42,0.12)] dark:border-white/10 dark:bg-white/3 dark:focus-within:border-info/30">
                  <Search className="h-5 w-5 shrink-0 text-muted-foreground dark:text-white/45" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search BTC, ETH, SOL... or any asset"
                    className="h-12 flex-1 border-none bg-transparent text-base font-medium text-foreground outline-none placeholder:text-muted-foreground dark:text-white dark:placeholder:text-white/28"
                    aria-label="Search financial assets"
                    suppressHydrationWarning
                  />
                  <button
                    type="submit"
                    className="inline-flex h-10 items-center gap-2 rounded-full bg-foreground/10 px-5 text-sm font-bold text-white transition-colors hover:bg-foreground/10 dark:bg-white dark:text-foreground dark:hover:bg-white/90"
                  >
                    Sign Up
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
                <p className="mt-2.5 text-center text-[11px] font-medium text-muted-foreground dark:text-white/35">
                  No credit card required · ELITE access · 300 credits free
                </p>
              </form>
            </div>
          </LandingReveal>
        </div>
      </div>
    </section>
  );
}
