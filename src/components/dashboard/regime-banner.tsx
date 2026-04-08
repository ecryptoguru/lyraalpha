"use client";

import { MarketContextSnapshot } from "@/lib/engines/market-regime";
import { MarketContextBar } from "@/components/dashboard/market/MarketContextBar";
import { cn } from "@/lib/utils";

export function RegimeBanner({
  context,
  className,
}: {
  context: MarketContextSnapshot;
  className?: string;
}) {
  return (
    <MarketContextBar
      context={context}
      className={cn("rounded-2xl", className)}
    />
  );
}
