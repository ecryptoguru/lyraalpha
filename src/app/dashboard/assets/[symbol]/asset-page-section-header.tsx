import React from "react";

type AssetPageSectionHeaderVariant = "primary" | "sky" | "cyan";

interface AssetPageSectionHeaderProps {
  className?: string;
  label: string;
  variant: AssetPageSectionHeaderVariant;
  watermark: string;
  watermarkOpacityClassName?: string;
}

const VARIANT_STYLES: Record<AssetPageSectionHeaderVariant, {
  dotClassName: string;
  lineClassName: string;
  textClassName: string;
  watermarkClassName: string;
  shadow: string;
}> = {
  primary: {
    dotClassName: "bg-primary",
    lineClassName: "bg-primary/40",
    textClassName: "text-primary/80",
    watermarkClassName: "text-primary",
    shadow: "0 0 8px rgba(var(--primary),0.8)",
  },
  sky: {
    dotClassName: "bg-sky-500",
    lineClassName: "bg-sky-500/40",
    textClassName: "text-sky-500/80",
    watermarkClassName: "text-sky-500",
    shadow: "0 0 8px rgba(14,165,233,0.8)",
  },
  cyan: {
    dotClassName: "bg-cyan-500",
    lineClassName: "bg-cyan-500/40",
    textClassName: "text-cyan-500/80",
    watermarkClassName: "text-cyan-500",
    shadow: "0 0 8px rgba(6,182,212,0.8)",
  },
};

export function AssetPageSectionHeader({
  className = "mt-16 mb-8",
  label,
  variant,
  watermark,
  watermarkOpacityClassName = "opacity-[0.03]",
}: AssetPageSectionHeaderProps) {
  const styles = VARIANT_STYLES[variant];

  return (
    <div className={`relative w-full pointer-events-none ${className}`}>
      <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[60%] w-full flex justify-center overflow-hidden select-none -z-10 mix-blend-plus-lighter ${watermarkOpacityClassName}`}>
        <span className={`text-[14vw] sm:text-[12vw] font-bold tracking-tighter leading-none uppercase whitespace-nowrap ${styles.watermarkClassName}`}>
          {watermark}
        </span>
      </div>
      <div className="flex items-center gap-3 relative z-10">
        <div className={`h-px w-8 sm:w-16 shrink-0 ${styles.lineClassName}`} />
        <span className={`text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] flex items-center gap-2 shrink-0 ${styles.textClassName}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${styles.dotClassName}`} style={{ boxShadow: styles.shadow }} />
          {label}
        </span>
        <div className={`h-px flex-1 bg-linear-to-r ${styles.lineClassName} to-transparent`} />
      </div>
    </div>
  );
}
