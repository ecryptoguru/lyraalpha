"use client";

import { useState } from "react";
import { Crown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface TrialBannerProps {
  trialEndsAt: string | null;
  plan: string;
}

function getDaysRemaining(trialEndsAt: string): number {
  const end = new Date(trialEndsAt);
  const now = new Date();
  const diff = end.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export function TrialBanner({ trialEndsAt, plan }: TrialBannerProps) {
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return sessionStorage.getItem(`trial-banner-dismissed:${trialEndsAt}`) === "1";
    } catch {
      return false;
    }
  });

  if (!trialEndsAt || plan === "STARTER" || dismissed) return null;

  const daysLeft = getDaysRemaining(trialEndsAt);
  if (daysLeft <= 0) return null;

  const isUrgent = daysLeft <= 3;

  function handleDismiss() {
    setDismissed(true);
    try {
      sessionStorage.setItem(`trial-banner-dismissed:${trialEndsAt}`, "1");
    } catch { /* ignore */ }
  }

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 px-4 py-2.5 text-sm font-medium border-b",
        isUrgent
          ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
          : "bg-primary/5 border-primary/20 text-primary"
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        <Crown className="h-4 w-4 shrink-0" />
        <span className="truncate">
          {isUrgent
            ? `Your Elite trial expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"} — upgrade to keep access`
            : `Elite trial active — ${daysLeft} day${daysLeft === 1 ? "" : "s"} remaining`}
        </span>
        <Link
          href="/dashboard/upgrade"
          className="shrink-0 underline underline-offset-2 hover:opacity-80 transition-opacity"
        >
          Upgrade now
        </Link>
      </div>
      <button
        onClick={handleDismiss}
        className="shrink-0 opacity-80 hover:opacity-100 transition-opacity"
        aria-label="Dismiss trial banner"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
