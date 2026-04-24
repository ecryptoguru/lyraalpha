"use client";

import { cn, formatCompactNumber } from "@/lib/utils";
import { GitBranch, Clock, Landmark, Wallet, Activity, Zap } from "lucide-react";

interface UnlockEvent {
  date: string | null;
  amount: number | null;
  percentOfSupply: number | null;
  category: string | null;
  description: string | null;
}

interface OnChainIntelligenceSectionProps {
  holderGini?: number | null;
  top10HolderPercent?: number | null;
  fundingRate?: number | null;
  exchangeFlows?: Record<string, unknown> | null;
  stakingYield?: Record<string, unknown> | null;
  emissionSchedule?: Record<string, unknown> | null;
  governanceData?: Record<string, unknown> | null;
  unlockCalendar?: UnlockEvent[];
  holderConcentrationLabel?: string | null;
  fundingRateLabel?: string | null;
  unlockRiskLevel?: string | null;
  className?: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  team: "border-danger/20 bg-danger/10 text-danger",
  foundation: "border-warning/20 bg-warning/10 text-warning",
  investors: "border-primary/20 bg-primary/10 text-primary",
  public: "border-success/20 bg-success/10 text-success",
  ecosystem: "border-info/20 bg-info/10 text-info",
};

function defaultCategoryColor() {
  return "border-muted-foreground/20 bg-muted/10 text-muted-foreground";
}

