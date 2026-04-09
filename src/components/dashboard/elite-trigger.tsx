"use client";

import React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  Sparkles,
  ArrowRight,
  BookOpen,
  BarChart3,
  Shield,
  Layers,
  TrendingUp,
  Gem,
} from "lucide-react";
import type { PlanTier } from "@/lib/ai/config";
import {
  getOrCreateBeginnerExperimentVariant,
  trackUpgradeCtaEvent,
} from "@/lib/ux/experiment";

// ─── Trigger Contexts ───────────────────────────────────────────────────────
// Contextual CTAs shown at value-felt moments — not FOMO, but value framing.

type TriggerContext =
  | "discovery_limit_reached"
  | "learning_advanced_locked"
  | "etf_lookthrough_truncated"
  | "crypto_onchain_hidden"
  | "mf_style_drift_hidden"
  | "mf_overlap_locked"
  | "general";

const TRIGGER_CONFIG: Record<TriggerContext, {
  icon: typeof Sparkles;
  headline: string;
  description: string;
  cta: string;
}> = {
  discovery_limit_reached: {
    icon: BarChart3,
    headline: "Finish the discovery system",
    description: "Elite unlocks the full Discovery system — every score shift, peer divergence and cross-asset pattern across the market map.",
    cta: "Unlock Discovery system",
  },
  learning_advanced_locked: {
    icon: BookOpen,
    headline: "Go deeper with advanced learning systems",
    description: "Cross-asset correlation, regime transitions and historical analogs help you turn learning into better portfolio and market decisions.",
    cta: "Unlock Advanced Learning",
  },
  etf_lookthrough_truncated: {
    icon: Layers,
    headline: "Finish the ETF system",
    description: "Factor exposure, concentration risk, behavioral profiles and lookthrough scores help you move from ticker to real ETF understanding.",
    cta: "Unlock ETF system",
  },
  crypto_onchain_hidden: {
    icon: Shield,
    headline: "Unlock the crypto system",
    description: "Network activity, holder stability, liquidity risk and structural trust give you the deeper context behind crypto moves.",
    cta: "Unlock Crypto system",
  },
  mf_style_drift_hidden: {
    icon: TrendingUp,
    headline: "Finish the mutual fund system",
    description: "Style drift detection, closet indexing checks and concentration analysis show whether your fund still matches the job you expect it to do.",
    cta: "Unlock MF system",
  },
  mf_overlap_locked: {
    icon: Layers,
    headline: "Reveal portfolio overlap",
    description: "Overlap detection shows whether multiple funds are quietly creating the same portfolio bet.",
    cta: "Unlock Overlap Detection",
  },
  general: {
    icon: Gem,
    headline: "Unlock the deeper decision system",
    description: "Elite gives you the analytical depth to move between portfolio risk, market narratives, compare decisions and cross-asset reasoning.",
    cta: "Explore Elite systems",
  },
};

// ─── EliteTrigger Component ─────────────────────────────────────────────────

interface EliteTriggerProps {
  context: TriggerContext;
  plan: PlanTier;
  className?: string;
  variant?: "card" | "banner" | "inline";
}

export function EliteTrigger({
  context,
  plan,
  className,
  variant = "card",
}: EliteTriggerProps) {
  const [successfulActionsCount, setSuccessfulActionsCount] = React.useState(0);
  const [experimentVariant, setExperimentVariant] = React.useState<"control" | "treatment">("control");

  const ctaSource = `elite_trigger_${variant}`;

  React.useEffect(() => {
    setExperimentVariant(getOrCreateBeginnerExperimentVariant());
    try {
      const raw = window.localStorage.getItem("ux:successful-actions:v1");
      const parsed = raw ? (JSON.parse(raw) as string[]) : [];
      setSuccessfulActionsCount(Array.from(new Set(parsed)).length);
    } catch {
      // Ignore localStorage read errors
    }
  }, []);

  React.useEffect(() => {
    if (plan === "ELITE" || plan === "ENTERPRISE") return;
    trackUpgradeCtaEvent({
      source: ctaSource,
      eventType: "impression",
      actionCount: successfulActionsCount,
      variant: experimentVariant,
    });
  }, [plan, ctaSource, successfulActionsCount, experimentVariant]);

  if (plan === "ELITE" || plan === "ENTERPRISE") return null;

  const config = TRIGGER_CONFIG[context];
  const Icon = config.icon;
  const isStrongCtaUnlocked = successfulActionsCount >= 2;
  const ctaLabel = isStrongCtaUnlocked
    ? config.cta
    : `Complete 2 actions first (${successfulActionsCount}/2)`;

  if (variant === "inline") {
    return (
      <Link
        href="/dashboard/upgrade"
        onClick={() => {
          trackUpgradeCtaEvent({
            source: ctaSource,
            eventType: "click",
            actionCount: successfulActionsCount,
            variant: experimentVariant,
          });
        }}
        className={cn(
          "flex items-center gap-2 text-[10px] font-bold text-primary/70 hover:text-primary transition-colors uppercase tracking-widest group",
          className,
        )}
      >
        <Sparkles className="h-3 w-3" />
        <span>{ctaLabel}</span>
        <ArrowRight className="h-2.5 w-2.5 transition-transform group-hover:translate-x-0.5" />
      </Link>
    );
  }

  if (variant === "banner") {
    return (
      <Link
        href="/dashboard/upgrade"
        onClick={() => {
          trackUpgradeCtaEvent({
            source: ctaSource,
            eventType: "click",
            actionCount: successfulActionsCount,
            variant: experimentVariant,
          });
        }}
        className={cn(
          "flex items-center justify-between gap-4 px-5 py-3 rounded-2xl border border-primary/20 bg-primary/5 hover:bg-primary/10 hover:border-primary/30 transition-all duration-300 group",
          className,
        )}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-8 w-8 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <Icon className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-bold text-foreground tracking-tight truncate">
              {config.headline}
            </h4>
            <p className="text-[10px] text-muted-foreground truncate">
              {config.description.slice(0, 80)}...
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 text-[10px] font-bold text-primary uppercase tracking-widest shrink-0">
          <span className="hidden sm:inline">{ctaLabel}</span>
          <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
        </div>
      </Link>
    );
  }

  // Default: card variant
  return (
    <div className={cn(
      "rounded-2xl border border-primary/15 bg-linear-to-br from-primary/5 via-background to-background overflow-hidden",
      className,
    )}>
      <div className="p-5 md:p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 shadow-lg shadow-primary/5">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground tracking-tight">
              {config.headline}
            </h3>
            <p className="text-[11px] text-muted-foreground leading-relaxed mt-1">
              {config.description}
            </p>
          </div>
        </div>
        <Link
          href="/dashboard/upgrade"
          onClick={() => {
            trackUpgradeCtaEvent({
              source: ctaSource,
              eventType: "click",
              actionCount: successfulActionsCount,
              variant: experimentVariant,
            });
          }}
          className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-2xl bg-primary/10 border border-primary/30 text-xs font-bold text-primary hover:bg-primary/20 hover:border-primary/50 transition-all duration-300 group"
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span>{ctaLabel}</span>
          <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </div>
  );
}
