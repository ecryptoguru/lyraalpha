import { Sparkles, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

interface IntelligenceLoaderProps {
  message?: string;
  subtext?: string;
  className?: string;
}

export function IntelligenceLoader({
  message = "Loading...",
  subtext = "Fetching market data",
  className,
}: IntelligenceLoaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center min-h-[60vh] gap-8 animate-in fade-in duration-500",
        className,
      )}
      suppressHydrationWarning
    >
      <div className="relative group" suppressHydrationWarning>
        {/* Outer Glow Ring */}
        <div
          className="absolute -inset-4 bg-primary/20 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-1000 animate-pulse"
          suppressHydrationWarning
        />

        {/* Main Spinner Shell */}
        <div
          className="relative h-16 w-16 rounded-full border-2 border-primary/20 flex items-center justify-center bg-background/50 backdrop-blur-xl"
          suppressHydrationWarning
        >
          {/* Inner Rotating Ring */}
          <div
            className="absolute inset-0 rounded-full border-t-2 border-primary animate-spin"
            suppressHydrationWarning
          />

          {/* Center Icon */}
          <Sparkles className="h-6 w-6 text-primary animate-pulse" />
        </div>
      </div>

      <div className="text-center space-y-3 font-data" suppressHydrationWarning>
        <h3 className="text-base font-bold tracking-widest uppercase premium-gradient-text animate-pulse">
          {message}
        </h3>
        <div
          className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] opacity-80"
          suppressHydrationWarning
        >
          <Activity className="h-3 w-3" />
          {subtext}
        </div>
      </div>
    </div>
  );
}
