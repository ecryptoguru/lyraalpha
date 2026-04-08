"use client";

import { useMemo, useState } from "react";
import { Star, X } from "lucide-react";
import type { XPRedemptionType } from "@/generated/prisma/client";
import {
  useDashboardPoints,
  type DashboardPoints,
  type DashboardRedemptionOption,
} from "@/hooks/use-dashboard-points";

interface PointsData {
  currentXp: number;
  tierName: string;
  tierEmoji: string;
  bonusMultiplier: number;
  nextLevel: { name: string; xpNeeded: number } | null;
}

interface RedemptionOption extends DashboardRedemptionOption {
  type: XPRedemptionType;
  xpCost: number;
}

interface PointsDisplayProps {
  compact?: boolean;
  variant?: "default" | "naked";
}

function mapPoints(points: DashboardPoints | null): PointsData | null {
  if (!points) {
    return null;
  }

  const nextLevel = points.xpNeededForNext
    ? { name: `Level ${points.level + 1}`, xpNeeded: points.xpNeededForNext }
    : null;

  return {
    currentXp: points.xp ?? 0,
    tierName: points.tierName ?? "Beginner",
    tierEmoji: points.tierEmoji ?? "🌱",
    bonusMultiplier: points.multiplier ?? 1,
    nextLevel,
  };
}

export function PointsDisplay({ compact = false, variant = "default" }: PointsDisplayProps) {
  const { mounted, points: rawPoints, isLoading } = useDashboardPoints();
  const [showModal, setShowModal] = useState(false);
  const points = useMemo(() => mapPoints(rawPoints), [rawPoints]);
  const loading = !mounted || isLoading;

  if (loading) {
    if (compact) return <div className="h-6 w-12 bg-muted/50 rounded animate-pulse" />;
    if (variant === "naked") return <div className="h-12 bg-muted/50 rounded-2xl animate-pulse" />;
    return <div className="h-20 bg-muted/50 rounded-2xl animate-pulse" />;
  }

  if (!points) return null;

  if (compact) {
    return (
      <button
        onClick={() => setShowModal(true)}
        className="flex items-center gap-1.5 px-2 py-1 rounded-2xl hover:bg-muted/50 transition-colors"
      >
        <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
        <span className="text-sm font-bold text-amber-400">{points.currentXp}</span>
      </button>
    );
  }

  const innerContent = (
    <>
      {/* Top Row: Label & Points */}
      <div className="flex items-center justify-between mb-3 relative z-10">
        <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest truncate mr-2 flex items-center gap-1.5">
          <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
          XP Progress
        </span>
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-sm font-bold text-amber-400 tabular-nums leading-none">
            {points.currentXp}
          </span>
          <span className="text-[10px] font-bold text-amber-500/70">XP</span>
        </div>
      </div>

      {/* Bottom Row: Status & Redeem */}
      <div className="flex items-center justify-between relative z-10">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-xs leading-none shrink-0" title={points.tierName}>{points.tierEmoji}</span>
          <span className="text-[10px] font-semibold text-foreground truncate">
            {points.tierName} · {points.bonusMultiplier.toFixed(2)}x XP
          </span>
        </div>
        
        <button
          onClick={() => setShowModal(true)}
          className="shrink-0 text-[9px] font-bold uppercase tracking-wider text-amber-500 hover:text-amber-400 transition-colors bg-amber-500/10 hover:bg-amber-500/20 px-2 py-1 rounded ml-2"
        >
          Redeem
        </button>
      </div>
    </>
  );

  if (variant === "naked") {
    return (
      <>
        <div className="relative w-full">
          {innerContent}
        </div>
        {showModal && <PointsRedemptionModal onClose={() => setShowModal(false)} />}
      </>
    );
  }

  return (
    <>
      <div className="rounded-2xl border border-border/75 dark:border-white/5 bg-white/80 dark:bg-white/5 p-4 backdrop-blur-2xl shadow-lg relative overflow-hidden group hover:border-amber-500/25 transition-colors duration-500">
        <div className="absolute inset-0 bg-linear-to-br from-amber-500/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        {innerContent}
      </div>

      {showModal && <PointsRedemptionModal onClose={() => setShowModal(false)} />}
    </>
  );
}

function PointsRedemptionModal({ onClose }: { onClose: () => void }) {
  const { mounted, points: rawPoints, redemptionOptions, history, isLoading, mutate } = useDashboardPoints();
  const [redeeming, setRedeeming] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const points = useMemo(() => mapPoints(rawPoints), [rawPoints]);
  const options = redemptionOptions as RedemptionOption[];
  const loading = !mounted || isLoading;

  const handleRedeem = async (type: XPRedemptionType) => {
    setRedeeming(type);
    setMessage(null);

    try {
      const res = await fetch("/api/learning/xp-redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      const data = await res.json();

      if (data.success) {
        setMessage({ type: "success", text: "XP bundle redeemed successfully!" });
        await mutate();
      } else {
        setMessage({ type: "error", text: data.message || data.error || "Redemption failed" });
      }
    } catch {
      setMessage({ type: "error", text: "Something went wrong" });
    } finally {
      setRedeeming(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xl p-4">
      <div className="w-full max-w-md bg-background rounded-2xl border border-border shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Star className="h-5 w-5 text-amber-400 fill-amber-400" />
            <h2 className="text-lg font-bold text-foreground">Redeem XP</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-2xl transition-colors">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto scroll-smooth p-4">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-muted/50 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              {/* Points Balance */}
              <div className="text-center mb-6">
                <p className="text-sm text-muted-foreground">Your XP Balance</p>
                <p className="text-4xl font-bold text-amber-400">{points?.currentXp || 0}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {points?.nextLevel
                    ? `${points.nextLevel.xpNeeded} XP more to ${points.nextLevel.name}`
                    : "Max tier reached!"}
                </p>
              </div>

              {/* Message */}
              {message && (
                <div
                  className={`mb-4 p-3 rounded-2xl text-sm font-medium ${
                    message.type === "success"
                      ? "bg-green-500/20 text-green-500"
                      : "bg-red-500/20 text-red-500"
                  }`}
                >
                  {message.text}
                </div>
              )}

              {/* Redemption Options */}
              <div className="space-y-2 mb-6">
                {options.map((option) => {
                  const canRedeem = (points?.currentXp || 0) >= option.xpCost;
                  return (
                    <button
                      key={option.type}
                      onClick={() => canRedeem && handleRedeem(option.type)}
                      disabled={!canRedeem || redeeming === option.type}
                      className={`w-full p-4 rounded-2xl border flex items-center justify-between transition-all ${
                        canRedeem
                          ? "border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 cursor-pointer"
                          : "border-border bg-muted/30 cursor-not-allowed opacity-70"
                      }`}
                    >
                      <div className="text-left">
                        <p className="font-bold text-foreground">{option.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {option.plan ? `${option.plan} access` : `${option.credits} credits`}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-amber-400">{option.xpCost} XP</p>
                        {redeeming === option.type && (
                          <p className="text-xs text-muted-foreground">Redeeming...</p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Recent History */}
              {history.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-muted-foreground uppercase mb-2">Recent Activity</p>
                  <div className="space-y-1">
                    {history.slice(0, 5).map((tx) => (
                      <div key={tx.id} className="flex items-center justify-between text-xs py-2 border-b border-white/5">
                        <span className="text-muted-foreground truncate max-w-[200px]">{tx.description}</span>
                        <span className={tx.amount > 0 ? "text-green-500 font-bold" : "text-red-500 font-bold"}>
                          {tx.amount > 0 ? "+" : ""}{tx.amount}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
