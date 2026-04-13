import Link from "next/link";
import {
  AlertTriangle,
  Clock,
  Compass,
  Sparkles,
} from "lucide-react";
import { getFriendlySymbol } from "@/lib/format-utils";
import type { DailyBriefing } from "@/lib/services/daily-briefing.service";
import type { DashboardNarrativePreview } from "@/lib/services/dashboard-home.service";
import { ShareInsightButton } from "@/components/dashboard/share-insight-button";
import { formatRelativeTime } from "@/lib/format-relative-time";

function formatTimeAgo(isoString: string): string {
  return formatRelativeTime(isoString);
}

export function DashboardMarketBriefCard({
  briefing,
  narrativePreview,
}: {
  briefing: DailyBriefing | null;
  narrativePreview: DashboardNarrativePreview | null;
}) {
  if (!briefing) {
    return (
      <div className="rounded-3xl border border-primary/20 bg-linear-to-br from-primary/5 via-card/40 to-card/30 backdrop-blur-xl overflow-hidden transition-[border-color,background-color,box-shadow] duration-500 p-5 md:p-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-2xl bg-primary/10 border border-primary/20 shadow-lg shadow-primary/5">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-[0.2em]">Market intelligence</h3>
            <p className="text-[10px] text-muted-foreground font-mono flex items-center gap-1 mt-0.5">
              <Clock className="h-2.5 w-2.5" />
              Preparing today&apos;s merged market view
            </p>
          </div>
        </div>

        <p className="mt-4 text-sm text-foreground/75 leading-relaxed border-l-2 border-primary/20 pl-4">
          Today&apos;s market brief is not ready yet. Discovery, portfolio and narrative signals will still load below.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/dashboard/discovery"
            className="inline-flex items-center rounded-2xl border border-primary/20 bg-primary/10 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-primary hover:bg-primary/15 transition-colors"
          >
            Open discovery
          </Link>
          <Link
            href="/dashboard/lyra"
            className="inline-flex items-center rounded-2xl border border-white/10 bg-card/60 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground hover:border-primary/20 transition-colors"
          >
            Ask Lyra
          </Link>
        </div>
      </div>
    );
  }

  return (
    <section className="rounded-3xl border border-primary/20 bg-linear-to-br from-primary/5 via-card/40 to-card/30 backdrop-blur-xl overflow-hidden transition-[border-color,background-color,box-shadow] duration-500 p-5 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-2xl bg-primary/10 border border-primary/20 shadow-lg shadow-primary/5">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-[0.2em]">Market intelligence</h3>
            <p className="text-[9px] text-muted-foreground font-mono flex items-center gap-1 mt-0.5">
              <Clock className="h-2.5 w-2.5" />
              {formatTimeAgo(briefing.generatedAt)} · {briefing.regimeLabel}
            </p>
            {briefing.source === "live_fallback" ? (
              <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.16em] text-amber-300">
                Fallback briefing
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground/50">
          <span>Daily</span>
          <span className="h-1 w-1 rounded-full bg-primary/40" />
          <span>Visual brief</span>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 xl:grid-cols-[1.08fr_0.92fr] gap-4">
        <article className="rounded-3xl border border-white/10 bg-background/55 p-4 md:p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.16em] text-primary">
                {briefing.regimeLabel}
              </span>
              <span className="inline-flex items-center rounded-full border border-white/10 bg-card/70 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                {briefing.source === "live_fallback" ? "Fallback brief" : "Cached brief"}
              </span>
            </div>
          </div>

          <p className="max-w-3xl text-sm md:text-[15px] text-foreground/80 leading-relaxed">
            {briefing.marketOverview}
          </p>

          {briefing.source === "live_fallback" ? (
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-amber-300">Why this brief differs</p>
              <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
                The scheduled brief is still warming up, so this view is stitched together from current regime, movers and fresh discovery signals.
              </p>
            </div>
          ) : null}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-2xl border border-white/10 bg-card/60 p-3">
              <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Insights</p>
              <p className="mt-2 text-xl font-bold text-foreground">{briefing.keyInsights.length}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-card/60 p-3">
              <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Risks</p>
              <p className="mt-2 text-xl font-bold text-foreground">{briefing.risksToWatch.length}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-card/60 p-3">
              <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Gainer</p>
              <p className="mt-2 text-sm font-bold text-emerald-400 truncate">
                {briefing.topMovers.gainers[0] ? getFriendlySymbol(briefing.topMovers.gainers[0].symbol, undefined, briefing.topMovers.gainers[0].name) : "—"}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-card/60 p-3">
              <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Loser</p>
              <p className="mt-2 text-sm font-bold text-rose-400 truncate">
                {briefing.topMovers.losers[0] ? getFriendlySymbol(briefing.topMovers.losers[0].symbol, undefined, briefing.topMovers.losers[0].name) : "—"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {briefing.keyInsights.slice(0, 2).map((insight, index) => (
              <div key={insight} className="rounded-2xl border border-white/10 bg-background/65 p-3">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-[10px] font-bold text-primary">
                    {index + 1}
                  </span>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">What matters</p>
                </div>
                <p className="mt-2 text-sm text-foreground/75 leading-relaxed line-clamp-3">{insight}</p>
              </div>
            ))}
            {briefing.risksToWatch.slice(0, 1).map((risk) => (
              <div key={risk} className="rounded-2xl border border-white/10 bg-background/65 p-3 md:col-span-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-rose-400" />
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Risk watch</p>
                </div>
                <p className="mt-2 text-sm text-foreground/75 leading-relaxed">{risk}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-3xl border border-white/10 bg-background/55 p-4 md:p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Narrative pulse</p>
              <h3 className="mt-1 text-lg font-bold tracking-tight text-foreground">What is the market story doing?</h3>
            </div>
            <Compass className="h-4 w-4 text-primary/70" />
          </div>

          {narrativePreview ? (
            <>
              <div className="rounded-2xl border border-white/10 bg-card/60 p-4 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.16em] text-primary">
                    {narrativePreview.strengthLabel}
                  </span>
                  <span className="inline-flex items-center rounded-full border border-white/10 bg-background/70 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                    {narrativePreview.signal ?? "Signal pending"}
                  </span>
                </div>

                <p className="text-sm font-bold text-foreground">{narrativePreview.title}</p>
                <p className="text-sm text-foreground/75 leading-relaxed line-clamp-4">{narrativePreview.summary}</p>

                {narrativePreview.signal ? (
                  <p className="text-[11px] font-semibold text-primary/90">{narrativePreview.signal}</p>
                ) : null}
              </div>

              <div className="rounded-2xl border border-white/10 bg-background/55 p-4 space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Divergence cues</p>
                {narrativePreview.divergences.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {narrativePreview.divergences.map((item) => (
                      <span
                        key={`${item.symbol}-${item.direction}`}
                        className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-primary"
                      >
                        {item.label} · {item.direction.replace(/_/g, " ")}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No divergence chips surfaced yet.</p>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Quick action</p>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href="/dashboard/discovery"
                    className="inline-flex min-h-[38px] items-center gap-2 rounded-2xl border border-primary/20 bg-primary/10 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-primary hover:bg-primary/15 transition-colors"
                  >
                    Open discovery
                  </Link>
                  <ShareInsightButton share={narrativePreview.share} label="Share narrative" className="text-[11px]" />
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-card/60 p-4 text-sm text-muted-foreground">
              The narrative layer is warming up. Once the brief runs, the merged story will appear here.
            </div>
          )}
        </article>
      </div>
    </section>
  );
}
