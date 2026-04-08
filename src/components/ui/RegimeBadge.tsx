import { cn } from "@/lib/utils";

interface RegimeBadgeProps {
  regime: string;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

const regimeConfig = {
  STRONG_RISK_ON: {
    label: "Strong Risk On",
    color: "bg-green-500",
    textColor: "text-green-50",
    borderColor: "border-green-600",
  },
  RISK_ON: {
    label: "Risk On",
    color: "bg-green-400",
    textColor: "text-green-900",
    borderColor: "border-green-500",
  },
  NEUTRAL: {
    label: "Neutral",
    color: "bg-gray-400",
    textColor: "text-gray-900",
    borderColor: "border-gray-500",
  },
  DEFENSIVE: {
    label: "Defensive",
    color: "bg-orange-400",
    textColor: "text-orange-900",
    borderColor: "border-orange-500",
  },
  RISK_OFF: {
    label: "Risk Off",
    color: "bg-red-500",
    textColor: "text-red-50",
    borderColor: "border-red-600",
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
