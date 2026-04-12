import { ArrowRight, Lock, Search, ShieldCheck, Sparkles } from "lucide-react";

import { LandingReveal } from "@/components/landing/LandingReveal";
import { ScrollToSectionButton } from "@/components/landing/scroll-to-section-button";
import { Button } from "@/components/ui/button";
import { PRELAUNCH_WAITLIST_SECTION_ID } from "@/lib/config/prelaunch";

const launchSignals = [
  "Pre-launch window open",
  "Invite-only access window",
  "Cross-asset research stack",
] as const;

const heroStats = [
  { value: "5", label: "asset classes unified" },
  { value: "24/7", label: "structured intelligence access" },
  { value: "2", label: "paths in: waitlist or private invite" },
] as const;

const heroPanels = [
  {
    title: "Launch mode",
    value: "Closed onboarding",
    detail: "Public access is paused while we prepare the pre-launch release.",
  },
  {
    title: "Priority path",
    value: "Join waitlist",
    detail: "Secure priority notice and be first in line when onboarding opens.",
  },
  {
    title: "Private access",
    value: "Invite-only entry",
    detail: "Approved private access remains open during this window.",
  },
] as const;

export function Hero() {
  return (
    <section className="relative overflow-hidden px-4 pb-24 pt-32 sm:px-6 sm:pb-28 sm:pt-36 md:pb-32 md:pt-40" suppressHydrationWarning>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(245,158,11,0.12),transparent_28%),linear-gradient(180deg,rgba(255,251,235,0.96)_0%,rgba(255,255,255,0.98)_48%,rgba(248,250,252,0.98)_100%)] dark:bg-[radial-gradient(circle_at_top,rgba(255,193,7,0.12),transparent_28%),linear-gradient(180deg,#040816_0%,#060d1c_48%,#040814_100%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.08] bg-[linear-gradient(rgba(148,163,184,0.16)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.12)_1px,transparent_1px)] bg-size-[120px_120px] dark:bg-[linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)]" />
      <div className="landing-drift pointer-events-none absolute -left-40 top-12 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(214,158,46,0.18),transparent_68%)] blur-3xl" />
      <div className="landing-float-slow pointer-events-none absolute -right-32 top-32 h-96 w-96 rounded-full border border-amber-400/10" />

      <div className="container relative mx-auto max-w-7xl px-0">
        <LandingReveal immediate className="mx-auto max-w-6xl">
          <div className="grid gap-10 xl:grid-cols-[minmax(0,1.25fr)_320px] xl:items-start">
            <div className="space-y-8">
              <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-600/80 dark:text-amber-200/78">
                <span className="inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-amber-50 px-4 py-2 text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/8 dark:text-amber-100/85">
                  <span className="landing-pulse-line h-2 w-2 rounded-full bg-amber-300" />
                  Pre-launch waitlist
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-slate-500 dark:border-white/10 dark:bg-transparent dark:text-white/55">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Built for serious investors
                </span>
              </div>

              <div className="max-w-5xl">
                <p className="text-[10px] font-bold uppercase tracking-[0.52em] text-slate-400 sm:text-xs dark:text-white/35">
                  Market intelligence with Institutional-grade analytics
                </p>
                <h1 className="mt-6 max-w-5xl text-[3.3rem] font-bold leading-[0.94] tracking-[-0.06em] text-slate-950 sm:text-[4.6rem] lg:text-[6.4rem] xl:text-[7.6rem] dark:text-white">
                  Built for conviction.
                  <span className="block tracking-[-0.04em] text-slate-400 dark:text-white/42">AI OS for Investments</span>
                </h1>
                <div className="mt-8 max-w-3xl border-l border-amber-300/40 pl-5 text-base leading-8 text-slate-600 sm:text-lg dark:border-amber-300/30 dark:text-white/64">
                  Public onboarding is paused during pre-launch. Join the waitlist now to secure priority access when the gates open.
                </div>
              </div>

              <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center">
                <ScrollToSectionButton
                  size="lg"
                  targetId={PRELAUNCH_WAITLIST_SECTION_ID}
                  className="landing-shimmer h-14 rounded-full border border-amber-300/35 bg-amber-400 px-8 text-base font-bold text-slate-950 shadow-[0_18px_60px_rgba(245,158,11,0.25)] transition-transform duration-300 hover:-translate-y-1 hover:bg-amber-300"
                >
                  Join Waitlist
                  <ArrowRight className="h-4 w-4" />
                </ScrollToSectionButton>
                <ScrollToSectionButton
                  size="lg"
                  variant="outline"
                  targetId="how-it-works"
                  className="h-14 rounded-full border border-slate-200 bg-white/90 px-8 text-base font-bold text-slate-700 transition-transform duration-300 hover:-translate-y-1 hover:border-slate-300 hover:bg-white dark:border-white/15 dark:bg-white/2 dark:text-white/82 dark:hover:border-white/30 dark:hover:bg-white/5"
                >
                  See the UX flow
                </ScrollToSectionButton>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {heroStats.map((stat) => (
                  <div key={stat.label} className="h-full">
                    <div className="group rounded-4xl border border-slate-200 bg-white/90 p-5 transition-transform duration-300 hover:-translate-y-1 dark:border-white/8 dark:bg-white/3">
                      <p className="text-3xl font-bold tracking-[-0.04em] text-slate-900 sm:text-4xl dark:text-white">{stat.value}</p>
                      <p className="mt-2 max-w-56 text-sm leading-6 text-slate-500 dark:text-white/52">{stat.label}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <LandingReveal immediate delay={120} className="xl:pt-10">
              <div className="relative overflow-hidden rounded-[2.25rem] border border-slate-200 bg-white/92 p-5 shadow-[0_22px_60px_rgba(15,23,42,0.1)] dark:border-white/10 dark:bg-white/[0.035] dark:shadow-[0_22px_60px_rgba(0,0,0,0.3)]">
                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.65),transparent_28%,transparent_72%,rgba(245,158,11,0.08))] dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.07),transparent_28%,transparent_72%,rgba(255,193,7,0.08))]" />
                <div className="pointer-events-none absolute -right-20 -top-20 h-36 w-36 rounded-full border border-amber-300/15 landing-rotate-frame" />
                <div className="relative space-y-4">
                  {heroPanels.map((panel, index) => (
                    <div
                      key={panel.title}
                      className={`rounded-[1.75rem] border px-4 py-4 ${
                        index === 1
                          ? "border-amber-300/25 bg-amber-300/8"
                          : "border-slate-200 bg-slate-50 dark:border-white/8 dark:bg-slate-950/45"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-slate-400 dark:text-white/38">{panel.title}</p>
                        {index === 1 ? <Sparkles className="h-4 w-4 text-amber-300" /> : null}
                      </div>
                      <p className="mt-3 text-lg font-bold tracking-tight text-slate-900 dark:text-white">{panel.value}</p>
                      <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-white/52">{panel.detail}</p>
                    </div>
                  ))}
                </div>
              </div>
            </LandingReveal>
          </div>
        </LandingReveal>

        <div className="mt-14 grid gap-8 xl:grid-cols-[1.15fr_0.85fr]">
          <LandingReveal delay={120}>
            <div className="relative overflow-hidden rounded-[2.25rem] border border-slate-200 bg-white/94 p-6 shadow-[0_24px_68px_rgba(15,23,42,0.1)] sm:p-7 dark:border-white/10 dark:bg-slate-950/70 dark:shadow-[0_24px_68px_rgba(0,0,0,0.34)]">
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(255,193,7,0.08),transparent_20%,transparent_78%,rgba(255,255,255,0.05))]" />
              <div className="flex items-start justify-between gap-6 border-b border-slate-200 pb-5 dark:border-white/8">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.38em] text-slate-400 dark:text-white/35">Search preview</p>
                  <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white">locked for pre-launch.</h2>
                </div>
                <div className="landing-float-fast hidden rounded-full border border-amber-300/18 bg-amber-300/9 p-3 text-amber-200 sm:flex">
                  <Lock className="h-5 w-5" />
                </div>
              </div>

              <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_230px]">
                <div>
                  <p className="max-w-2xl text-sm leading-7 text-slate-600 sm:text-base dark:text-white/58">
                    The asset search experience is offline during this closed-access phase. Join the waitlist now or continue only if you already hold approved private access.
                  </p>
                  <div className="mt-6 flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-400 dark:text-white/40">
                    {launchSignals.map((signal) => (
                      <span key={signal} className="rounded-full border border-slate-200 bg-white/80 px-3 py-2 text-slate-500 dark:border-white/8 dark:bg-transparent dark:text-white/46">
                        {signal}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="rounded-[1.6rem] border border-slate-200 bg-slate-50/90 p-4 dark:border-white/8 dark:bg-white/2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400 dark:text-white/36">Access summary</p>
                  <div className="mt-3 space-y-3 text-sm leading-6 text-slate-500 dark:text-white/54">
                    <p>Waitlist users get first notice when onboarding opens.</p>
                    <p>Approved invite holders can still pass through sign-up during the private access window.</p>
                  </div>
                </div>
              </div>

              <div className="relative mt-8 min-h-68 overflow-hidden rounded-4xl border border-slate-200 bg-slate-100 p-3 sm:min-h-74 dark:border-white/10 dark:bg-black/35">
                <div className="pointer-events-none absolute inset-0 z-20 bg-[linear-gradient(180deg,rgba(255,255,255,0.18),rgba(248,250,252,0.82))] backdrop-blur-sm dark:bg-[linear-gradient(180deg,rgba(4,8,22,0.1),rgba(4,8,22,0.46))]" />
                <div className="pointer-events-none absolute inset-x-6 top-1/2 z-30 -translate-y-1/2 text-center">
                  <div className="mx-auto flex w-fit items-center gap-2 rounded-full border border-amber-300/30 bg-amber-50 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.35em] text-amber-700 dark:border-amber-300/20 dark:bg-amber-300/8 dark:text-amber-100/75">
                    <Lock className="h-3.5 w-3.5" />
                    Coming soon
                  </div>
                  <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-slate-600 dark:text-white/68">
                    Search preview reopens at launch. Until then, use the waitlist form below to reserve access.
                  </p>
                  <ScrollToSectionButton
                    size="sm"
                    targetId={PRELAUNCH_WAITLIST_SECTION_ID}
                    className="pointer-events-auto mt-4 rounded-full bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-white/90"
                  >
                    Join Waitlist
                  </ScrollToSectionButton>
                </div>
                <div className="rounded-[1.7rem] border border-slate-200 bg-white/70 px-4 py-5 opacity-50 blur-[1px] sm:py-6 dark:border-white/8 dark:bg-white/2 dark:opacity-40">
                  <div className="flex items-center gap-3 rounded-[1.4rem] border border-slate-200 bg-white/80 px-4 py-3 dark:border-white/6 dark:bg-white/2">
                    <Search className="h-5 w-5 text-slate-400 dark:text-white/45" />
                    <input
                      type="text"
                      placeholder="Search BTC-USD, ETH-USD, SOL-USD..."
                      className="h-12 flex-1 border-none bg-transparent text-base font-medium text-slate-700 outline-none placeholder:text-slate-400 dark:text-white dark:placeholder:text-white/28"
                      defaultValue=""
                      aria-label="Search financial assets"
                      suppressHydrationWarning
                      readOnly
                      disabled
                    />
                    <Button size="lg" disabled className="h-12 rounded-full px-6 font-bold">
                      Explore
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </LandingReveal>
        </div>
      </div>
    </section>
  );
}
