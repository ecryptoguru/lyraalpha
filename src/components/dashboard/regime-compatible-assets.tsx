"use client";

import { memo, useMemo, useCallback } from "react";
import { Shield, TrendingUp, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useViewMode } from "@/components/dashboard/view-mode-context";
import { getFriendlyAssetSubtitle, getFriendlySymbol } from "@/lib/format-utils";

// Display configuration
const SIMPLE_MODE_LIMIT = 5;
const ADVANCED_MODE_LIMIT = 15;
const COMPATIBILITY_THRESHOLD_HIGH = 80;
const COMPATIBILITY_THRESHOLD_MODERATE = 60;

interface RegimeCompatibleAsset {
  symbol: string;
  name: string;
  type: string;
  compatibilityScore: number;
  compatibilityLabel: string;
  signalStrength: number;
  fragilityScore?: number;
  factorAlignment?: {
    value: number;
    growth: number;
    momentum: number;
    lowVol: number;
  };
}

interface RegimeCompatibleAssetsProps {
  assets: RegimeCompatibleAsset[];
  currentRegime: string;
  className?: string;
}


/**
 * Phase 3 Step 2.9: Regime-Compatible Assets Panel
 * 
 * Auto-curated list of assets with highest ARCS (regime compatibility).
 * Shows top assets that fit the current market environment.
 */
export const RegimeCompatibleAssets = memo(function RegimeCompatibleAssets({
  assets,
  currentRegime,
  className,
}: RegimeCompatibleAssetsProps) {
  const { mode } = useViewMode();

  const strongFitAssets = useMemo(
    () =>
      assets
        .filter((asset) => asset.compatibilityLabel === "STRONG_FIT")
        .sort((a, b) => b.compatibilityScore - a.compatibilityScore)
        .slice(0, mode === "simple" ? SIMPLE_MODE_LIMIT : ADVANCED_MODE_LIMIT),
    [assets, mode]
  );

  const getCompatibilityColor = useCallback((score: number) => {
    if (score >= COMPATIBILITY_THRESHOLD_HIGH) return "text-green-600";
    if (score >= COMPATIBILITY_THRESHOLD_MODERATE) return "text-amber-600";
    return "text-yellow-600";
  }, []);

  if (strongFitAssets.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Shield className="h-5 w-5" />
            Regime-Compatible Assets
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No strong-fit assets found for current regime.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (mode === "simple") {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Shield className="h-5 w-5" />
            Regime-Compatible Assets
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            These assets fit the current {currentRegime.replace(/_/g, " ")} environment
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          {strongFitAssets.map((asset, index) => (
            <div
              key={asset.symbol}
              className="flex items-center gap-3 rounded-2xl border border-white/5 bg-muted/30 p-3 transition-colors hover:bg-muted/50"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                {index + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">{getFriendlySymbol(asset.symbol, asset.type, asset.name)}</span>
                  <Badge variant="default" className="text-xs">
                    {asset.compatibilityScore}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground truncate">{getFriendlyAssetSubtitle(asset.symbol, asset.type, asset.name)}</div>
              </div>
              <div className="text-right">
                <div className={`text-lg font-bold ${getCompatibilityColor(asset.compatibilityScore)}`}>
                  {asset.signalStrength}
                </div>
                <div className="text-xs text-muted-foreground">Signal</div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  // Advanced mode
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Shield className="h-5 w-5" />
          Regime-Compatible Assets
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Top {strongFitAssets.length} assets aligned with {currentRegime.replace(/_/g, " ")}
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-3 border-b pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <div className="col-span-1">#</div>
            <div className="col-span-4">Asset</div>
            <div className="col-span-2 text-center">ARCS</div>
            <div className="col-span-2 text-center">Signal</div>
            <div className="col-span-3 text-center">Factor Alignment</div>
          </div>

          {/* Table Rows */}
          {strongFitAssets.map((asset, index) => (
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
              <div className="col-span-4">
                <div className="font-semibold text-sm">{getFriendlySymbol(asset.symbol, asset.type, asset.name)}</div>
                <div className="text-xs text-muted-foreground truncate">{getFriendlyAssetSubtitle(asset.symbol, asset.type, asset.name)}</div>
              </div>

              {/* ARCS Score */}
              <div className="col-span-2 text-center">
                <div className={`text-xl font-bold ${getCompatibilityColor(asset.compatibilityScore)}`}>
                  {asset.compatibilityScore}
                </div>
                <Badge variant="default" className="text-xs mt-1">
                  Strong Fit
                </Badge>
              </div>

              {/* Signal Strength */}
              <div className="col-span-2 text-center">
                <div className="text-lg font-bold">{asset.signalStrength}</div>
                {asset.fragilityScore !== undefined && (
                  <div className="text-xs text-muted-foreground">
                    Fragility: {asset.fragilityScore}
                  </div>
                )}
              </div>

              {/* Factor Alignment */}
              <div className="col-span-3">
                {asset.factorAlignment ? (
                  <div className="grid grid-cols-2 gap-1 text-xs">
                    <div className="flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" />
                      <span>V:{asset.factorAlignment.value}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Zap className="h-3 w-3" />
                      <span>G:{asset.factorAlignment.growth}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" />
                      <span>M:{asset.factorAlignment.momentum}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Shield className="h-3 w-3" />
                      <span>L:{asset.factorAlignment.lowVol}</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">N/A</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
});
