import Link from "next/link";
import { ArrowRight } from "lucide-react";

export interface SystemBridgeItem {
  eyebrow: string;
  title: string;
  description: string;
  href: string;
  accent?: "primary" | "emerald" | "amber" | "sky";
}

function accentClasses(accent: SystemBridgeItem["accent"]) {
  switch (accent) {
    case "emerald":
      return {
        eyebrow: "text-emerald-400",
        card: "hover:border-emerald-400/30 hover:bg-emerald-400/5",
      };
    case "amber":
      return {
        eyebrow: "text-amber-400",
        card: "hover:border-amber-400/30 hover:bg-amber-400/5",
      };
    case "sky":
      return {
        eyebrow: "text-sky-400",
        card: "hover:border-sky-400/30 hover:bg-sky-400/5",
      };
    default:
      return {
        eyebrow: "text-primary",
        card: "hover:border-primary/25 hover:bg-primary/5",
      };
  }
}

export function SystemBridge({
  badge,
  title,
  description,
  items,
  className = "",
}: {
  badge: string;
  title: string;
  description: string;
  items: readonly SystemBridgeItem[];
  className?: string;
}) {
  return (
    <div className={`rounded-3xl border border-white/10 bg-card/60 backdrop-blur-xl shadow-xl p-5 space-y-4 ${className}`}>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">{badge}</p>
        <h2 className="mt-2 text-xl md:text-2xl font-bold tracking-tight text-foreground">{title}</h2>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed max-w-2xl">{description}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {items.map((item) => {
          const accent = accentClasses(item.accent);
          return (
            <Link
              key={`${item.href}-${item.title}`}
              href={item.href}
              className={`group rounded-3xl border border-white/10 bg-background/60 p-4 transition-all duration-300 ${accent.card}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2">
                  <p className={`text-[9px] font-bold uppercase tracking-[0.18em] ${accent.eyebrow}`}>
                    {item.eyebrow}
                  </p>
                  <h3 className="text-sm font-bold tracking-tight text-foreground group-hover:text-foreground">
                    {item.title}
                  </h3>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground/50 transition-all group-hover:translate-x-0.5 group-hover:text-foreground" />
              </div>
              <p className="mt-3 text-xs text-muted-foreground leading-relaxed">{item.description}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
