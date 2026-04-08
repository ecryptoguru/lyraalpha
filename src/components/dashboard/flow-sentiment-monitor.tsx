"use client";

import { memo, useMemo, useCallback } from "react";
import { TrendingUp, TrendingDown, Activity, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getFriendlyAssetSubtitle, getFriendlySymbol } from "@/lib/format-utils";
import { useViewMode } from "@/components/dashboard/view-mode-context";

interface FlowSentimentData {
  symbol: string;
  name: string;
  type: string;
  obvDivergence: number; // -100 to 100
  volumeTrend: "accumulation" | "distribution" | "neutral";
  volumeAcceleration: number; // % change in volume trend
  sentimentScore: number; // 0-100
  priceAction: "bullish" | "bearish" | "neutral";
}

interface FlowSentimentMonitorProps {
  assets: FlowSentimentData[];
  className?: string;
}

/**
 * Phase 3 Step 2.10: Flow & Sentiment Monitor
 * 
 * Tracks OBV divergence, accumulation vs distribution, and volume trend acceleration.
 * Identifies institutional accumulation and exhaustion risk patterns.
 */
export const FlowSentimentMonitor = memo(function FlowSentimentMonitor({
  assets,
  className,
}: FlowSentimentMonitorProps) {
  const { mode } = useViewMode();

  const { accumulationAssets, distributionAssets, divergenceAssets } = useMemo(() => {
    const accumulation = assets.filter((a) => a.volumeTrend === "accumulation").slice(0, 5);
    const distribution = assets.filter((a) => a.volumeTrend === "distribution").slice(0, 5);
    const divergence = assets
      .filter((a) => Math.abs(a.obvDivergence) > 30)
      .sort((a, b) => Math.abs(b.obvDivergence) - Math.abs(a.obvDivergence))
      .slice(0, 5);

    return {
      accumulationAssets: accumulation,
      distributionAssets: distribution,
      divergenceAssets: divergence,
    };
  }, [assets]);


  const getDivergenceLabel = useCallback((divergence: number) => {
    if (divergence > 50) return { label: "Strong Bullish Divergence", color: "text-green-600" };
    if (divergence > 30) return { label: "Bullish Divergence", color: "text-green-500" };
    if (divergence < -50) return { label: "Strong Bearish Divergence", color: "text-red-600" };
    if (divergence < -30) return { label: "Bearish Divergence", color: "text-red-500" };
    return { label: "No Divergence", color: "text-gray-600" };
  }, []);

  if (mode === "simple") {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Activity className="h-5 w-5" />
            Flow & Sentiment
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Accumulation Summary */}
          {accumulationAssets.length > 0 && (
            <div className="rounded-2xl border border-green-200 bg-green-50 p-3">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-green-600" />
                <span className="text-sm font-semibold text-green-900">
                  Institutional Accumulation
                </span>
              </div>
              <p className="text-xs text-green-700">
                Smart money is accumulating in {accumulationAssets.map((a) => a.symbol).join(", ")}
              </p>
            </div>
          )}

          {/* Distribution Warning */}
          {distributionAssets.length > 0 && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-3">
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown className="h-4 w-4 text-red-600" />
                <span className="text-sm font-semibold text-red-900">Exhaustion Risk</span>
              </div>
              <p className="text-xs text-red-700">
                Distribution detected in {distributionAssets.map((a) => a.symbol).join(", ")}
              </p>
            </div>
          )}

          {/* Divergence Alert */}
          {divergenceAssets.length > 0 && (
            <div className="rounded-2xl border border-orange-200 bg-orange-50 p-3">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="h-4 w-4 text-orange-600" />
                <span className="text-sm font-semibold text-orange-900">OBV Divergence</span>
              </div>
              <p className="text-xs text-orange-700">
                {divergenceAssets.length} asset{divergenceAssets.length > 1 ? "s" : ""} showing
                price-volume divergence
              </p>
            </div>
          )}

          {accumulationAssets.length === 0 &&
            distributionAssets.length === 0 &&
            divergenceAssets.length === 0 && (
              <p className="text-sm text-muted-foreground">No significant flow patterns detected.</p>
            )}
        </CardContent>
      </Card>
    );
  }

  // Advanced mode
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Activity className="h-5 w-5" />
          Flow & Sentiment Monitor
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          OBV divergence, accumulation patterns and volume dynamics
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* OBV Divergence Table */}
        {divergenceAssets.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              OBV Divergence
            </div>
            <div className="space-y-2">
              {divergenceAssets.map((asset) => {
                const divLabel = getDivergenceLabel(asset.obvDivergence);
                return (
                  <div
                    key={asset.symbol}
                    className="flex items-center justify-between rounded-2xl border border-white/5 bg-muted/30 p-3"
                  >
                    <div className="flex-1">
                      <div className="font-semibold text-sm">{getFriendlySymbol(asset.symbol, asset.type, asset.name)}</div>
                      <div className="text-xs text-muted-foreground">{getFriendlyAssetSubtitle(asset.symbol, asset.type, asset.name)}</div>
                    </div>
                    <div className="text-right">
                      <div className={`text-sm font-semibold ${divLabel.color}`}>
                        {divLabel.label}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {asset.obvDivergence > 0 ? "+" : ""}
                        {asset.obvDivergence}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Volume Trend Analysis */}
        <div className="grid grid-cols-2 gap-3">
          {/* Accumulation */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <span className="text-xs font-semibold">Accumulation</span>
            </div>
            {accumulationAssets.length > 0 ? (
              <div className="space-y-1">
                {accumulationAssets.map((asset) => (
                  <div
                    key={asset.symbol}
                    className="rounded-2xl border border-green-200 bg-green-50 p-2"
                  >
                    <div className="text-xs font-semibold text-green-900">{getFriendlySymbol(asset.symbol, asset.type, asset.name)}</div>
                    <div className="text-xs text-green-700">
                      +{asset.volumeAcceleration.toFixed(1)}% volume
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">None detected</p>
            )}
          </div>

          {/* Distribution */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-600" />
              <span className="text-xs font-semibold">Distribution</span>
            </div>
            {distributionAssets.length > 0 ? (
              <div className="space-y-1">
                {distributionAssets.map((asset) => (
                  <div key={asset.symbol} className="rounded-2xl border border-red-200 bg-red-50 p-2">
                    <div className="text-xs font-semibold text-red-900">{getFriendlySymbol(asset.symbol, asset.type, asset.name)}</div>
                    <div className="text-xs text-red-700">
                      {asset.volumeAcceleration.toFixed(1)}% volume
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">None detected</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
