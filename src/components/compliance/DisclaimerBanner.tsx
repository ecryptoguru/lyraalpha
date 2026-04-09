"use client";

import { X } from "lucide-react";
import { useState } from "react";

export function DisclaimerBanner() {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="border-b border-amber-500/20 bg-amber-500/5 px-4 py-2">
      <div className="container mx-auto max-w-7xl flex items-start gap-3">
        <div className="flex-1">
          <p className="text-xs font-semibold text-amber-900 dark:text-amber-100">
            Investment Disclaimer
          </p>
          <p className="mt-1 text-[10px] leading-5 text-amber-800/80 dark:text-amber-200/70">
            This platform provides informational and educational content only. Nothing constitutes investment advice, financial recommendations, or solicitations. 
            Cryptocurrencies and digital assets are highly volatile. Past performance does not indicate future results. You are solely responsible for your investment decisions.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="text-amber-700/60 hover:text-amber-900 dark:text-amber-300/60 dark:hover:text-amber-100 transition-colors"
          aria-label="Dismiss disclaimer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
