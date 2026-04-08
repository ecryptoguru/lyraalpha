import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

// ─── StatChip ────────────────────────────────────────────────────────────────

export type StatChipVariant = "default" | "green" | "red" | "amber" | "blue" | "muted";

const CHIP_VARIANTS: Record<StatChipVariant, string> = {
  default: "border-border/50 bg-card/60 text-foreground",
  green:   "border-emerald-500/25 bg-emerald-500/10 text-emerald-400",
  red:     "border-rose-500/25 bg-rose-500/10 text-rose-400",
  amber:   "border-amber-500/25 bg-amber-500/10 text-amber-400",
  blue:    "border-sky-500/25 bg-sky-500/10 text-sky-400",
  muted:   "border-border/40 bg-background/40 text-muted-foreground",
};

export interface StatChipProps {
  value: ReactNode;
  label: string;
  variant?: StatChipVariant;
  className?: string;
}

export function StatChip({ value, label, variant = "default", className }: StatChipProps) {
  return (
    <div
      className={cn(
        "inline-flex flex-col items-center justify-center rounded-2xl border px-3 py-2 backdrop-blur-sm min-w-[60px]",
        CHIP_VARIANTS[variant],
        className,
      )}
    >
      <span className="text-sm font-bold leading-none tabular-nums">{value}</span>
      <span className="mt-1 text-[9px] font-bold uppercase tracking-[0.14em] opacity-70 whitespace-nowrap">
        {label}
      </span>
    </div>
  );
}

// ─── PageHeader ───────────────────────────────────────────────────────────────

export interface PageHeaderProps {
  icon: ReactNode;
  title: string;
  eyebrow?: string;
  chips?: ReactNode;
  actions?: ReactNode;
  className?: string;
  /** Tab bar rendered directly below the header row */
  tabs?: ReactNode;
}

export function PageHeader({
  icon,
  title,
  eyebrow,
  chips,
  actions,
  className,
  tabs,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl border border-border/50 dark:border-white/10 bg-card/60 backdrop-blur-xl shadow-[0_8px_32px_-8px_rgba(2,6,23,0.3)] dark:shadow-[0_8px_32px_-8px_rgba(2,6,23,0.6)]",
        className,
      )}
    >
      {/* Top shimmer line */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-primary/40 to-transparent" />
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(245,158,11,0.06),transparent_60%)]" />

      <div className="relative px-4 sm:px-5 md:px-6 py-4">
        <div className="flex flex-wrap items-center gap-3 min-w-0">
          {/* Icon */}
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary shadow-[0_0_12px_rgba(245,158,11,0.15)]">
            {icon}
          </div>

          {/* Title + eyebrow */}
          <div className="min-w-0 flex-1">
            {eyebrow && (
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground/70 leading-none mb-1">
                {eyebrow}
              </p>
            )}
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground uppercase leading-none premium-gradient-text">
              {title}
            </h1>
          </div>

          {/* Chips row */}
          {chips && (
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {chips}
            </div>
          )}

          {/* Actions (buttons etc.) */}
          {actions && (
            <div className="flex items-center gap-2 shrink-0 ml-auto">
              {actions}
            </div>
          )}
        </div>
      </div>

      {/* Optional tab bar slot */}
      {tabs && (
        <div className="relative border-t border-border/40 px-4 sm:px-5 md:px-6">
          {tabs}
        </div>
      )}
    </div>
  );
}

// ─── PageTabBar ───────────────────────────────────────────────────────────────

export interface PageTab {
  key: string;
  label: string;
  icon?: ReactNode;
}

export interface PageTabBarProps {
  tabs: PageTab[];
  active: string;
  onChange: (key: string) => void;
  className?: string;
}

export function PageTabBar({ tabs, active, onChange, className }: PageTabBarProps) {
  return (
    <div
      className={cn(
        "flex overflow-x-auto scrollbar-hide gap-1 py-2",
        className,
      )}
    >
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onChange(tab.key)}
          className={cn(
            "flex shrink-0 items-center gap-1.5 rounded-2xl px-4 min-h-[38px] text-[11px] font-bold uppercase tracking-[0.14em] transition-all duration-200 whitespace-nowrap",
            active === tab.key
              ? "bg-primary/15 text-primary border border-primary/25 shadow-[0_0_8px_rgba(245,158,11,0.12)]"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/40 dark:hover:bg-white/5 border border-transparent",
          )}
        >
          {tab.icon && <span className="shrink-0">{tab.icon}</span>}
          {tab.label}
        </button>
      ))}
    </div>
  );
}
