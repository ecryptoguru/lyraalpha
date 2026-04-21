"use client";

import { useState, useMemo, useCallback, memo } from "react";
import { TrendingUp, TrendingDown, Shield, Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useViewMode } from "@/components/dashboard/view-mode-context";
import { getFriendlyAssetSubtitle, getFriendlySymbol } from "@/lib/format-utils";

interface SignalLeaderboardAsset {
  symbol: string;
  name: string;
  type: string;
  signalStrength: number;
  regimeFit: number;
  trustScore: number;
  layers: {
    regime: number;
    technical: number;
    fundamental: number;
    sentiment: number;
  };
}

interface SignalLeaderboardProps {
  assets: SignalLeaderboardAsset[];
  className?: string;
}

export const SignalLeaderboard = memo(function SignalLeaderboard({ assets, className }: SignalLeaderboardProps) {
  const { mode } = useViewMode();
  const [filter, setFilter] = useState<"all" | "crypto">("all");

  const filteredAssets = useMemo(() => assets
    .filter((asset) => {
      if (filter === "all") return true;
      if (filter === "crypto") return asset.type === "CRYPTO";
      return true;
    })
    .slice(0, mode === "simple" ? 10 : 20), [assets, filter, mode]);

  const getSignalColor = useCallback((score: number) => {
    if (score >= 70) return "text-success";
    if (score >= 50) return "text-primary";
    if (score >= 30) return "text-warning";
    return "text-danger";
  }, []);

  const getRegimeFitBadge = useCallback((fit: number) => {
    if (fit >= 70) return { label: "Strong Fit", variant: "default" as const };
    if (fit >= 50) return { label: "Moderate", variant: "secondary" as const };
    return { label: "Weak Fit", variant: "outline" as const };
  }, []);

  if (mode === "simple") {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="text-sm font-semibold">Signal Strength Leaders</span>
            <div className="flex gap-2">
              {(["all", "crypto"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`rounded-xl px-2 py-1 text-xs font-medium transition-colors ${
                    filter === f
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {filteredAssets.map((asset, index) => {
            const fitBadge = getRegimeFitBadge(asset.regimeFit);
            return (
              <div
                key={asset.symbol}
                className="flex items-center gap-3 rounded-2xl border border-white/5 bg-muted/30 p-3 transition-colors hover:bg-muted/50"
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{getFriendlySymbol(asset.symbol, asset.type, asset.name)}</span>
                    <Badge variant={fitBadge.variant} className="text-xs">
                      {fitBadge.label}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{getFriendlyAssetSubtitle(asset.symbol, asset.type, asset.name)}</div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className={`text-lg font-bold ${getSignalColor(asset.signalStrength)}`}>
                      {asset.signalStrength}
                    </div>
                    <div className="text-xs text-muted-foreground">Signal</div>
                  </div>
                  <div className="h-12 w-1 rounded-full" style={{ 
                    background: `linear-gradient(to top, var(--muted) ${100 - asset.signalStrength}%, var(--primary) ${asset.signalStrength}%)` 
                  }} />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    );
  }

  // Advanced mode
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="text-sm font-semibold">Signal Strength Leaderboard</span>
          <div className="flex gap-2">
            {(["all", "crypto"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${
                  filter === f
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-3 border-b pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <div className="col-span-1">#</div>
            <div className="col-span-3">Asset</div>
            <div className="col-span-2 text-center">Signal</div>
            <div className="col-span-2 text-center">Regime Fit</div>
            <div className="col-span-4 text-center">Layer Breakdown</div>
          </div>

          {/* Table Rows */}
          {filteredAssets.map((asset, index) => {
            const fitBadge = getRegimeFitBadge(asset.regimeFit);
            return (
              <div
                key={asset.symbol}
                className="grid grid-cols-12 gap-3 items-center rounded-2xl border border-white/5 bg-muted/30 p-3 transition-colors hover:bg-muted/50"
              >
                {/* Rank */}
                <div className="col-span-1">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                    {index + 1}
                  </div>
                </div>

                {/* Asset Info */}
                <div className="col-span-3">
                  <div className="font-semibold text-sm">{getFriendlySymbol(asset.symbol, asset.type, asset.name)}</div>
                  <div className="text-xs text-muted-foreground truncate">{getFriendlyAssetSubtitle(asset.symbol, asset.type, asset.name)}</div>
                </div>

                {/* Signal Strength */}
                <div className="col-span-2 text-center">
                  <div className={`text-2xl font-bold ${getSignalColor(asset.signalStrength)}`}>
                    {asset.signalStrength}
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted mt-1">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${asset.signalStrength}%` }}
                    />
                  </div>
                </div>

                {/* Regime Fit */}
                <div className="col-span-2 flex flex-col items-center gap-1">
                  <Badge variant={fitBadge.variant} className="text-xs">
                    {fitBadge.label}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{asset.regimeFit}%</span>
                </div>

                {/* Layer Breakdown */}
                <div className="col-span-4 grid grid-cols-4 gap-2">
                  {[
                    { key: "regime", label: "R", icon: Activity },
                    { key: "technical", label: "T", icon: TrendingUp },
                    { key: "fundamental", label: "F", icon: Shield },
                    { key: "sentiment", label: "S", icon: TrendingDown },
                  ].map((layer) => {
                    const value = asset.layers[layer.key as keyof typeof asset.layers];
                    const Icon = layer.icon;
                    return (
                      <div key={layer.key} className="flex flex-col items-center">
                        <Icon className={`h-3 w-3 ${getSignalColor(value)}`} />
                        <span className={`text-xs font-semibold ${getSignalColor(value)}`}>
                          {value}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
});
