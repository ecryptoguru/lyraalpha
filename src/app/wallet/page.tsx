import Link from "next/link";
import {
  ArrowRight,
  CandlestickChart,
  DatabaseZap,
  ShieldAlert,
  Sparkles,
  Wallet,
  Waves,
} from "lucide-react";

import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";

const demoWallets = [
  {
    name: "Treasury Wallet",
    profile: "SOL + stables with low fragility",
    note: "Built for judges who want to see clear health and regime fit without noise.",
  },
  {
    name: "Yield Wallet",
    profile: "LSTs, LPs, lending, protocol spread",
    note: "Shows protocol exposure mapping and deterministic scenario stress.",
  },
  {
    name: "High-Beta Wallet",
    profile: "memecoins, concentrated bets, thin liquidity",
    note: "Best path for surfacing concentration, exit risk, and hidden fragility.",
  },
] as const;

const surfaces = [
  {
    href: "/dashboard/portfolio",
    title: "Wallet Intel",
    body: "Deterministic health, fragility, liquidity exit risk, and protocol exposure for a connected Solana wallet.",
    icon: <Wallet className="h-4 w-4" />,
  },
  {
    href: "/dashboard/stress-test",
    title: "Scenario Lab",
    body: "Run Solana-native stress cases and see where the wallet actually breaks under risk-off conditions.",
    icon: <ShieldAlert className="h-4 w-4" />,
  },
  {
    href: "/dashboard/compare",
    title: "Compare",
    body: "Compare wallets, benchmarks, and high-conviction positions side by side instead of guessing from charts.",
    icon: <CandlestickChart className="h-4 w-4" />,
  },
  {
    href: "/dashboard/lyra",
    title: "Ask Lyra",
    body: "Lyra interprets computed wallet outputs and scenario results. She explains, compares, and summarizes. She does not improvise the structure.",
    icon: <Sparkles className="h-4 w-4" />,
  },
] as const;

const pillars = [
  {
    title: "Wallet-Native, Not Chat-First",
    body: "The product starts from a real Solana wallet or seeded demo wallet, then computes what matters. AI is the explanation layer, not the source of truth.",
  },
  {
    title: "Deterministic Intelligence",
    body: "Health, fragility, concentration, liquidity pressure, and scenario sensitivity should be visible before the first generated sentence appears.",
  },
  {
    title: "Approval-First Design",
    body: "Lyra can explain, simulate, and compare, but the user stays in control. The app is built for judgment, not invisible automation.",
  },
] as const;

