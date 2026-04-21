import { cookies } from "next/headers";
import Link from "next/link";

import {
  FlaskConical,
  TrendingUp,
  ArrowRight,
  Bot,
  Bitcoin,
  Activity,
  BarChart3,
} from "lucide-react";

import { PageHeader, StatChip } from "@/components/dashboard/page-header";
import { SectionErrorBoundary } from "@/components/error-boundary";
import { US_SECTOR_SENSITIVITY } from "@/lib/macro/sector-sensitivity/us";
import { IN_SECTOR_SENSITIVITY } from "@/lib/macro/sector-sensitivity/in";
import type { SectorImpact } from "@/lib/macro/types";

const IMPACT_STYLES: Record<SectorImpact, { bg: string; text: string; label: string }> = {
  tailwind: { bg: "border-success/25 bg-success/10", text: "text-success", label: "Tailwind" },
  headwind: { bg: "border-danger/25    bg-danger/10",    text: "text-danger",    label: "Headwind" },
  neutral:  { bg: "border-white/10       bg-card/60",        text: "text-muted-foreground", label: "Neutral"  },
};

export const dynamic = "force-dynamic";

const LYRA_PROMPTS_CRYPTO = [
  "What does the current BTC dominance trend mean for altcoins?",
  "Which crypto sectors benefit most from today's on-chain activity?",
  "How does the current fear & greed index affect DeFi tokens?",
];

const ON_CHAIN_METRICS = [
  { label: "BTC Dominance", value: "54.2%", sub: "Market cap share", icon: Bitcoin, color: "gold" as const },
  { label: "Active Addresses", value: "1.4M", sub: "24h network activity", icon: Activity, color: "emerald" as const },
  { label: "DeFi TVL", value: "$92B", sub: "Total value locked", icon: BarChart3, color: "primary" as const },
  { label: "Whale Activity", value: "+18%", sub: "Large holder inflows", icon: TrendingUp, color: "emerald" as const },
] as const;

const METRIC_COLORS = {
  gold: { border: "border-[#FFD700]/20", bg: "bg-[#FFD700]/5", icon: "text-[#FFD700]" },
  emerald: { border: "border-success/20", bg: "bg-success/5", icon: "text-success" },
  primary: { border: "border-primary/20", bg: "bg-primary/5", icon: "text-primary" },
} as const;

export default async function MacroResearchPage() {
  const cookieStore = await cookies();
  const region = cookieStore.get("user_region_preference")?.value === "IN" ? "IN" as const : "US" as const;

  const sectors = region === "IN" ? IN_SECTOR_SENSITIVITY : US_SECTOR_SENSITIVITY;

  const tailwinds   = sectors.filter((s) => s.impact === "tailwind").length;
  const headwinds   = sectors.filter((s) => s.impact === "headwind").length;

  return (
    <SectionErrorBoundary>
      <div className="relative flex flex-col gap-6 p-3 sm:p-4 md:p-6 pb-8 min-w-0 overflow-x-hidden">

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="animate-slide-up-fade">
          <PageHeader
            icon={<FlaskConical className="h-5 w-5" />}
            title="Crypto Research"
            eyebrow="On-chain → Market → Network"
            chips={
              <>
                <StatChip value={region} label="Market" variant="muted" />
                <StatChip value="BTC" label="Dominance" variant="gold" />
                <StatChip value="Fear & Greed" label="Sentiment" variant="green" />
                <StatChip value={tailwinds} label="Bullish" variant="green" />
                {headwinds > 0 && <StatChip value={headwinds} label="Bearish" variant="red" />}
              </>
            }
          />
        </div>

        {/* ── Layer 1: On-chain Indicators ────────────────────────────────────── */}
        <section className="animate-slide-up-fade animation-delay-100 space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">On-chain Metrics</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {ON_CHAIN_METRICS.map((m) => {
              const c = METRIC_COLORS[m.color];
              const Icon = m.icon;
              return (
                <div key={m.label} className={`rounded-3xl border ${c.border} ${c.bg} p-4 flex flex-col gap-2`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground leading-tight">{m.label}</p>
                    <Icon className={`h-5 w-5 ${c.icon}`} />
                  </div>
                  <p className="text-2xl font-bold tabular-nums leading-none text-foreground">{m.value}</p>
                  <p className="text-[9px] text-muted-foreground/70 leading-tight">{m.sub}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Layer 2: Crypto Sector Impact ────────────────────────────────────── */}
        <section className="animate-slide-up-fade animation-delay-200 space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Crypto Sector Impact</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-3">
            {sectors.map((s) => {
              const style = IMPACT_STYLES[s.impact];
              return (
                <div
                  key={s.sector}
                  className={`rounded-3xl border p-3.5 flex flex-col gap-2 ${style.bg}`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xl leading-none">{s.icon}</span>
                    <span className={`text-[9px] font-bold uppercase tracking-[0.14em] ${style.text}`}>
                      {style.label}
                    </span>
                  </div>
                  <p className="text-xs font-bold text-foreground leading-tight">{s.sector}</p>
                  <p className="text-[9px] text-muted-foreground/70 leading-tight">{s.driver}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Layer 3: Lyra Prompt Chips ─────────────────────────────────────── */}
        <section className="animate-slide-up-fade animation-delay-300 space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Ask Lyra</p>
          <div className="flex flex-wrap gap-2">
            {LYRA_PROMPTS_CRYPTO.map((prompt) => (
              <Link
                key={prompt}
                href={`/dashboard/lyra?q=${encodeURIComponent(prompt)}`}
                className="inline-flex items-center gap-2 rounded-2xl border border-primary/20 bg-primary/8 px-4 py-2.5 text-[11px] font-bold text-primary hover:bg-primary/15 hover:border-primary/40 transition-all duration-200 max-w-full sm:max-w-[420px]"
              >
                <Bot className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{prompt}</span>
                <ArrowRight className="h-3 w-3 shrink-0 opacity-60" />
              </Link>
            ))}
          </div>
        </section>

        {/* ── Snapshot freshness notice ──────────────────────────────────────── */}
        <p className="text-[9px] text-muted-foreground/50 mt-2">
          On-chain data: real-time snapshot · live data integration coming soon
        </p>

      </div>
    </SectionErrorBoundary>
  );
}
