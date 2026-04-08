import { cookies } from "next/headers";
import Link from "next/link";
import {
  FlaskConical,
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowRight,
  Bot,
} from "lucide-react";

import { PageHeader, StatChip } from "@/components/dashboard/page-header";
import { SectionErrorBoundary } from "@/components/error-boundary";
import { MacroResearchService } from "@/lib/services/macro-research.service";
import type { MacroDirection, SectorImpact } from "@/lib/macro/types";

function DirectionIcon({ direction }: { direction: MacroDirection }) {
  if (direction === "up")   return <TrendingUp  className="h-5 w-5 text-emerald-400 shrink-0" />;
  if (direction === "down") return <TrendingDown className="h-5 w-5 text-rose-400    shrink-0" />;
  return <Minus className="h-5 w-5 text-muted-foreground shrink-0" />;
}

const IMPACT_STYLES: Record<SectorImpact, { bg: string; text: string; label: string }> = {
  tailwind: { bg: "border-emerald-500/25 bg-emerald-500/10", text: "text-emerald-400", label: "Tailwind" },
  headwind: { bg: "border-rose-500/25    bg-rose-500/10",    text: "text-rose-400",    label: "Headwind" },
  neutral:  { bg: "border-white/10       bg-card/60",        text: "text-muted-foreground", label: "Neutral"  },
};

const INDICATOR_COLOR: Record<MacroDirection, string> = {
  up:   "border-emerald-500/20 bg-emerald-500/5",
  down: "border-rose-500/20    bg-rose-500/5",
  flat: "border-white/10       bg-card/60",
};

const LYRA_PROMPTS_US = [
  "What does the current Fed stance mean for US equity sectors?",
  "Which sectors benefit most from today's macro regime?",
  "How does the current inflation trajectory affect growth stocks?",
];

const LYRA_PROMPTS_IN = [
  "What does the RBI rate cut mean for NIFTY Bank and NBFCs?",
  "Which sectors benefit most from India's current fiscal and monetary mix?",
  "How does the current CPI trend affect Indian consumer stocks?",
];

export default async function MacroResearchPage() {
  const cookieStore = await cookies();
  const region = cookieStore.get("user_region_preference")?.value === "IN" ? "IN" as const : "US" as const;

  const { snapshot, sectors } = await MacroResearchService.getData(region);

  const gdp     = snapshot.indicators.find((i) => i.id === "gdp");
  const cpi     = snapshot.indicators.find((i) => i.id === "cpi");
  const policy  = snapshot.indicators.find((i) => i.id === "fed" || i.id === "rbi");

  const lyraPrompts = region === "IN" ? LYRA_PROMPTS_IN : LYRA_PROMPTS_US;
  const tailwinds   = sectors.filter((s) => s.impact === "tailwind").length;
  const headwinds   = sectors.filter((s) => s.impact === "headwind").length;

  return (
    <SectionErrorBoundary>
      <div className="relative flex flex-col gap-6 p-3 sm:p-4 md:p-6 pb-8 min-w-0 overflow-x-hidden">

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="animate-slide-up-fade">
          <PageHeader
            icon={<FlaskConical className="h-5 w-5" />}
            title="Research"
            eyebrow="Economy → Sector → Company"
            chips={
              <>
                <StatChip value={region} label="Market" variant="muted" />
                {gdp    && <StatChip value={gdp.value}    label="GDP"    variant={gdp.direction    === "up" ? "green" : gdp.direction === "down" ? "red" : "muted"} />}
                {cpi    && <StatChip value={cpi.value}    label="CPI"    variant={cpi.direction    === "down" ? "green" : "red"} />}
                {policy && <StatChip value={policy.value} label={region === "IN" ? "RBI Rate" : "Fed Rate"} variant={policy.direction === "down" ? "green" : policy.direction === "flat" ? "muted" : "red"} />}
                <StatChip value={tailwinds} label="Tailwinds" variant="green" />
                {headwinds > 0 && <StatChip value={headwinds} label="Headwinds" variant="red" />}
              </>
            }
          />
        </div>

        {/* ── Layer 1: Economy Indicators ────────────────────────────────────── */}
        <section className="animate-slide-up-fade animation-delay-100 space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Economy</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {snapshot.indicators.map((ind) => (
              <div
                key={ind.id}
                className={`rounded-3xl border p-4 flex flex-col gap-2 ${INDICATOR_COLOR[ind.direction]}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground leading-tight">
                    {ind.label}
                  </p>
                  <DirectionIcon direction={ind.direction} />
                </div>
                <p className="text-2xl font-bold tabular-nums leading-none text-foreground">
                  {ind.value}
                </p>
                <p className="text-[9px] text-muted-foreground/70 leading-tight">{ind.context}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Layer 2: Sector Impact Grid ────────────────────────────────────── */}
        <section className="animate-slide-up-fade animation-delay-200 space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Sector Impact</p>
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
          Economy data: static snapshot · last updated {snapshot.updatedAt} · current data integration coming soon
        </p>

      </div>
    </SectionErrorBoundary>
  );
}
