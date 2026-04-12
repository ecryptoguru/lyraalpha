import { Check, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";

import { LandingReveal } from "@/components/landing/LandingReveal";
import { SIGNUP_SECTION_ID } from "@/lib/config/prelaunch";

const roadmapQuarters = [
  {
    quarter: "Q1 2026 · Shipping",
    items: [
      {
        title: "Daily Market Briefings",
        tier: "PRO+",
        tierAccent: "amber",
        desc: "Automated daily analysis of portfolio and watchlist.",
      },
    ],
  },
  {
    quarter: "Q2 2026",
    items: [
      {
        title: "Lyra Reports",
        tier: "ELITE+",
        tierAccent: "teal",
        desc: "Scheduled portfolio and market analysis, delivered in plain language.",
      },
      {
        title: "TYRA Research Agent",
        tier: "ELITE+",
        tierAccent: "teal",
        desc: "Hours-long analytical tasks, deep dives.",
      },
      {
        title: "LYRA Voice Fintech Consultant",
        tier: "ELITE+",
        tierAccent: "teal",
        desc: "Voice-enabled AI consultant for hands-free portfolio and market analysis.",
      },
    ],
  },
  {
    quarter: "Q3 2026",
    items: [
      {
        title: "Discovery 2.0",
        tier: "ALL PLANS",
        tierAccent: "default",
        desc: "Democratized premium discovery capabilities.",
      },
    ],
  },
  {
    quarter: "Q4 2026",
    items: [
      {
        title: "Mobile App",
        tier: "ALL PLANS",
        tierAccent: "default",
        desc: "React Native iOS/Android with push notifications.",
      },
    ],
  },
] as const;

function RoadmapSection() {
  return (
    <section className="relative bg-[#040816] px-4 pb-4 pt-24 sm:px-6">
      <div className="pointer-events-none absolute inset-0 obsidian-grid opacity-20" />
      <div className="container relative z-10 mx-auto max-w-7xl px-0">
        <LandingReveal>
          <div className="mb-12">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.42em] text-amber-400/70">
              Six major features shipping across Q1–Q4
            </p>
            <h2 className="mt-4 text-3xl font-light tracking-[-0.04em] text-white md:text-5xl">
              What&apos;s coming{" "}
              <span className="text-amber-400">in 2026.</span>
            </h2>
            <p className="mt-4 text-base leading-7 text-white/42">
              Staggered by plan tier. Each feature has a natural upgrade trigger built in.
            </p>
          </div>
        </LandingReveal>

        <LandingReveal delay={80}>
          {/* Timeline connector line */}
          <div className="relative mb-10 hidden sm:block">
            <div className="absolute top-2 left-0 right-0 h-px bg-linear-to-r from-amber-400/40 via-teal-400/30 to-white/10" />
            <div className="grid grid-cols-4">
              {roadmapQuarters.map((q) => (
                <div key={q.quarter} className="flex flex-col items-start">
                  <div className="h-4 w-4 rounded-sm border border-amber-400/50 bg-amber-400/20" />
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {roadmapQuarters.map((q, qi) => (
              <LandingReveal key={q.quarter} delay={qi * 80}>
                <div className="space-y-3">
                  <p className="text-lg font-semibold tracking-tight text-white">{q.quarter}</p>
                  {q.items.map((item) => (
                    <div
                      key={item.title}
                      className={`rounded-2xl border p-4 ${
                        item.tierAccent === "teal"
                          ? "border-teal-400/18 bg-teal-400/4"
                          : item.tierAccent === "amber"
                          ? "border-amber-400/18 bg-amber-400/4"
                          : "border-white/8 bg-white/[0.028]"
                      }`}
                    >
                      <p className="text-sm font-semibold text-white">{item.title}</p>
                      <span
                        className={`mt-1.5 inline-block rounded-full border px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.2em] ${
                          item.tierAccent === "teal"
                            ? "border-teal-400/25 bg-teal-400/8 text-teal-400"
                            : item.tierAccent === "amber"
                            ? "border-amber-400/25 bg-amber-400/8 text-amber-400"
                            : "border-white/15 bg-white/5 text-white/45"
                        }`}
                      >
                        {item.tier}
                      </span>
                      <p className="mt-2 text-xs leading-5 text-white/42">{item.desc}</p>
                    </div>
                  ))}
                </div>
              </LandingReveal>
            ))}
          </div>
        </LandingReveal>
      </div>
    </section>
  );
}

const betaBenefits = [
  "ELITE plan access — full feature set, free during Beta",
  "300 credits on sign-up — no card, no trial expiry",
  "Direct access to Portfolio Intelligence, Lyra, and Narratives",
] as const;

const betaSignals = [
  { label: "Access type",  value: "Open Beta · no invite required",        accent: "teal"    },
  { label: "Your plan",    value: "ELITE — free for all beta users",        accent: "amber"   },
  { label: "Credits",      value: "300 credits · ready on day one",         accent: "default" },
] as const;

export function WaitlistSection() {
  return (
    <>
      <RoadmapSection />
      <BetaSignupSection />
    </>
  );
}

function BetaSignupSection() {
  return (
    <section
      id={SIGNUP_SECTION_ID}
      className="relative bg-[#040816] px-4 py-24 sm:px-6 sm:py-28"
      suppressHydrationWarning
    >
      <div className="pointer-events-none absolute inset-x-0 top-1/3 h-80 bg-[radial-gradient(ellipse_60%_50%_at_50%_50%,rgba(20,184,166,0.07),transparent_65%)] blur-2xl" />
      <div className="pointer-events-none absolute inset-0 obsidian-grid opacity-25" />

      <div className="container relative z-10 mx-auto max-w-7xl px-0">
        <LandingReveal>
          <div className="overflow-hidden rounded-3xl border border-white/8 bg-white/2 backdrop-blur-sm">
            <div className="h-px w-full bg-linear-to-r from-transparent via-teal-400/60 to-transparent" />

            <div className="grid xl:grid-cols-[1.1fr_0.9fr]">
              {/* Left: info panel */}
              <div className="p-7 sm:p-10">
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-2 rounded-full border border-teal-400/25 bg-teal-400/8 px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-teal-400">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal-400" />
                    Beta · Open Access
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/20 bg-amber-400/6 px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-amber-300/80">
                    <Sparkles className="h-3 w-3 text-amber-400" />
                    Free ELITE plan
                  </span>
                </div>

                <h2 className="mt-6 max-w-2xl text-4xl font-light tracking-[-0.05em] text-white sm:text-5xl lg:text-6xl">
                  Start free.
                  <span className="block text-teal-400">ELITE access, day one.</span>
                </h2>
                <p className="mt-6 max-w-xl text-base leading-8 text-white/45 sm:text-lg">
                  LyraAlpha is now open for Beta. Sign up and instantly unlock ELITE plan features,
                  300 credits, and full access to the platform — no credit card, no invite required.
                </p>

                <div className="mt-8 grid gap-3 sm:grid-cols-3">
                  {betaSignals.map((signal) => (
                    <div
                      key={signal.label}
                      className={`rounded-2xl border p-4 ${
                        signal.accent === "teal"
                          ? "border-teal-400/18 bg-teal-400/5"
                          : signal.accent === "amber"
                          ? "border-amber-400/15 bg-amber-400/4"
                          : "border-white/8 bg-white/2.5"
                      }`}
                    >
                      <p
                        className={`font-mono text-[10px] font-bold uppercase tracking-[0.28em] ${
                          signal.accent === "teal"
                            ? "text-teal-400/60"
                            : signal.accent === "amber"
                            ? "text-amber-400/55"
                            : "text-white/30"
                        }`}
                      >
                        {signal.label}
                      </p>
                      <p className="mt-3 text-sm font-medium leading-6 text-white/65">
                        {signal.value}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-8 space-y-3">
                  {betaBenefits.map((benefit) => (
                    <div
                      key={benefit}
                      className="flex items-start gap-3 rounded-2xl border border-white/8 bg-white/2.5 px-4 py-4"
                    >
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-teal-400/25 bg-teal-400/8 text-teal-400">
                        <Check className="h-3.5 w-3.5" />
                      </div>
                      <p className="text-sm leading-7 text-white/55">{benefit}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right: CTA panel */}
              <div className="relative border-t border-white/8 bg-white/2 px-6 py-8 sm:px-8 sm:py-10 xl:border-l xl:border-t-0">
                <div className="pointer-events-none absolute inset-0 bg-linear-to-b from-teal-400/4 via-transparent to-amber-400/3" />
                <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-teal-400/8 blur-2xl" />

                <LandingReveal delay={120}>
                  <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/3 p-6 shadow-[0_24px_64px_rgba(0,0,0,0.3)] sm:p-7">
                    <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-teal-400/50 to-transparent" />

                    <div className="flex items-center justify-between gap-3 border-b border-white/8 pb-5">
                      <div>
                        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.32em] text-white/30">
                          Beta · Free ELITE access
                        </p>
                        <p className="mt-2 text-lg font-semibold tracking-tight text-white">
                          Create your free account
                        </p>
                      </div>
                      <div className="landing-float-fast rounded-full border border-teal-400/20 bg-teal-400/8 p-3 text-teal-400">
                        <Sparkles className="h-4 w-4" />
                      </div>
                    </div>

                    <div className="mt-6 space-y-4">
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { label: "Plan", value: "ELITE", color: "text-teal-400" },
                          { label: "Credits", value: "300", color: "text-amber-400" },
                          { label: "Card", value: "None", color: "text-white/60" },
                        ].map((item) => (
                          <div key={item.label} className="rounded-2xl border border-white/8 bg-white/2 px-3 py-3 text-center">
                            <p className="font-mono text-[9px] font-bold uppercase tracking-[0.24em] text-white/30">{item.label}</p>
                            <p className={`mt-1.5 text-base font-bold ${item.color}`}>{item.value}</p>
                          </div>
                        ))}
                      </div>

                      <Link
                        href="/sign-up"
                        className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-amber-400 font-bold text-slate-950 shadow-[0_8px_30px_rgba(245,158,11,0.25)] transition-all hover:-translate-y-0.5 hover:bg-amber-300 hover:shadow-[0_14px_45px_rgba(245,158,11,0.35)]"
                      >
                        <Sparkles className="h-4 w-4" />
                        Start Free — Get ELITE Access
                      </Link>

                      <div className="rounded-2xl border border-white/8 bg-white/2 px-4 py-4 text-sm leading-7 text-white/40">
                        <div className="flex items-center gap-2 text-white/60">
                          <ShieldCheck className="h-4 w-4 text-teal-400" />
                          <span className="font-mono text-[10px] uppercase tracking-wide">
                            No card · No catch · Cancel anytime
                          </span>
                        </div>
                        <p className="mt-2 font-mono text-[11px] leading-6">
                          Already have an account?{" "}
                          <Link href="/sign-in" className="underline underline-offset-2 transition-colors hover:text-white/70">
                            Sign in here
                          </Link>
                        </p>
                      </div>
                    </div>
                  </div>
                </LandingReveal>
              </div>
            </div>

            <div className="h-px w-full bg-linear-to-r from-transparent via-amber-400/40 to-transparent" />
          </div>
        </LandingReveal>
      </div>
    </section>
  );
}
