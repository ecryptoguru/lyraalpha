import { TrendingUp, TrendingDown, Activity, Target } from "lucide-react";
import { RegimeBadge } from "./RegimeBadge";
import { cn } from "@/lib/utils";

interface SectorRegimeCardProps {
  sectorName: string;
  regime: string;
  regimeScore: number;
  participationRate: number;
  relativeStrength: number;
  rotationMomentum: number;
  leadershipScore: number;
  className?: string;
}

export function SectorRegimeCard({
  sectorName,
  regime,
  regimeScore,
  participationRate,
  relativeStrength,
  rotationMomentum,
  leadershipScore,
  className,
}: SectorRegimeCardProps) {
  return (
    <div className={cn("rounded-xl border border-border bg-card p-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">{sectorName}</h3>
        <RegimeBadge regime={regime} size="md" />
      </div>

      {/* Regime Score */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm text-muted-foreground">Regime Score</span>
          <span className="text-2xl font-bold text-amber-600">
            {regimeScore.toFixed(0)}
          </span>
        </div>
        <div className="h-2 bg-muted/60 rounded-full overflow-hidden">
          <div
            className="h-full bg-amber-500 rounded-full transition-all"
            style={{ width: `${regimeScore}%` }}
          />
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Participation Rate */}
        <div className="p-3 rounded-xl bg-muted/30">
          <div className="flex items-center gap-2 mb-1">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Participation</span>
          </div>
          <p className="text-lg font-semibold text-foreground">
            {participationRate.toFixed(1)}%
          </p>
        </div>

        {/* Relative Strength */}
        <div className="p-3 rounded-xl bg-muted/30">
          <div className="flex items-center gap-2 mb-1">
            <Target className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Rel. Strength</span>
          </div>
          <p
            className={cn(
              "text-lg font-semibold",
              relativeStrength > 0 ? "text-green-600" : "text-red-600",
            )}
          >
            {relativeStrength > 0 ? "+" : ""}
            {relativeStrength.toFixed(1)}%
          </p>
        </div>

        {/* Rotation Momentum */}
        <div className="p-3 rounded-xl bg-muted/30">
          <div className="flex items-center gap-2 mb-1">
            {rotationMomentum > 0 ? (
              <TrendingUp className="h-4 w-4 text-green-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-500" />
            )}
            <span className="text-xs text-muted-foreground">Rotation</span>
          </div>
          <p
            className={cn(
              "text-lg font-semibold",
              rotationMomentum > 0 ? "text-green-600" : "text-red-600",
            )}
          >
            {rotationMomentum > 0 ? "+" : ""}
            {rotationMomentum.toFixed(1)}
          </p>
        </div>

        {/* Leadership Score */}
        <div className="p-3 rounded-xl bg-muted/30">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-muted-foreground">Leadership</span>
          </div>
          <p className="text-lg font-semibold text-cyan-600">
            {leadershipScore.toFixed(0)}
          </p>
        </div>
      </div>
    </div>
  );
}