function GaugeBar({
  value,
  min,
  max,
  label,
  sublabel,
  colorClass,
}: {
  value: number;
  min: number;
  max: number;
  label: string;
  sublabel?: string;
  colorClass?: string;
}) {
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">{label}</span>
        {sublabel && <span className="text-[9px] font-bold text-muted-foreground/60">{sublabel}</span>}
      </div>
      <div className="h-2 w-full rounded-full bg-muted/40 overflow-hidden relative">
        <div
          className={cn("absolute h-full rounded-full transition-all duration-700", colorClass || "bg-primary")}
          style={{ left: "0%", width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function MiniMetric({ label, value, tooltip }: { label: string; value: string; tooltip?: string }) {
  return (
    <div className="rounded-2xl bg-background/30 border border-border/30 dark:border-white/5 p-3 space-y-1">
      <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="text-sm font-bold text-foreground">{value}</p>
      {tooltip && <p className="text-[8px] text-muted-foreground/60 leading-relaxed">{tooltip}</p>}
    </div>
  );
}

export function OnChainIntelligenceSection({
  holderGini,
  top10HolderPercent,
  fundingRate,
  exchangeFlows,
  stakingYield,
  emissionSchedule,
  governanceData,
  unlockCalendar,
  holderConcentrationLabel,
  fundingRateLabel,
  unlockRiskLevel,
  className,
}: OnChainIntelligenceSectionProps) {
  const hasAnyData =
    holderGini != null ||
    top10HolderPercent != null ||
    fundingRate != null ||
    !!exchangeFlows ||
    !!stakingYield ||
    !!emissionSchedule ||
    !!governanceData ||
    (unlockCalendar && unlockCalendar.length > 0);

  if (!hasAnyData) return null;

  // Funding rate: map -0.01..+0.01 to gauge 0..100 with center at 50
  const fundingGaugeMin = -0.01;
  const fundingGaugeMax = 0.01;

  return (
    <div className={cn("space-y-4", className)}>
      <h3 className="text-lg font-bold tracking-tight flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-primary" />
        On-Chain Intelligence
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Holder Concentration */}
        {(holderGini != null || top10HolderPercent != null) && (
          <div className="rounded-3xl border border-white/10 bg-card/60 backdrop-blur-2xl shadow-xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-xl bg-primary/10 flex items-center justify-center">
                <Wallet className="w-3.5 h-3.5 text-primary" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-foreground">Holder Concentration</span>
                {holderConcentrationLabel && (
                  <span
                    className={cn(
                      "text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-full border",
                      holderConcentrationLabel === "Whale-heavy"
                        ? "text-danger border-danger/30 bg-danger/10"
                        : holderConcentrationLabel === "Moderately concentrated"
                          ? "text-warning border-warning/30 bg-warning/10"
                          : "text-success border-success/30 bg-success/10",
                    )}
                  >
                    {holderConcentrationLabel}
                  </span>
                )}
              </div>
            </div>
            {holderGini != null && (
              <GaugeBar
                value={holderGini}
                min={0}
                max={1}
                label="Gini Coefficient"
                sublabel={`${holderGini.toFixed(2)} / 1.00`}
                colorClass={holderGini >= 0.85 ? "bg-danger" : holderGini >= 0.7 ? "bg-warning" : "bg-success"}
              />
            )}
            {top10HolderPercent != null && (
              <GaugeBar
                value={top10HolderPercent}
                min={0}
                max={100}
                label="Top 10 Holders"
                sublabel={`${top10HolderPercent.toFixed(1)}%`}
                colorClass={top10HolderPercent >= 60 ? "bg-danger" : top10HolderPercent >= 30 ? "bg-warning" : "bg-success"}
              />
            )}
          </div>
        )}

        {/* Funding Rate */}
        {fundingRate != null && (
          <div className="rounded-3xl border border-white/10 bg-card/60 backdrop-blur-2xl shadow-xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-xl bg-warning/10 flex items-center justify-center">
                <Activity className="w-3.5 h-3.5 text-warning" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-foreground">Perp Funding Rate</span>
                {fundingRateLabel && (
                  <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-full border text-primary border-primary/30 bg-primary/10">
                    {fundingRateLabel}
                  </span>
                )}
              </div>
            </div>
            <GaugeBar
              value={fundingRate}
              min={fundingGaugeMin}
              max={fundingGaugeMax}
              label={`${fundingRate >= 0 ? "+" : ""}${(fundingRate * 100).toFixed(3)}%`}
              sublabel={fundingRate >= 0 ? "Longs pay shorts" : "Shorts pay longs"}
              colorClass={
                Math.abs(fundingRate) > 0.001 ? "bg-danger" : Math.abs(fundingRate) > 0.0001 ? "bg-warning" : "bg-success"
              }
            />
            <div className="flex justify-between text-[8px] text-muted-foreground/50 uppercase tracking-wider">
              <span>Short-heavy</span>
              <span>Neutral</span>
              <span>Long-heavy</span>
            </div>
          </div>
        )}

        {/* Exchange Flows */}
        {exchangeFlows && (
          <div className="rounded-3xl border border-white/10 bg-card/60 backdrop-blur-2xl shadow-xl p-5 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-xl bg-info/10 flex items-center justify-center">
                <GitBranch className="w-3.5 h-3.5 text-info" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-foreground">Exchange Flows</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(() => {
                const flows = exchangeFlows as Record<string, unknown>;
                const inflow = typeof flows.inflow === "number" ? flows.inflow : null;
                const outflow = typeof flows.outflow === "number" ? flows.outflow : null;
                const net = inflow != null && outflow != null ? outflow - inflow : null;
                return (
                  <>
                    <MiniMetric
                      label="Inflow (24h)"
                      value={inflow != null ? formatCompactNumber(inflow, { isCurrency: false }) : "—"}
                    />
                    <MiniMetric
                      label="Outflow (24h)"
                      value={outflow != null ? formatCompactNumber(outflow, { isCurrency: false }) : "—"}
                    />
                    <div className="col-span-2 rounded-2xl bg-background/30 border border-border/30 dark:border-white/5 p-3 flex items-center justify-between">
                      <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Net Flow</span>
                      <span
                        className={cn(
                          "text-sm font-bold",
                          net == null ? "text-muted-foreground" : net > 0 ? "text-success" : "text-danger",
                        )}
                      >
                        {net != null ? `${net > 0 ? "+" : ""}${formatCompactNumber(net, { isCurrency: false })}` : "—"}
                      </span>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        )}

        {/* Staking & Emissions */}
        {(stakingYield || emissionSchedule) && (
          <div className="rounded-3xl border border-white/10 bg-card/60 backdrop-blur-2xl shadow-xl p-5 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-xl bg-success/10 flex items-center justify-center">
                <Zap className="w-3.5 h-3.5 text-success" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-foreground">Staking & Emissions</span>
            </div>
            {(() => {
              const sy = stakingYield as Record<string, unknown> | null;
              const es = emissionSchedule as Record<string, unknown> | null;
              const apr = sy?.currentApr as number | undefined;
              const inflation = es?.annualInflation as number | undefined;
              const nextUnlock = es?.nextUnlockDate as string | undefined;
              return (
                <div className="grid grid-cols-2 gap-2">
                  {apr != null && (
                    <MiniMetric label="Staking APR" value={`${(apr * 100).toFixed(2)}%`} tooltip="Annual yield for staking participation" />
                  )}
                  {inflation != null && (
                    <MiniMetric
                      label="Annual Inflation"
                      value={`${(inflation * 100).toFixed(2)}%`}
                      tooltip="New token issuance rate — high inflation dilutes holders"
                    />
                  )}
                  {nextUnlock && (
                    <div className="col-span-2 rounded-2xl bg-background/30 border border-border/30 dark:border-white/5 p-3 flex items-center justify-between">
                      <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Next Emission</span>
                      <span className="text-sm font-bold text-foreground">{new Date(nextUnlock).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {/* Governance Snapshot */}
        {governanceData && (
          <div className="rounded-3xl border border-white/10 bg-card/60 backdrop-blur-2xl shadow-xl p-5 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-xl bg-primary/10 flex items-center justify-center">
                <Landmark className="w-3.5 h-3.5 text-primary" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-foreground">Governance</span>
            </div>
            {(() => {
              const gd = governanceData as Record<string, unknown>;
              const type = gd.type as string | undefined;
              const proposals = gd.recentProposals as number | undefined;
              const participation = gd.participationRate as number | undefined;
              return (
                <div className="grid grid-cols-2 gap-2">
                  {type && <MiniMetric label="Type" value={type} />}
                  {proposals != null && <MiniMetric label="Recent Proposals" value={String(proposals)} />}
                  {participation != null && (
                    <MiniMetric label="Participation" value={`${(participation * 100).toFixed(1)}%`} />
                  )}
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* Token Unlock Calendar */}
      {unlockCalendar && unlockCalendar.length > 0 && (
        <div className="rounded-3xl border border-white/10 bg-card/60 backdrop-blur-2xl shadow-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-xl bg-warning/10 flex items-center justify-center">
                <Clock className="w-3.5 h-3.5 text-warning" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-foreground">Token Unlock Calendar</span>
            </div>
            {unlockRiskLevel && (
              <span
                className={cn(
                  "text-[8px] font-bold uppercase px-2 py-0.5 rounded-full border",
                  unlockRiskLevel === "High"
                    ? "text-danger border-danger/30 bg-danger/10"
                    : unlockRiskLevel === "Moderate"
                      ? "text-warning border-warning/30 bg-warning/10"
                      : "text-success border-success/30 bg-success/10",
                )}
              >
                Pressure: {unlockRiskLevel}
              </span>
            )}
          </div>

          <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
            {unlockCalendar.slice(0, 10).map((event, i) => {
              const dateStr = event.date ? new Date(event.date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "TBD";
              const pct = event.percentOfSupply ?? 0;
              const cat = (event.category || "other").toLowerCase();
              return (
                <div
                  key={i}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl border p-3 transition-colors hover:bg-background/40",
                    CATEGORY_COLORS[cat] || defaultCategoryColor(),
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/80">{dateStr}</span>
                      {event.category && (
                        <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-full border border-white/10 bg-white/5 text-foreground/70">
                          {event.category}
                        </span>
                      )}
                    </div>
                    {event.description && (
                      <p className="text-[9px] text-foreground/50 mt-0.5 truncate">{event.description}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-foreground">
                      {event.amount != null ? formatCompactNumber(event.amount, { isCurrency: false }) : "—"}
                    </p>
                    {pct > 0 && <p className="text-[9px] font-bold text-foreground/60">{pct.toFixed(2)}% supply</p>}
                  </div>
                </div>
              );
            })}
          </div>

          {unlockCalendar.length > 10 && (
            <p className="text-[9px] text-muted-foreground text-center">+ {unlockCalendar.length - 10} more upcoming events</p>
          )}
        </div>
      )}
    </div>
  );
}
