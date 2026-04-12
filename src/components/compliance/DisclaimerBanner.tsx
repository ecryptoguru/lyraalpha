"use client";

import { X } from "lucide-react";
import { useState } from "react";

export function DisclaimerBanner() {
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);

  if (dismissed) return null;

  return (
    <div className="border-b border-amber-500/20 bg-amber-500/5 px-4 py-2">
      <div className="container mx-auto max-w-7xl flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold text-amber-900 dark:text-amber-100">
              Investment Disclaimer
            </p>
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="text-[10px] text-amber-700/60 hover:text-amber-900 dark:text-amber-300/60 dark:hover:text-amber-100 transition-colors underline underline-offset-2 sm:hidden"
            >
              {expanded ? "less" : "more"}
            </button>
          </div>
          <p className={`mt-1 text-[10px] leading-5 text-amber-800/80 dark:text-amber-200/70 ${expanded ? "" : "hidden sm:block"}`}>
            This platform provides informational and educational content only. Nothing constitutes investment advice, financial recommendations, or solicitations.
            Cryptocurrencies and digital assets are highly volatile. Past performance does not indicate future results. You are solely responsible for your investment decisions.
          </p>
          <p className={`mt-0.5 text-[10px] leading-5 text-amber-800/80 dark:text-amber-200/70 sm:hidden ${expanded ? "hidden" : ""}`}>
            For informational purposes only. Not investment advice.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="shrink-0 text-amber-700/60 hover:text-amber-900 dark:text-amber-300/60 dark:hover:text-amber-100 transition-colors"
          aria-label="Dismiss disclaimer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
