"use client";

import { useRegion } from "@/lib/context/RegionContext";
import useSWR from "swr";
import Link from "next/link";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Zap,
  BarChart3,
  Target,
  Activity,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface SectorRegime {
  regime: string;
  regimeScore: number;
  participationRate: number;
  relativeStrength: number;
  rotationMomentum: number;
  leadershipScore: number;
}

interface Sector {
  id: string;
  name: string;
  slug: string;
  _count: { assetSectors: number };
  latestRegime: SectorRegime | null;
}

function getScoreColor(score: number): string {
  if (score >= 70) return "text-success";
  if (score >= 40) return "text-cyan-400";
  return "text-danger";
}

function getScoreBg(score: number): string {
  if (score >= 70) return "bg-success/10 border-success/20";
  if (score >= 40) return "bg-cyan-400/10 border-cyan-400/20";
  return "bg-danger/10 border-danger/20";
}

export function DiscoveryMarketPulse() {
  const { region } = useRegion();

  const { data: sectors } = useSWR<Sector[]>(
    `/api/discovery/sectors?region=${region}`,
    fetcher,
    { revalidateOnFocus: false, keepPreviousData: true },
  );

  if (!sectors || sectors.length === 0) return null;

  const withRegime = sectors.filter(s => s.latestRegime);
  if (withRegime.length === 0) return null;

  const scores = withRegime.map(s => s.latestRegime!.regimeScore);
  const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  const maxSector = withRegime.reduce((a, b) => (a.latestRegime!.regimeScore > b.latestRegime!.regimeScore ? a : b));
  const minSector = withRegime.reduce((a, b) => (a.latestRegime!.regimeScore < b.latestRegime!.regimeScore ? a : b));

  const riskOn = withRegime.filter(s => s.latestRegime!.regimeScore >= 70).length;
  const neutral = withRegime.filter(s => s.latestRegime!.regimeScore >= 40 && s.latestRegime!.regimeScore < 70).length;
  const defensive = withRegime.filter(s => s.latestRegime!.regimeScore < 40).length;

  // Top 5 trending (highest momentum)
  const trending = [...withRegime]
    .sort((a, b) => (b.latestRegime!.rotationMomentum) - (a.latestRegime!.rotationMomentum))
    .slice(0, 5);

  return (
    <div className="space-y-4">
      {/* Market Pulse Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg md:text-xl font-bold tracking-tighter uppercase premium-gradient-text flex items-center gap-2">
          <Activity className="h-5 w-5" /> Market Pulse
        </h2>
        <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest opacity-40">
          {withRegime.length} Sectors Analyzed
        </span>
      </div>

      <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-12">
        {/* Regime Overview Card */}
        <div className="md:col-span-4 rounded-2xl border border-white/5 bg-card/60 backdrop-blur-2xl shadow-xl p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 rounded-2xl bg-primary/10 border border-primary/20">
              <Target className="h-3.5 w-3.5 text-primary" />
            </div>
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-[0.15em]">Regime Overview</h3>
          </div>

          {/* Average Score */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest opacity-80">Avg Regime Score</p>
              <p className={cn("text-3xl font-bold font-mono tracking-tight", getScoreColor(avgScore))}>{avgScore}</p>
            </div>
            <div className={cn("px-3 py-2 rounded-2xl border text-center", getScoreBg(avgScore))}>
              <p className={cn("text-[10px] font-bold uppercase tracking-widest", getScoreColor(avgScore))}>
                {avgScore >= 70 ? "Risk On" : avgScore >= 40 ? "Neutral" : "Defensive"}
              </p>
            </div>
          </div>

          {/* Regime Distribution */}
          <div className="space-y-2">
            <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest opacity-40">Distribution</p>
            <div className="flex gap-1 h-3 rounded-full overflow-hidden">
              {riskOn > 0 && <div className="bg-success rounded-full transition-all duration-700" style={{ width: `${(riskOn / withRegime.length) * 100}%` }} />}
              {neutral > 0 && <div className="bg-warning rounded-full transition-all duration-700" style={{ width: `${(neutral / withRegime.length) * 100}%` }} />}
              {defensive > 0 && <div className="bg-danger rounded-full transition-all duration-700" style={{ width: `${(defensive / withRegime.length) * 100}%` }} />}
            </div>
            <div className="flex justify-between text-[8px] font-bold uppercase tracking-widest">
              <span className="text-success">{riskOn} Risk On</span>
              <span className="text-warning">{neutral} Neutral</span>
              <span className="text-danger">{defensive} Defensive</span>
            </div>
          </div>

          {/* Best / Worst */}
          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border/20">
            <div>
              <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest opacity-40 mb-1">Strongest</p>
              <Link href={`/dashboard/discovery/${maxSector.slug}`} className="hover:text-primary transition-colors">
                <p className="text-[10px] font-bold tracking-tight truncate">{maxSector.name}</p>
                <p className={cn("text-xs font-bold font-mono", getScoreColor(maxSector.latestRegime!.regimeScore))}>{maxSector.latestRegime!.regimeScore}/100</p>
              </Link>
            </div>
            <div>
              <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest opacity-40 mb-1">Weakest</p>
              <Link href={`/dashboard/discovery/${minSector.slug}`} className="hover:text-primary transition-colors">
                <p className="text-[10px] font-bold tracking-tight truncate">{minSector.name}</p>
                <p className={cn("text-xs font-bold font-mono", getScoreColor(minSector.latestRegime!.regimeScore))}>{minSector.latestRegime!.regimeScore}/100</p>
              </Link>
            </div>
          </div>
        </div>

        {/* Trending Themes */}
        <div className="md:col-span-4 rounded-2xl border border-white/5 bg-card/60 backdrop-blur-2xl shadow-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-2xl bg-primary/10 border border-primary/20">
                <Zap className="h-3.5 w-3.5 text-primary" />
              </div>
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-[0.15em]">Trending Themes</h3>
            </div>
          </div>
          <div className="space-y-1">
            {trending.map((s, i) => {
              const mom = s.latestRegime!.rotationMomentum;
              const isPositive = mom > 0;
              const MomIcon = mom > 5 ? TrendingUp : mom < -5 ? TrendingDown : Minus;
              return (
                <Link key={s.id} href={`/dashboard/discovery-stocks/${s.slug}`}>
                  <div className="flex items-center justify-between py-2.5 px-3 rounded-2xl hover:bg-muted/20 transition-colors group cursor-pointer">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-[10px] font-bold text-muted-foreground/30 w-4">{i + 1}</span>
                      <div className="min-w-0">
                        <p className="text-xs font-bold tracking-tight truncate group-hover:text-primary transition-colors">{s.name}</p>
                        <p className="text-[9px] text-muted-foreground/40">{s._count.assetSectors} assets</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className={cn("flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-xl border", isPositive ? "text-success bg-success/10 border-success/20" : "text-danger bg-danger/10 border-danger/20")}>
                        <MomIcon className="h-2.5 w-2.5" />
                        {isPositive ? "+" : ""}{mom.toFixed(1)}
                      </div>
                      <ChevronRight className="h-3 w-3 text-muted-foreground/20 group-hover:text-primary transition-colors" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Sector Score Heatmap */}
        <div className="md:col-span-4 rounded-2xl border border-white/5 bg-card/60 backdrop-blur-2xl shadow-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-2xl bg-primary/10 border border-primary/20">
                <BarChart3 className="h-3.5 w-3.5 text-primary" />
              </div>
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-[0.15em]">Score Heatmap</h3>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {withRegime
              .sort((a, b) => b.latestRegime!.regimeScore - a.latestRegime!.regimeScore)
              .map(s => {
                const sc = s.latestRegime!.regimeScore;
                return (
                  <Link key={s.id} href={`/dashboard/discovery-stocks/${s.slug}`}>
                    <div
                      className={cn(
                        "px-2.5 py-1.5 rounded-2xl border text-[9px] font-bold tracking-tight hover:scale-105 transition-all cursor-pointer",
                        getScoreBg(sc), getScoreColor(sc)
                      )}
                      title={`${s.name}: ${sc}/100`}
                    >
                      <span className="opacity-90">{s.name.length > 14 ? s.name.slice(0, 12) + "…" : s.name}</span>
                      <span className="ml-1 font-bold">{sc}</span>
                    </div>
                  </Link>
                );
              })}
          </div>
        </div>
      </div>
    </div>
  );
}
