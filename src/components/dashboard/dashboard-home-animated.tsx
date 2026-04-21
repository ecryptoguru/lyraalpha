"use client";

import type { ReactNode } from "react";
import { StaggerEntry, StaggerItem } from "@/components/dashboard/stagger-entry";

interface DashboardHomeAnimatedProps {
  briefCard: ReactNode;
  feedPreviews: ReactNode;
  insightFeed: ReactNode;
}

/**
 * Client wrapper that adds coordinated stagger entry animations
 * to the three main sections of the dashboard home page.
 */
export function DashboardHomeAnimated({
  briefCard,
  feedPreviews,
  insightFeed,
}: DashboardHomeAnimatedProps) {
  return (
    <StaggerEntry className="space-y-6" staggerMs={60}>
      {/* Brief + Where to go next */}
      <StaggerItem>
        <div id="market-intelligence" className="relative z-10">
          <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_0.65fr] gap-4">
            {briefCard}
          </div>
        </div>
      </StaggerItem>

      {/* Feed previews */}
      <StaggerItem>
        <div className="relative z-10 space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Today&apos;s feeds</p>
          {feedPreviews}
        </div>
      </StaggerItem>

      {/* Insight feed */}
      <StaggerItem>
        <div className="relative z-10 space-y-3">
          {insightFeed}
        </div>
      </StaggerItem>
    </StaggerEntry>
  );
}
