import { cn } from "@/lib/utils";

interface RegimeBadgeProps {
  regime: string;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

const regimeConfig = {
  STRONG_RISK_ON: {
    label: "Strong Risk On",
    color: "bg-success",
    textColor: "text-success",
    borderColor: "border-success",
  },
  RISK_ON: {
    label: "Risk On",
    color: "bg-success",
    textColor: "text-success",
    borderColor: "border-success",
  },
  NEUTRAL: {
    label: "Neutral",
    color: "bg-muted",
    textColor: "text-muted-foreground",
    borderColor: "border-muted-foreground/50",
  },
  DEFENSIVE: {
    label: "Defensive",
    color: "bg-warning",
    textColor: "text-warning",
    borderColor: "border-warning",
  },
  RISK_OFF: {
    label: "Risk Off",
    color: "bg-danger",
    textColor: "text-danger",
    borderColor: "border-danger",
  },
} as const;

const sizeClasses = {
  sm: "px-2 py-0.5 text-xs",
  md: "px-3 py-1 text-sm",
  lg: "px-4 py-1.5 text-base",
};

export function RegimeBadge({
  regime,
  size = "md",
  showLabel = true,
}: RegimeBadgeProps) {
  const config =
    regimeConfig[regime as keyof typeof regimeConfig] || regimeConfig.NEUTRAL;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-medium border",
        config.color,
        config.textColor,
        config.borderColor,
        sizeClasses[size],
      )}
    >
      {showLabel ? config.label : regime.replace(/_/g, " ")}
    </span>
  );
}
