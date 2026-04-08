"use client";

import { cn } from "@/lib/utils";
import { ShieldAlert, AlertTriangle, ShieldCheck } from "lucide-react";
import type { MFRiskResult, RiskLevel } from "@/lib/engines/mf-risk";

interface MFRiskCardProps {
  risk: MFRiskResult;
  className?: string;
}

const RISK_CONFIG: Record<RiskLevel, { icon: typeof ShieldCheck; color: string; bg: string; border: string; label: string }> = {
  low: { icon: ShieldCheck, color: "text-emerald-500", bg: "bg-emerald-500/10", border: "border-emerald-500/20", label: "Low Risk" },
  moderate: { icon: AlertTriangle, color: "text-amber-500", bg: "bg-amber-500/10", border: "border-amber-500/20", label: "Moderate Risk" },
  elevated: { icon: ShieldAlert, color: "text-red-500", bg: "bg-red-500/10", border: "border-red-500/20", label: "Elevated Risk" },
};

function SubRiskRow({ label, level }: { label: string; level: RiskLevel }) {
  const cfg = RISK_CONFIG[level];
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-[10px] font-bold text-muted-foreground">{label}</span>
      <span className={cn("text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border", cfg.bg, cfg.border, cfg.color)}>
        {level}
      </span>
    </div>
  );
}

export function MFRiskCard({ risk, className }: MFRiskCardProps) {
  const cfg = RISK_CONFIG[risk.level];
  const Icon = cfg.icon;

  return (
    <div className={cn("bg-card/60 backdrop-blur-2xl border border-white/5 shadow-xl rounded-3xl border border-white/5 bg-card/60 backdrop-blur-2xl overflow-hidden", className)}>
      <div className="px-5 py-3 border-b border-border/30 flex items-center gap-2">
        <Icon className={cn("w-4 h-4", cfg.color)} />
        <h3 className="text-sm font-bold text-foreground">Risk Assessment</h3>
        <span className={cn("ml-auto text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border", cfg.bg, cfg.border, cfg.color)}>
          {cfg.label}
        </span>
      </div>

      <div className="p-5 space-y-4">
        <div className="space-y-1">
          <SubRiskRow label="Concentration" level={risk.concentration.level} />
          <SubRiskRow label="Style Drift" level={risk.styleDrift.level} />
          <SubRiskRow label="Expense" level={risk.expense.level} />
          <SubRiskRow label="Drawdown" level={risk.drawdown.level} />
          <SubRiskRow label="Benchmark Tracking" level={risk.benchmarkTracking.level} />
          {risk.aum.level !== "low" && <SubRiskRow label="AUM Size" level={risk.aum.level} />}
        </div>

        {risk.factors.length > 0 && (
          <div className="pt-3 border-t border-border/30">
            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block mb-2">
              Risk Factors
            </span>
            <div className="space-y-1.5">
              {risk.factors.map((factor, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="w-1 h-1 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                  <span className="text-[10px] text-muted-foreground leading-relaxed">{factor}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="pt-3 border-t border-border/30 grid grid-cols-2 gap-3">
          {risk.expense.annualImpactBps != null && (
            <div className="text-center p-2 rounded-2xl bg-background/30">
              <p className="text-sm font-bold text-foreground">{risk.expense.annualImpactBps} bps</p>
              <p className="text-[8px] text-muted-foreground font-bold uppercase">Expense Drag</p>
            </div>
          )}
          <div className="text-center p-2 rounded-2xl bg-background/30">
            <p className="text-sm font-bold text-foreground">{risk.concentration.hhi.toFixed(3)}</p>
            <p className="text-[8px] text-muted-foreground font-bold uppercase">HHI Index</p>
          </div>
          {risk.drawdown.maxDrawdown != null && (
            <div className="text-center p-2 rounded-2xl bg-background/30">
              <p className="text-sm font-bold text-foreground">-{risk.drawdown.maxDrawdown.toFixed(1)}%</p>
              <p className="text-[8px] text-muted-foreground font-bold uppercase">Max Drawdown</p>
            </div>
          )}
          {risk.benchmarkTracking.rSquared != null && (
            <div className="text-center p-2 rounded-2xl bg-background/30">
              <p className="text-sm font-bold text-foreground">{risk.benchmarkTracking.rSquared.toFixed(2)}</p>
              <p className="text-[8px] text-muted-foreground font-bold uppercase">R-Squared</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
