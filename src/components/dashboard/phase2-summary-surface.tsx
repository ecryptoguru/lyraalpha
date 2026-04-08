import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface Phase2SummaryStat {
  label: string;
  value: string;
  detail: string;
}

export function Phase2SummarySurface({
  badge,
  title,
  subtitle,
  description,
  stats,
  primaryPanel,
  secondaryPanel,
  guide,
  className,
}: {
  badge: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  description: ReactNode;
  stats?: Phase2SummaryStat[];
  primaryPanel: ReactNode;
  secondaryPanel?: ReactNode;
  guide?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("relative overflow-hidden rounded-4xl border border-white/10 bg-card/70 p-5 shadow-[0_24px_80px_-32px_rgba(2,6,23,0.7)] backdrop-blur-xl sm:p-6 md:p-7", className)}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-primary/45 to-transparent" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.08),transparent_30%)]" />
      <div className="relative">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-4 max-w-3xl">
            <div>{badge}</div>
            <div>
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tighter text-foreground leading-none flex flex-col">
                {subtitle ? <span className="text-muted-foreground/60 dark:text-muted-foreground/40 font-bold uppercase tracking-widest text-sm mb-2">{subtitle}</span> : null}
                <span className="premium-gradient-text uppercase">{title}</span>
              </h1>
              <p className="mt-3 text-sm md:text-base text-muted-foreground font-medium opacity-80 max-w-2xl leading-relaxed">
                {description}
              </p>
            </div>
          </div>

          {stats && stats.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full xl:w-auto xl:min-w-[420px]">
              {stats.map((stat) => (
                <div key={stat.label} className="rounded-3xl border border-white/10 bg-background/60 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{stat.label}</p>
                  <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">{stat.value}</p>
                  <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{stat.detail}</p>
                </div>
              ))}
            </div>
          ) : primaryPanel ? (
            <div className="w-full xl:w-auto xl:min-w-[380px] xl:max-w-[480px]">{primaryPanel}</div>
          ) : null}
        </div>

        {secondaryPanel ? (
          <div className="mt-6 grid grid-cols-1 gap-3">
            <div>{secondaryPanel}</div>
          </div>
        ) : null}

        {guide ? (
          <div className="mt-6 rounded-3xl border border-primary/15 bg-primary/5 px-5 py-4 text-xs font-medium text-muted-foreground shadow-lg">
            {guide}
          </div>
        ) : null}
      </div>
    </div>
  );
}
