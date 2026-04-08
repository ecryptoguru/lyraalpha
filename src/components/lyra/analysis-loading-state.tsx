import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface AnalysisLoadingStateProps {
  elapsedSeconds: number;
  initialLabel: string;
  reasoningLabel: string;
  reasoningDetail: string;
  finalLabel: string;
  finalDetail: string;
}

export function AnalysisLoadingState({
  elapsedSeconds,
  initialLabel,
  reasoningLabel,
  reasoningDetail,
  finalLabel,
  finalDetail,
}: AnalysisLoadingStateProps) {
  return (
    <div className="flex items-start gap-3 py-2">
      <div className="p-2 rounded-xl bg-primary/10 border border-primary/20 shrink-0 mt-0.5">
        <span
          className={cn("block h-4 w-4", elapsedSeconds > 5 ? "animate-spin" : "animate-pulse")}
          style={{ animationDuration: elapsedSeconds > 5 ? "2s" : "1s" }}
        >
          <Sparkles className="h-4 w-4 text-primary" />
        </span>
      </div>
      <div className="flex flex-col gap-1">
        {elapsedSeconds <= 4 ? (
          <p className="text-xs font-bold text-muted-foreground animate-pulse">{initialLabel}</p>
        ) : elapsedSeconds <= 14 ? (
          <>
            <p className="text-xs font-bold text-primary/80">{reasoningLabel}</p>
            <p className="text-[10px] text-muted-foreground/70">{reasoningDetail}</p>
          </>
        ) : (
          <>
            <p className="text-xs font-bold text-primary">{finalLabel}</p>
            <p className="text-[10px] text-muted-foreground/70">{finalDetail}</p>
          </>
        )}
        {elapsedSeconds > 0 && (
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] text-muted-foreground/50 font-mono">{elapsedSeconds}s</span>
            <div className="flex items-center gap-0.5">
              {[0, 1, 2].map((index) => (
                <div
                  key={index}
                  className="w-1 h-1 rounded-full bg-primary/50"
                  style={{ animation: `pulse 1.2s ease-in-out ${index * 0.2}s infinite` }}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
