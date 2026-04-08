"use client";

import React from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Lock, Sparkles, ArrowRight, X, ShieldCheck, Layers, Brain } from "lucide-react";
import type { PlanTier } from "@/lib/ai/config";

// ─── EliteGate ──────────────────────────────────────────────────────────────
// Wraps content that requires Elite plan. Shows blurred teaser for non-Elite.
// Usage:
//   <EliteGate plan={plan} feature="Full Discovery Feed">
//     <FullContent />
//   </EliteGate>
//
//   <EliteGate plan={plan} feature="Cross-Asset Correlation" teaser={<BlurredPreview />}>
//     <FullContent />
//   </EliteGate>

interface EliteGateProps {
  children: React.ReactNode;
  feature: string;
  teaser?: React.ReactNode;
  plan: PlanTier;
  className?: string;
  compact?: boolean;
}

export function EliteGate({
  children,
  feature,
  teaser,
  plan,
  className,
  compact = false,
}: EliteGateProps) {
  const [isModalOpen, setIsModalOpen] = React.useState(false);

  React.useEffect(() => {
    if (!isModalOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsModalOpen(false);
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isModalOpen]);

  if (plan === "ELITE" || plan === "ENTERPRISE") {
    if (className) {
      return <div className={className}>{children}</div>;
    }
    return <>{children}</>;
  }

  return (
    <div className={cn("relative", className)}>
      {/* Blurred teaser content */}
      {teaser ? (
        <div className="relative overflow-hidden rounded-2xl">
          <div className="blur-[6px] pointer-events-none select-none opacity-80">
            {teaser}
          </div>
          <EliteOverlay
            feature={feature}
            compact={compact}
            onOpenModal={() => setIsModalOpen(true)}
          />
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-2xl min-h-[240px]">
          <div className="blur-[6px] pointer-events-none select-none opacity-40 min-h-[240px]">
            {children}
          </div>
          <EliteOverlay
            feature={feature}
            compact={compact}
            onOpenModal={() => setIsModalOpen(true)}
          />
        </div>
      )}

      {isModalOpen && <EliteUpgradeModal onClose={() => setIsModalOpen(false)} />}
    </div>
  );
}

// ─── Overlay CTA ────────────────────────────────────────────────────────────

function EliteOverlay({
  feature,
  compact,
  onOpenModal,
}: {
  feature: string;
  compact: boolean;
  onOpenModal: () => void;
}) {
  if (compact) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-background/10 backdrop-blur-[1px]">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onOpenModal();
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-primary/10 border border-primary/30 text-xs font-bold text-primary hover:bg-primary/20 hover:border-primary/50 transition-all duration-300 group"
        >
          <Lock className="h-3 w-3" />
          <span>Unlock {feature}</span>
          <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/12 backdrop-blur-[1px]">
      <div className="flex flex-col items-center gap-3 max-w-xs text-center px-6">
        <div className="h-12 w-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shadow-lg shadow-primary/5">
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground tracking-tight">
            {feature}
          </h3>
          <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
            Unlock the deeper system for this surface with Elite — more context, stronger reasoning and cleaner next actions.
          </p>
        </div>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onOpenModal();
          }}
          className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-primary/10 border border-primary/30 text-xs font-bold text-primary hover:bg-primary/20 hover:border-primary/50 transition-all duration-300 group"
        >
          <span>See Elite Features</span>
          <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>
    </div>
  );
}

function EliteUpgradeModal({ onClose }: { onClose: () => void }) {
  const copy = {
    badge: "Elite Intelligence Layer",
    title: "Unlock Elite Intelligence",
    description:
      "Three advanced system layers are currently locked on this page. Upgrade to Elite to reveal full Factor DNA, Sync Hub correlations and Institutional Intelligence diagnostics.",
    cta: "Upgrade to Elite",
  };

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-120 bg-background/60 backdrop-blur-xl"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Elite upgrade"
    >
      <div className="absolute inset-0 overflow-y-auto overscroll-contain">
        <div className="min-h-full w-full flex items-start justify-center px-4 py-6 md:px-8 md:py-10">
        <div
          className="w-full max-w-xl rounded-3xl border border-primary/30 bg-background/90 shadow-[0_24px_80px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col"
          onClick={(event) => event.stopPropagation()}
        >
        <div className="relative px-6 pt-6 pb-5 border-b border-white/5 flex flex-col items-center text-center shrink-0">
          <button
            type="button"
            aria-label="Close Elite upgrade modal"
            onClick={onClose}
            className="absolute top-4 right-4 h-8 w-8 rounded-2xl border border-white/5 text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors flex items-center justify-center"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/10 text-[10px] font-bold tracking-widest uppercase text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            {copy.badge}
          </div>

          <h3 className="mt-4 text-2xl md:text-3xl font-bold tracking-tight leading-tight text-foreground">
            <span className="premium-gradient-text">{copy.title}</span>
          </h3>
          <p className="mt-3 text-sm text-muted-foreground leading-relaxed max-w-lg mx-auto">
            {copy.description}
          </p>
        </div>

        <div className="px-6 py-5 space-y-3 text-center">
          <FeaturePoint
            icon={<Layers className="h-4 w-4 text-primary" />}
            title="Factor DNA"
            text="Reveal full Value, Growth, Momentum and Volatility decomposition in one frame."
          />
          <FeaturePoint
            icon={<Brain className="h-4 w-4 text-primary" />}
            title="Sync Hub"
            text="Access cross-asset correlation intelligence with benchmark-level context."
          />
          <FeaturePoint
            icon={<ShieldCheck className="h-4 w-4 text-primary" />}
            title="Institutional Intelligence"
            text="Unlock valuation matrix, analyst target gauge and institutional ownership diagnostics."
          />
        </div>

        <div className="px-6 py-4 border-t border-white/5 bg-background/80 shrink-0">
          <Link
            href="/dashboard/upgrade"
            className="w-full max-w-md mx-auto flex items-center justify-center gap-2 rounded-2xl bg-primary text-black font-bold text-sm px-5 py-3 hover:bg-primary/90 transition-colors group"
          >
            <span>{copy.cta}</span>
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <p className="mt-2 text-[11px] text-center text-muted-foreground/80">
            system-led upgrade options are available from the Upgrade page.
          </p>
        </div>
      </div>
      </div>
      </div>
    </div>,
    document.body,
  );
}

function FeaturePoint({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-white/5 bg-muted/10 p-3 flex flex-col items-center text-center gap-2">
      <div className="h-8 w-8 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-sm font-bold text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{text}</p>
      </div>
    </div>
  );
}

// ─── EliteGateInline ────────────────────────────────────────────────────────
// Inline variant for use within cards/rows (no blur, just a lock badge + link)

interface EliteGateInlineProps {
  feature: string;
  plan: PlanTier;
  children: React.ReactNode;
  className?: string;
}

export function EliteGateInline({ feature, plan, children, className }: EliteGateInlineProps) {
  if (plan === "ELITE" || plan === "ENTERPRISE") {
    return <>{children}</>;
  }

  return (
    <Link
      href="/dashboard/upgrade"
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-2xl border border-primary/20 bg-primary/5 text-xs font-bold text-primary/80 hover:bg-primary/10 hover:border-primary/30 transition-all duration-300 group cursor-pointer",
        className,
      )}
    >
      <Lock className="h-3 w-3 shrink-0" />
      <span className="truncate">{feature}</span>
      <ArrowRight className="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
    </Link>
  );
}
