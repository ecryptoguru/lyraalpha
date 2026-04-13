"use client";

import { cn } from "@/lib/utils";
import { Building2, User, AlertCircle } from "lucide-react";

interface InstitutionalOwnershipProps {
  heldPercentInstitutions?: number | null;
  heldPercentInsiders?: number | null;
  shortRatio?: number | null;
  beta?: number | null;
  assetType?: string;
  className?: string;
}

const OwnershipBar = ({ 
  label, 
  percentage, 
  color,
  icon: Icon,
}: { 
  label: string; 
  percentage: number; 
  color: string;
  icon: React.ComponentType<{ className?: string }>;
}) => (
  <div className="space-y-2 group/bar">
    <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-widest text-muted-foreground opacity-70 group-hover/bar:opacity-100 transition-opacity">
      <div className="flex items-center gap-2">
        <Icon className="w-3.5 h-3.5 mb-0.5" />
        <span>{label}</span>
      </div>
      <span className="text-foreground tracking-tight">{(percentage * 100).toFixed(2)}%</span>
    </div>
    <div className="h-1.5 rounded-full bg-muted/30 overflow-hidden border border-white/5">
      <div 
        className={cn("h-full transition-all duration-1000 opacity-80 group-hover/bar:opacity-100", color.replace("text-", "bg-"))}
        style={{ width: `${Math.min(100, percentage * 100)}%`, boxShadow: '0 0 10px currentColor' }}
      />
    </div>
  </div>
);

const getBetaDescription = (beta: number): { label: string; color: string } => {
  if (beta < 0.8) return { label: "Low volatility vs market", color: "text-emerald-500" };
  if (beta <= 1.2) return { label: "Similar to market", color: "text-amber-500" };
  return { label: "High volatility vs market", color: "text-red-500" };
};

const getShortRatioDescription = (ratio: number): { label: string; color: string } => {
  if (ratio < 3) return { label: "Low short interest", color: "text-emerald-500" };
  if (ratio <= 7) return { label: "Moderate short interest", color: "text-amber-500" };
  return { label: "High short interest", color: "text-red-500" };
};

export function InstitutionalOwnership({
  heldPercentInstitutions,
  heldPercentInsiders,
  shortRatio,
  beta,
  className,
}: InstitutionalOwnershipProps) {
  const isStock = false; // Platform is crypto-only
  
  // If no ownership data at all
  if (!heldPercentInstitutions && !heldPercentInsiders && !shortRatio && !beta) {
    return null;
  }

  const betaInfo = beta != null ? getBetaDescription(beta) : null;
  const shortInfo = shortRatio != null ? getShortRatioDescription(shortRatio) : null;

  return (
    <div className={cn("rounded-3xl border border-white/5 bg-card/60 backdrop-blur-2xl shadow-xl overflow-hidden relative group/matrix transition-all duration-500 hover:bg-card/80 hover:border-primary/20 hover:shadow-[0_0_30px_rgba(139,92,246,0.1)]", className)}>
      {/* Subtle hover glow */}
      <div className="absolute inset-0 bg-linear-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover/matrix:opacity-100 transition-opacity duration-500 pointer-events-none" />
      
      <div className="px-5 py-4 border-b border-light/5 flex items-center justify-between relative z-10 bg-black/10">
        <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-foreground flex items-center gap-2.5">
          <span className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
          Ownership & Risk
        </h3>
      </div>

      <div className="p-5 space-y-5 relative z-10">
        {/* Ownership bars */}
        <div className="space-y-4">
          {heldPercentInstitutions != null && (
            <OwnershipBar 
              label="Institutional Ownership"
              percentage={heldPercentInstitutions}
              color="bg-amber-500"
              icon={Building2}
            />
          )}
          
          {heldPercentInsiders != null && (
            <OwnershipBar 
              label="Insider Ownership"
              percentage={heldPercentInsiders}
              color="bg-emerald-500"
              icon={User}
            />
          )}
        </div>

        {/* Risk metrics */}
        {(beta != null || shortRatio != null) && (
          <div className="pt-4 border-t border-white/5 space-y-3">
            {beta != null && betaInfo && (
              <div className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors group/row">
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground opacity-70 group-hover/row:opacity-100 transition-opacity">
                  <AlertCircle className="w-3.5 h-3.5 mb-0.5" />
                  <span>Beta</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold tracking-tight text-foreground">{beta.toFixed(2)}</span>
                  <div className={cn("text-[9px] font-bold uppercase tracking-widest", betaInfo.color)}>{betaInfo.label}</div>
                </div>
              </div>
            )}
            
            {isStock && shortRatio != null && shortInfo && (
              <div className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors group/row">
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground opacity-70 group-hover/row:opacity-100 transition-opacity">
                  <AlertCircle className="w-3.5 h-3.5 mb-0.5" />
                  <span>Short Ratio</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold tracking-tight text-foreground">{shortRatio.toFixed(2)} days</span>
                  <div className={cn("text-[9px] font-bold uppercase tracking-widest", shortInfo.color)}>{shortInfo.label}</div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
