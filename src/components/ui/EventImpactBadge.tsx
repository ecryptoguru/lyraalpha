import { AlertCircle, AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface EventImpactBadgeProps {
  severity: "HIGH" | "MEDIUM" | "LOW";
  impactMagnitude: number;
  eventCount?: number;
  className?: string;
}

const severityConfig = {
  HIGH: {
    icon: AlertCircle,
    color: "bg-destructive/10 text-destructive border-destructive/20",
    label: "High Impact",
  },
  MEDIUM: {
    icon: AlertTriangle,
    color: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    label: "Medium Impact",
  },
  LOW: {
    icon: Info,
    color: "bg-primary/10 text-primary border-primary/20",
    label: "Low Impact",
  },
};

export function EventImpactBadge({
  severity,
  impactMagnitude,
  eventCount,
  className,
}: EventImpactBadgeProps) {
  const config = severityConfig[severity] || severityConfig["LOW"];
  const Icon = config.icon;
  const isPositive = impactMagnitude > 0;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border",
        config.color,
        className,
      )}
    >
      <Icon className="h-4 w-4" />
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium">{config.label}</span>
        <span
          className={cn(
            "text-xs font-semibold",
            isPositive ? "text-green-700" : "text-red-700",
          )}
        >
          {isPositive ? "+" : ""}
          {impactMagnitude.toFixed(1)}%
        </span>
        {eventCount && eventCount > 0 && (
          <span className="text-xs opacity-75">
            ({eventCount} {eventCount === 1 ? "event" : "events"})
          </span>
        )}
      </div>
    </div>
  );
}
