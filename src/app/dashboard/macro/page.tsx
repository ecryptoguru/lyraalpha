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
import { MacroResearchService } from "@/lib/services/macro-research.service";
import type { SectorImpact } from "@/lib/macro/types";

const IMPACT_STYLES: Record<SectorImpact, { bg: string; text: string; label: string }> = {
  tailwind: { bg: "border-emerald-500/25 bg-emerald-500/10", text: "text-emerald-400", label: "Tailwind" },
  headwind: { bg: "border-rose-500/25    bg-rose-500/10",    text: "text-rose-400",    label: "Headwind" },
  neutral:  { bg: "border-white/10       bg-card/60",        text: "text-muted-foreground", label: "Neutral"  },
};

const LYRA_PROMPTS_CRYPTO = [
  "What does the current BTC dominance trend mean for altcoins?",
  "Which crypto sectors benefit most from today's on-chain activity?",
  "How does the current fear & greed index affect DeFi tokens?",
];

export default async function MacroResearchPage() {
  const cookieStore = await cookies();
  const region = cookieStore.get("user_region_preference")?.value === "IN" ? "IN" as const : "US" as const;

  const { snapshot, sectors } = await MacroResearchService.getData(region);

  const lyraPrompts = LYRA_PROMPTS_CRYPTO;
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
                <StatChip value="BTC" label="Dominance" variant="amber" />
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
            <div className="rounded-3xl border border-amber-500/20 bg-amber-500/5 p-4 flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground leading-tight">BTC Dominance</p>
                <Bitcoin className="h-5 w-5 text-amber-400" />
              </div>
              <p className="text-2xl font-bold tabular-nums leading-none text-foreground">52.4%</p>
              <p className="text-[9px] text-muted-foreground/70 leading-tight">Market cap share</p>
            </div>
            <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/5 p-4 flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground leading-tight">Active Addresses</p>
                <Activity className="h-5 w-5 text-emerald-400" />
              </div>
              <p className="text-2xl font-bold tabular-nums leading-none text-foreground">1.2M</p>
              <p className="text-[9px] text-muted-foreground/70 leading-tight">24h network activity</p>
            </div>
            <div className="rounded-3xl border border-primary/20 bg-primary/5 p-4 flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground leading-tight">DeFi TVL</p>
                <BarChart3 className="h-5 w-5 text-primary" />
              </div>
              <p className="text-2xl font-bold tabular-nums leading-none text-foreground">$48B</p>
              <p className="text-[9px] text-muted-foreground/70 leading-tight">Total value locked</p>
            </div>
            <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/5 p-4 flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground leading-tight">Whale Activity</p>
                <TrendingUp className="h-5 w-5 text-emerald-400" />
              </div>
              <p className="text-2xl font-bold tabular-nums leading-none text-foreground">+12%</p>
              <p className="text-[9px] text-muted-foreground/70 leading-tight">Large holder inflows</p>
            </div>
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
            {lyraPrompts.map((prompt) => (
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
          On-chain data: real-time snapshot · last updated {snapshot.updatedAt} · live data integration coming soon
        </p>

      </div>
    </SectionErrorBoundary>
  );
}
