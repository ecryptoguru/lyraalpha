"use client";

import Link from "next/link";
import useSWR from "swr";
import { Activity, AlertTriangle, ChevronDown, ChevronUp, Crown, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { getFriendlySymbol } from "@/lib/format-utils";
import type { PersonalBriefingResponse } from "@/lib/services/personal-briefing.service";
import type { PersonalBriefingAIMemo } from "@/lib/services/personal-briefing-ai.service";

export function DashboardPersonalSignalsCard({
  data,
  expanded = false,
  locked = false,
  region,
}: {
  data: PersonalBriefingResponse | null;
  expanded?: boolean;
  locked?: boolean;
  region: "US" | "IN";
}) {
  const briefing = data?.briefing ?? null;
  const { data: aiData } = useSWR(
    !locked && briefing ? `/api/lyra/personal-briefing-ai?region=${region}` : null,
    async (url: string) => {
      const response = await fetch(url);
      if (!response.ok) return null;
      return (await response.json()) as { success?: boolean; memo?: PersonalBriefingAIMemo | null };
    },
    { revalidateOnFocus: false, dedupingInterval: 300_000 },
  );

  const aiMemo = aiData?.memo ?? null;

  if (locked) {
    return (
      <div className="rounded-2xl border border-primary/25 bg-primary/5 backdrop-blur-2xl overflow-hidden">
        <div className="p-4 space-y-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-2xl bg-primary/15 border border-primary/20">
              <Crown className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="text-left">
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-primary">Personalized signals</p>
              <p className="text-xs text-muted-foreground/80 mt-0.5 leading-relaxed max-w-lg">
                Unlock watchlist-aware morning signals and regime alerts with Elite.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-primary/20 bg-background/60 px-4 py-4">
            <p className="text-sm font-bold text-foreground">Elite-only morning personalization</p>
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
              Get a home feed that highlights your strongest watchlist signals, regime misalignment and momentum inflections automatically.
            </p>
            <Link
              href="/dashboard/upgrade"
              className="inline-flex items-center gap-2 mt-3 text-[11px] font-bold uppercase tracking-[0.16em] text-primary hover:text-primary/80 transition-colors"
            >
              Upgrade for personalized signals
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!briefing) {
    const isEmptyWatchlist = data?.reason === "empty_watchlist";

    return (
      <div className="rounded-2xl border border-primary/25 bg-primary/5 backdrop-blur-2xl overflow-hidden">
        <div className="p-4 space-y-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-2xl bg-primary/15 border border-primary/20">
              <Crown className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="text-left">
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-primary">Personalized signals</p>
              <p className="text-xs text-muted-foreground/80 mt-0.5 leading-relaxed max-w-lg">
                {isEmptyWatchlist
                  ? "Add a few assets to your watchlist to unlock a watchlist-aware morning brief."
                  : "Your watchlist exists, but the linked market data is still thin. Review your tracked symbols to strengthen this feed."}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Link
              href="/dashboard/portfolio"
              className="rounded-2xl border border-white/10 bg-card/60 px-4 py-3 hover:border-primary/25 hover:bg-primary/5 transition-colors"
            >
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Portfolio context</p>
              <p className="mt-2 text-sm font-bold text-foreground">Review your portfolio</p>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                Portfolio health, concentration and fragility signals will appear here once your context is available.
              </p>
            </Link>

            <Link
              href="/dashboard/watchlist"
              className="rounded-2xl border border-white/10 bg-card/60 px-4 py-3 hover:border-primary/25 hover:bg-primary/5 transition-colors"
            >
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Watchlist context</p>
              <p className="mt-2 text-sm font-bold text-foreground">{isEmptyWatchlist ? "Curate your watchlist" : "Review tracked symbols"}</p>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                {isEmptyWatchlist
                  ? "Track at least 3 assets and this card will start surfacing momentum leaders and regime-misaligned names."
                  : "Some watchlist entries are not resolving to strong asset data yet. Refresh your list with active tracked symbols to improve this card."}
              </p>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-primary/25 bg-primary/5 backdrop-blur-2xl overflow-hidden">
      <div className="w-full flex items-center justify-between p-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-2xl bg-primary/15 border border-primary/20">
            <Crown className="h-3.5 w-3.5 text-primary" />
          </div>
          <div className="text-left">
            <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-primary">Personalized signals</p>
            <p className="text-xs text-muted-foreground/80 mt-0.5 leading-relaxed max-w-lg">{briefing.summary}</p>
          </div>
        </div>
        <div className="shrink-0 ml-3">
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </div>

      {aiMemo && (
        <div className="px-4 pb-4">
          <div className="rounded-2xl border border-primary/15 bg-primary/8 p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-primary">Lyra morning brief</p>
                <p className="mt-1 text-sm font-semibold text-foreground">{aiMemo.headline}</p>
              </div>
              <Sparkles className="h-4 w-4 text-primary shrink-0" />
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">{aiMemo.summary}</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/8 bg-card/40 p-3">
                <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Focus</p>
                <p className="mt-1 text-xs leading-relaxed text-foreground">{aiMemo.focus}</p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-card/40 p-3">
                <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Next step</p>
                <p className="mt-1 text-xs leading-relaxed text-foreground">{aiMemo.nextAction}</p>
              </div>
            </div>
            {aiMemo.bullets.length > 0 && (
              <div className="space-y-1.5">
                {aiMemo.bullets.map((bullet) => (
                  <div key={bullet} className="flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                    <span>{bullet}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-primary/10">
          {briefing.topAssets.length > 0 && (
            <div className="pt-3">
              <p className="text-[8px] font-bold uppercase tracking-[0.18em] text-muted-foreground mb-2">Top watchlist signals</p>
              <div className="space-y-1.5">
                {briefing.topAssets.map((asset) => (
                  <Link
                    key={asset.symbol}
                    href={`/dashboard/assets/${asset.symbol}`}
                    className="flex items-center justify-between py-1.5 px-2.5 rounded-2xl border border-border/30 bg-card/60 backdrop-blur-2xl shadow-xl hover:border-primary/30 hover:bg-primary/5 transition-all group"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-5 h-5 rounded bg-primary/10 border border-primary/20 flex items-center justify-center text-[7px] font-bold text-primary shrink-0">
                        {getFriendlySymbol(asset.symbol, asset.type, asset.name).slice(0, 2)}
                      </div>
                      <span className="text-[10px] font-bold truncate group-hover:text-primary transition-colors">
                        {getFriendlySymbol(asset.symbol, asset.type, asset.name)}
                      </span>
                      {asset.signalLabel && (
                        <span className="text-[8px] text-muted-foreground hidden sm:inline">{asset.signalLabel}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {asset.signalScore != null && (
                        <span className={cn(
                          "text-[9px] font-bold",
                          asset.signalScore >= 70 ? "text-success" : asset.signalScore >= 50 ? "text-warning" : "text-danger",
                        )}>
                          {Math.round(asset.signalScore)}
                        </span>
                      )}
                      {asset.changePercent != null && (
                        <span className={cn(
                          "text-[9px] font-bold flex items-center gap-0.5",
                          asset.changePercent >= 0 ? "text-success" : "text-danger",
                        )}>
                          {asset.changePercent >= 0 ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                          {asset.changePercent >= 0 ? "+" : ""}{asset.changePercent.toFixed(1)}%
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            {briefing.strongMomentum.length > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-success/30 bg-success/8">
                <Activity className="h-2.5 w-2.5 text-success" />
                <span className="text-[8px] font-bold text-success">
                  Strong momentum: {briefing.strongMomentum.slice(0, 3).map((symbol) => {
                    const asset = briefing.topAssets.find((item) => item.symbol === symbol);
                    return getFriendlySymbol(symbol, asset?.type, asset?.name);
                  }).join(", ")}
                </span>
              </div>
            )}
            {briefing.misaligned.length > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-warning/30 bg-warning/8">
                <AlertTriangle className="h-2.5 w-2.5 text-warning" />
                <span className="text-[8px] font-bold text-warning">
                  Regime-misaligned: {briefing.misaligned.slice(0, 3).map((symbol) => {
                    const asset = briefing.topAssets.find((item) => item.symbol === symbol);
                    return getFriendlySymbol(symbol, asset?.type, asset?.name);
                  }).join(", ")}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
