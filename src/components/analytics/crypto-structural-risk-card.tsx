"use client";

import { cn } from "@/lib/utils";
import { Shield, GitBranch, Eye, Clock, ShieldCheck } from "lucide-react";
import type { CryptoStructuralRisk, EnhancedCryptoTrust, HolderStabilityScore } from "@/lib/engines/crypto-intelligence";

interface CryptoStructuralRiskCardProps {
  structuralRisk: CryptoStructuralRisk;
  enhancedTrust: EnhancedCryptoTrust;
  holderStability: HolderStabilityScore;
  className?: string;
}

const LEVEL_COLORS: Record<string, string> = {
  low: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
  moderate: "text-amber-500 bg-amber-500/10 border-amber-500/20",
  high: "text-red-500 bg-red-500/10 border-red-500/20",
  critical: "text-red-600 bg-red-600/10 border-red-600/20",
};

const TRUST_COLORS: Record<string, string> = {
  "very-high": "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
  high: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  moderate: "text-amber-500 bg-amber-500/10 border-amber-500/20",
  low: "text-red-500 bg-red-500/10 border-red-500/20",
  "very-low": "text-red-600 bg-red-600/10 border-red-600/20",
};

function RiskRow({ label, level, description, icon: Icon }: { label: string; level: string; description: string; icon: typeof Shield }) {
  return (
    <div className="flex items-start gap-2 py-1.5">
      <Icon className="w-3 h-3 mt-0.5 text-muted-foreground/40 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">{label}</span>
          <span className={cn(
            "text-[8px] font-bold uppercase px-1.5 py-0.5 rounded border",
            LEVEL_COLORS[level] || LEVEL_COLORS.moderate,
          )}>
            {level}
          </span>
        </div>
        <p className="text-[9px] text-foreground/60 leading-relaxed mt-0.5">{description}</p>
      </div>
    </div>
  );
}

export function CryptoStructuralRiskCard({ structuralRisk, enhancedTrust, holderStability, className }: CryptoStructuralRiskCardProps) {
  const sr = structuralRisk;
  const hs = holderStability;

  return (
    <div className={cn("rounded-2xl border border-white/5 bg-card/60 backdrop-blur-2xl shadow-xl backdrop-blur-xl p-4 space-y-3", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-xl bg-red-500/10 flex items-center justify-center">
            <Shield className="w-3.5 h-3.5 text-red-500" />
          </div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Risk & Trust</h3>
        </div>
        <span className={cn(
          "inline-flex items-center px-2 py-0.5 rounded-full border text-[9px] font-bold uppercase tracking-wider",
          LEVEL_COLORS[sr.overallLevel] || LEVEL_COLORS.moderate,
        )}>
          Risk: {sr.overallLevel}
        </span>
      </div>

      {/* Structural Risk Breakdown */}
      <div className="space-y-0.5">
        <RiskRow label="Dependency" level={sr.dependencyRisk.level} description={sr.dependencyRisk.description} icon={GitBranch} />
        <RiskRow label="Governance" level={sr.governanceRisk.level} description={sr.governanceRisk.description} icon={Eye} />
        <RiskRow label="Maturity" level={sr.maturityRisk.level} description={sr.maturityRisk.description} icon={Clock} />
      </div>

      {/* Enhanced Trust */}
      <div className="pt-2 border-t border-border/20 space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3 h-3 text-emerald-500" />
            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Enhanced Trust Score</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={cn("text-sm font-bold", enhancedTrust.score >= 60 ? "text-emerald-500" : enhancedTrust.score >= 35 ? "text-amber-500" : "text-red-500")}>
              {enhancedTrust.score}
            </span>
            <span className={cn(
              "text-[8px] font-bold uppercase px-1.5 py-0.5 rounded border",
              TRUST_COLORS[enhancedTrust.level] || TRUST_COLORS.moderate,
            )}>
              {enhancedTrust.level}
            </span>
          </div>
        </div>
      </div>

      {/* Holder Stability */}
      <div className="pt-2 border-t border-border/20 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Holder Stability</span>
          <span className={cn("text-sm font-bold", hs.score >= 60 ? "text-emerald-500" : hs.score >= 35 ? "text-amber-500" : "text-red-500")}>
            {hs.score}/100
          </span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {[
            { label: "Supply Dist", value: hs.supplyConcentration },
            { label: "Buy Pressure", value: hs.buyPressure },
            { label: "MCap/FDV", value: hs.marketCapToFDV },
            { label: "Price Stability", value: hs.priceStability },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between p-1 rounded bg-muted/5">
              <span className="text-[8px] text-muted-foreground uppercase">{label}</span>
              <span className={cn(
                "text-[9px] font-bold",
                value >= 60 ? "text-emerald-500" : value >= 35 ? "text-amber-500" : "text-red-500",
              )}>
                {value}
              </span>
            </div>
          ))}
        </div>
        {hs.drivers.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {hs.drivers.slice(0, 3).map((d, i) => (
              <span key={i} className="text-[8px] px-1.5 py-0.5 rounded border border-border/30 bg-muted/10 text-muted-foreground">
                {d}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
