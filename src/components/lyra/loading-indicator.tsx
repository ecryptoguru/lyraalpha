"use client";

import { useState, useEffect, memo } from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

// Isolated loading indicator with its own elapsed timer — prevents the parent
// from re-rendering every second during loading.
export const LoadingIndicator = memo(function LoadingIndicator({
  loadingStartTime,
}: {
  loadingStartTime: number | null;
}) {
  const [elapsed, setElapsed] = useState(() =>
    loadingStartTime ? Math.floor((Date.now() - loadingStartTime) / 1000) : 0,
  );

  useEffect(() => {
    if (!loadingStartTime) return;
    const start = loadingStartTime;
    const update = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [loadingStartTime]);

  if (!loadingStartTime) return null;

  return (
    <div className="flex items-start gap-3 px-1 py-3 animate-in fade-in duration-300">
      <div className="p-2 rounded-2xl bg-primary/10 border border-primary/20 shrink-0 mt-0.5">
        <Sparkles className={cn("h-3.5 w-3.5 text-primary", elapsed > 5 ? "animate-spin" : "animate-pulse")} style={{ animationDuration: elapsed > 5 ? "2s" : "1s" }} />
      </div>
      <div className="flex flex-col gap-1 min-w-0">
        {elapsed <= 4 ? (
          <p className="text-xs font-bold text-muted-foreground animate-pulse">Lyra is analyzing...</p>
        ) : elapsed <= 14 ? (
          <>
            <p className="text-xs font-bold text-primary/80">Lyra is reasoning deeply...</p>
            <p className="text-[10px] text-muted-foreground/70 leading-relaxed">Cross-referencing signals &amp; market regime</p>
          </>
        ) : (
          <>
            <p className="text-xs font-bold text-primary">Lyra is building full institutional analysis...</p>
            <p className="text-[10px] text-muted-foreground/70 leading-relaxed">Deep synthesis in progress — 20–45s for complex queries</p>
          </>
        )}
        {elapsed > 0 && (
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-muted-foreground/50 font-mono">{elapsed}s</span>
            <div className="flex items-center gap-0.5">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-1 h-1 rounded-full bg-primary/50"
                  style={{ animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