export default function WalletPage() {
  return (
    <div className="min-h-screen bg-[#050816] text-white">
      <Navbar />

      <main className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_18%,rgba(20,184,166,0.22),transparent_28%),radial-gradient(circle_at_85%_10%,rgba(56,189,248,0.14),transparent_28%),radial-gradient(circle_at_50%_75%,rgba(245,158,11,0.16),transparent_34%)]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(45,212,191,0.5),transparent)]" />

        <section className="relative px-4 pb-16 pt-20 sm:px-6 sm:pt-24">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-teal-400/20 bg-teal-400/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.24em] text-teal-300">
                  <Waves className="h-3.5 w-3.5" />
                  Solana Wallet Intelligence
                </div>

                <h1 className="mt-6 max-w-4xl text-4xl font-black tracking-[-0.06em] text-white sm:text-6xl">
                  See the real shape of a Solana wallet before the market does.
                </h1>

                <p className="mt-5 max-w-2xl text-base leading-7 text-white/62 sm:text-lg">
                  LyraAlpha is now focused on one thing: turning raw Solana wallet holdings, protocol exposure,
                  liquidity pressure, and scenario risk into a deterministic intelligence workflow with Lyra as
                  the interpretation layer.
                </p>

                <div className="mt-8 flex flex-wrap gap-3">
                  <Link
                    href="/dashboard/portfolio"
                    className="inline-flex items-center gap-2 rounded-full bg-teal-300 px-5 py-3 text-sm font-black text-slate-950 transition-colors hover:bg-teal-200"
                  >
                    Open Wallet Intel
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    href="/dashboard/stress-test"
                    className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/5 px-5 py-3 text-sm font-bold text-white/86 transition-colors hover:bg-white/10"
                  >
                    Run Scenario Lab
                  </Link>
                </div>

                <div className="mt-8 flex flex-wrap gap-2">
                  {[
                    "Wallet connect or seeded demo wallets",
                    "Protocol exposure mapping",
                    "Liquidity exit risk",
                    "Scenario-driven decision memos",
                  ].map((item) => (
                    <span
                      key={item}
                      className="rounded-full border border-white/10 bg-white/4 px-3 py-1.5 text-[11px] font-semibold text-white/62"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>

              <div className="rounded-4xl border border-white/10 bg-white/4 p-6 shadow-[0_30px_80px_rgba(0,0,0,0.28)] backdrop-blur-xl">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-white/40">
                      Product Loop
                    </p>
                    <h2 className="mt-2 text-xl font-black tracking-[-0.04em]">Compute first. Interpret second.</h2>
                  </div>
                  <div className="rounded-2xl border border-teal-400/20 bg-teal-400/10 p-3 text-teal-300">
                    <DatabaseZap className="h-5 w-5" />
                  </div>
                </div>

                <div className="mt-6 space-y-3">
                  {[
                    "Connect wallet or load a seeded demo wallet",
                    "Normalize token and protocol exposures",
                    "Score health, fragility, concentration, and regime fit",
                    "Run Solana-native shock scenarios",
                    "Let Lyra explain the computed outcome",
                  ].map((step, index) => (
                    <div
                      key={step}
                      className="flex items-start gap-3 rounded-2xl border border-white/8 bg-black/20 px-4 py-3"
                    >
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-[11px] font-black text-white/86">
                        {index + 1}
                      </div>
                      <p className="text-sm leading-6 text-white/72">{step}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="relative px-4 py-8 sm:px-6">
          <div className="mx-auto max-w-7xl">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-white/36">Demo Wallets</p>
                <h2 className="mt-2 text-2xl font-black tracking-[-0.05em] text-white">Start from a wallet that tells a story.</h2>
              </div>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-3">
              {demoWallets.map((wallet) => (
                <div
                  key={wallet.name}
                  className="rounded-[1.75rem] border border-white/10 bg-white/4 p-5 backdrop-blur-xl"
                >
                  <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-teal-300">{wallet.name}</p>
                  <p className="mt-3 text-lg font-black tracking-[-0.04em] text-white">{wallet.profile}</p>
                  <p className="mt-3 text-sm leading-6 text-white/58">{wallet.note}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="relative px-4 py-10 sm:px-6">
          <div className="mx-auto max-w-7xl">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-white/36">Core Surfaces</p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.05em] text-white">
                One focused Solana workflow, four high-signal surfaces.
              </h2>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {surfaces.map((surface) => (
                <Link
                  key={surface.href}
                  href={surface.href}
                  className="group rounded-[1.75rem] border border-white/10 bg-white/4 p-5 transition-all duration-200 hover:-translate-y-1 hover:border-teal-300/25 hover:bg-white/6"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-teal-300/18 bg-teal-300/10 text-teal-300">
                    {surface.icon}
                  </div>
                  <h3 className="mt-4 text-lg font-black tracking-[-0.04em] text-white">{surface.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-white/58">{surface.body}</p>
                  <div className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-teal-300">
                    Open surface
                    <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="relative px-4 pb-20 pt-8 sm:px-6">
          <div className="mx-auto max-w-7xl rounded-4xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.22)] backdrop-blur-xl sm:p-8">
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-white/36">Why This Pivot Matters</p>
            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              {pillars.map((pillar) => (
                <div
                  key={pillar.title}
                  className="rounded-3xl border border-white/8 bg-black/15 p-5"
                >
                  <h3 className="text-lg font-black tracking-[-0.04em] text-white">{pillar.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-white/58">{pillar.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
