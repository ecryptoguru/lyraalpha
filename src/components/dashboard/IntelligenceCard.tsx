"use client";

import { memo } from "react";
import { cn } from "@/lib/utils";
import {
  Newspaper,
  ShieldAlert,
  TrendingUp,
  Clock,
  ExternalLink,
} from "lucide-react";
import { getFriendlyAssetName } from "@/lib/format-utils";

interface IntelligenceCardProps {
  event: {
    id: string;
    type: "NEWS" | "RISK" | "SIGNAL";
    title: string;
    date: string;
    asset?: {
      symbol: string;
    };
    source?: string;
    impact?: "HIGH" | "MEDIUM" | "LOW";
  };
  index?: number;
  className?: string;
}

function IntelligenceCardComponent({
  event,
  index = 0,
  className = "",
}: IntelligenceCardProps) {
  const getTypeConfig = (type: string) => {
    switch (type) {
      case "NEWS":
        return {
          icon: Newspaper,
          bg: "bg-cyan-400/10",
          text: "text-cyan-400",
          border: "border-cyan-400/20",
          glow: "from-cyan-400/10",
        };
      case "RISK":
        return {
          icon: ShieldAlert,
          bg: "bg-danger/10",
          text: "text-danger",
          border: "border-danger/20",
          glow: "from-danger/10",
        };
      default:
        return {
          icon: TrendingUp,
          bg: "bg-primary/10",
          text: "text-primary",
          border: "border-primary/20",
          glow: "from-primary/10",
        };
    }
  };

  const getImpactBadge = (impact?: string) => {
    if (!impact) return null;

    const config = {
      HIGH: {
        bg: "bg-danger/10",
        text: "text-danger",
        border: "border-danger/30",
      },
      MEDIUM: {
        bg: "bg-[#FFD700]/10",
        text: "text-[#FFD700]",
        border: "border-[#FFD700]/30",
      },
      LOW: {
        bg: "bg-success/10",
        text: "text-success",
        border: "border-success/30",
      },
    }[impact];

    return (
      <span
        className={cn(
          "text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border",
          config?.bg,
          config?.text,
          config?.border,
        )}
      >
        {impact}
      </span>
    );
  };

  const typeConfig = getTypeConfig(event.type);
  const Icon = typeConfig.icon;

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl border transition-all duration-300",
        "hover:shadow-lg hover:border-border/60 cursor-pointer",
        "animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-both",
        typeConfig.border,
        "bg-card/60 backdrop-blur-2xl shadow-xl",
        className,
      )}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {/* Background glow */}
      <div
        className={cn(
          "absolute inset-0 bg-linear-to-br via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500",
          typeConfig.glow,
        )}
      />

      <div className="relative z-10 p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div
              className={cn("p-1.5 rounded-2xl", typeConfig.bg, typeConfig.text)}
            >
              <Icon className="h-3.5 w-3.5" />
            </div>
            {event.source && (
              <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
                {event.source}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {getImpactBadge(event.impact)}
            <div className="flex items-center gap-1 text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span className="text-[9px] font-bold uppercase tracking-tight" suppressHydrationWarning>
                {formatTime(event.date)}
              </span>
            </div>
          </div>
        </div>

        {/* Title */}
        <div className="space-y-1">
          {event.asset?.symbol && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-primary uppercase tracking-wider">
                {getFriendlyAssetName(event.asset.symbol)}
              </span>
              <span className="text-[8px] text-muted-foreground/40">•</span>
              <span className="text-[9px] font-bold text-muted-foreground uppercase">
                {event.type}
              </span>
            </div>
          )}
          <h4 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-snug">
            {event.title}
          </h4>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-white/5">
          <div className="flex items-center gap-2">
            <button className="text-[9px] font-bold text-muted-foreground hover:text-primary transition-colors uppercase tracking-wider">
              View Details
            </button>
          </div>
          <ExternalLink className="h-3 w-3 text-muted-foreground/40 group-hover:text-primary transition-colors" />
        </div>
      </div>
    </div>
  );
}

export const IntelligenceCard = memo(IntelligenceCardComponent);
IntelligenceCard.displayName = "IntelligenceCard";
