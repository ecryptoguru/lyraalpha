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
    color: "text-green-600 bg-green-50 border-green-200",
    label: "Strong Fit",
  },
  MODERATE: {
    color: "text-amber-600 bg-amber-50 border-amber-200",
    label: "Moderate Fit",
  },
  WEAK: {
    color: "text-orange-600 bg-orange-50 border-orange-200",
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
    <div className={cn("rounded-xl border bg-white p-4", className)}>
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-medium text-gray-700">Factor Alignment</h4>
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold text-amber-600">{score}</span>
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
                    isDominant ? "text-amber-700" : "text-gray-600",
                  )}
                >
                  {factor.name}
                  {isDominant && <span className="ml-1 text-amber-500">★</span>}
                </span>
                <span className="text-xs font-semibold text-gray-700">
                  {factor.value.toFixed(0)}
                </span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    isDominant ? "bg-amber-500" : "bg-gray-400",
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
        <p className="text-xs text-gray-600 leading-relaxed">{explanation}</p>
      </div>
    </div>
  );
}
