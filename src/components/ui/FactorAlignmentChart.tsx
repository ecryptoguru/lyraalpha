import { cn } from "@/lib/utils";

interface FactorData {
  value: number;
  growth: number;
  momentum: number;
  volatility: number;
}

interface FactorAlignmentChartProps {
  factorData: FactorData;
  regimeFit: "STRONG" | "MODERATE" | "WEAK";
  dominantFactor: string;
  score: number;
  explanation: string;
  className?: string;
}

const fitConfig = {
  STRONG: {
    color: "text-success bg-success/5 border-success/20",
    label: "Strong Fit",
  },
  MODERATE: {
    color: "text-primary bg-primary/5 border-primary/20",
    label: "Moderate Fit",
  },
  WEAK: {
    color: "text-warning bg-warning/5 border-warning/20",
    label: "Weak Fit",
  },
};

export function FactorAlignmentChart({
  factorData,
  regimeFit,
  dominantFactor,
  score,
  explanation,
  className,
}: FactorAlignmentChartProps) {
  if (!factorData) {
    return (
      <div className={cn("rounded-xl border bg-white p-4 flex items-center justify-center h-[200px]", className)}>
        <span className="text-xs text-muted-foreground font-medium uppercase tracking-widest">
          Factor Analysis Unavailable
        </span>
      </div>
    );
  }

  const fitStyle = fitConfig[regimeFit] || fitConfig["WEAK"];

  const factors = [
    { name: "Value", value: factorData.value, key: "value" },
    { name: "Growth", value: factorData.growth, key: "growth" },
    { name: "Momentum", value: factorData.momentum, key: "momentum" },
    { name: "Volatility", value: factorData.volatility, key: "volatility" },
  ];

  return (
    <div className={cn("rounded-xl border bg-card p-4", className)}>
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-medium text-foreground">Factor Alignment</h4>
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold text-primary">{score}</span>
          <span
            className={cn(
              "text-xs font-medium px-2 py-1 rounded-full border",
              fitStyle.color,
            )}
          >
            {fitStyle.label}
          </span>
        </div>
      </div>

      {/* Factor Bars */}
      <div className="space-y-3 mb-4">
        {factors.map((factor) => {
          const isDominant = factor.key === dominantFactor;
          return (
            <div key={factor.key}>
              <div className="flex items-center justify-between mb-1">
                <span
                  className={cn(
                    "text-xs font-medium",
                    isDominant ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  {factor.name}
                  {isDominant && <span className="ml-1 text-warning">★</span>}
                </span>
                <span className="text-xs font-semibold text-foreground">
                  {factor.value.toFixed(0)}
                </span>
              </div>
              <div className="h-2 bg-muted/50 rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    isDominant ? "bg-warning" : "bg-muted-foreground/40",
                  )}
                  style={{ width: `${factor.value}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Explanation */}
      <div className="pt-3 border-t">
        <p className="text-xs text-muted-foreground leading-relaxed">{explanation}</p>
      </div>
    </div>
  );
}
