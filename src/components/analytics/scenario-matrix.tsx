"use client";

import { useMemo, memo } from "react";
import { TrendingUp, TrendingDown, Minus, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useViewMode } from "@/components/dashboard/view-mode-context";

interface ScenarioData {
  bull: {
    expectedReturn: number;
    probability: number;
    explanation: string;
  };
  base: {
    expectedReturn: number;
    probability: number;
    explanation: string;
  };
  bear: {
    expectedReturn: number;
    probability: number;
    explanation: string;
  };
  var95?: number;
  expectedShortfall?: number;
  fragilityScore?: number;
}

interface ScenarioMatrixProps {
  scenarioData: ScenarioData;
  className?: string;
}

export const ScenarioMatrix = memo(function ScenarioMatrix({ scenarioData, className }: ScenarioMatrixProps) {
  const { mode } = useViewMode();

  const scenarios = useMemo(() => [
    {
      key: "bull",
      label: "Bull Case",
      icon: TrendingUp,
      color: "text-green-600",
      bg: "bg-green-50",
      borderColor: "border-green-200",
      data: scenarioData.bull,
    },
    {
      key: "base",
      label: "Base Case",
      icon: Minus,
      color: "text-amber-600",
      bg: "bg-amber-50",
      borderColor: "border-amber-200",
      data: scenarioData.base,
    },
    {
      key: "bear",
      label: "Bear Case",
      icon: TrendingDown,
      color: "text-red-600",
      bg: "bg-red-50",
      borderColor: "border-red-200",
      data: scenarioData.bear,
    },
  ] as const, [scenarioData]);

  if (mode === "simple") {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Scenario Analysis</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {scenarios.map((scenario) => {
            const Icon = scenario.icon;
            return (
              <div
                key={scenario.key}
                className={`rounded-2xl border ${scenario.borderColor} ${scenario.bg} p-3`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${scenario.color}`} />
                    <span className="text-sm font-semibold">{scenario.label}</span>
                  </div>
                  <span className={`text-lg font-bold ${scenario.color}`}>
                    {scenario.data.expectedReturn > 0 ? "+" : ""}
                    {scenario.data.expectedReturn.toFixed(1)}%
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{scenario.data.explanation}</p>
              </div>
            );
          })}
        </CardContent>
      </Card>
    );
  }

  // Advanced mode
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">Scenario Analysis</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Scenario Cards */}
        <div className="grid gap-3">
          {scenarios.map((scenario) => {
            const Icon = scenario.icon;
            return (
              <div
                key={scenario.key}
                className={`rounded-2xl border ${scenario.borderColor} ${scenario.bg} p-4`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Icon className={`h-5 w-5 ${scenario.color}`} />
                    <div>
                      <div className="text-sm font-semibold">{scenario.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {scenario.data.probability}% probability
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-xl font-bold ${scenario.color}`}>
                      {scenario.data.expectedReturn > 0 ? "+" : ""}
                      {scenario.data.expectedReturn.toFixed(1)}%
                    </div>
                    <div className="text-xs text-muted-foreground">Expected Return</div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{scenario.data.explanation}</p>
              </div>
            );
          })}
        </div>

        {/* Risk Metrics */}
        {(scenarioData.var95 !== undefined || scenarioData.expectedShortfall !== undefined) && (
          <div className="space-y-3 border-t pt-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Risk Metrics
            </div>
            <div className="grid grid-cols-2 gap-3">
              {scenarioData.var95 !== undefined && (
                <div className="rounded-2xl border border-white/5 bg-muted/30 p-3">
                  <div className="text-xs text-muted-foreground mb-1">VaR (95%)</div>
                  <div className="text-lg font-bold text-orange-600">
                    {scenarioData.var95.toFixed(1)}%
                  </div>
                </div>
              )}
              {scenarioData.expectedShortfall !== undefined && (
                <div className="rounded-2xl border border-white/5 bg-muted/30 p-3">
                  <div className="text-xs text-muted-foreground mb-1">Expected Shortfall</div>
                  <div className="text-lg font-bold text-red-600">
                    {scenarioData.expectedShortfall.toFixed(1)}%
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Fragility Score */}
        {scenarioData.fragilityScore !== undefined && (
          <div className="flex items-center gap-3 rounded-2xl border border-orange-200 bg-orange-50 p-3">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
            <div className="flex-1">
              <div className="text-xs font-semibold">Fragility Score</div>
              <div className="text-xs text-muted-foreground">
                Asset vulnerability to market stress
              </div>
            </div>
            <div className="text-xl font-bold text-orange-600">
              {scenarioData.fragilityScore.toFixed(0)}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
});
