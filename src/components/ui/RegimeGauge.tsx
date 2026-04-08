"use client";

import { memo } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface RegimeGaugeProps {
  value: number; // 0-100
  label?: string;
  size?: "sm" | "md" | "lg";
  color?: string;
  showValue?: boolean;
  className?: string;
}

function RegimeGaugeComponent({
  value,
  label,
  size = "md",
  color,
  showValue = true,
  className = "",
}: RegimeGaugeProps) {
  const clampedValue = Math.max(0, Math.min(100, value));

  // Size configurations
  const sizeConfig = {
    sm: { radius: 20, strokeWidth: 3, fontSize: "text-[10px]" },
    md: { radius: 28, strokeWidth: 4, fontSize: "text-xs" },
    lg: { radius: 36, strokeWidth: 5, fontSize: "text-sm" },
  };

  const config = sizeConfig[size];
  const { radius, strokeWidth } = config;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clampedValue / 100) * circumference;

  // Determine color based on value if not provided
  const gaugeColor =
    color ||
    (clampedValue >= 75
      ? "rgb(34, 197, 94)" // emerald-500
      : clampedValue >= 50
        ? "rgb(251, 191, 36)" // amber-400
        : clampedValue >= 25
          ? "rgb(251, 146, 60)" // orange-400
          : "rgb(239, 68, 68)"); // rose-500

  const svgSize = (radius + strokeWidth) * 2;

  return (
    <div className={cn("flex flex-col items-center gap-1", className)}>
      <div className="relative" style={{ width: svgSize, height: svgSize }}>
        <svg width={svgSize} height={svgSize} className="transform -rotate-90">
          {/* Background circle */}
          <circle
            cx={svgSize / 2}
            cy={svgSize / 2}
            r={radius}
            fill="none"
            stroke="hsl(217 32% 12%)"
            strokeWidth={strokeWidth}
            opacity="0.2"
          />

          {/* Progress circle */}
          <motion.circle
            cx={svgSize / 2}
            cy={svgSize / 2}
            r={radius}
            fill="none"
            stroke={gaugeColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{
              duration: 1.2,
              ease: "easeOut",
              type: "spring",
              stiffness: 50,
            }}
            style={{
              filter: `drop-shadow(0 0 4px ${gaugeColor}40)`,
            }}
          />
        </svg>

        {/* Center value */}
        {showValue && (
          <motion.div
            className="absolute inset-0 flex items-center justify-center"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5, duration: 0.3 }}
          >
            <span
              className={cn("font-bold tracking-tighter", config.fontSize)}
              style={{ color: gaugeColor }}
            >
              {Math.round(clampedValue)}
            </span>
          </motion.div>
        )}
      </div>

      {/* Label */}
      {label && (
        <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-wider">
          {label}
        </span>
      )}
    </div>
  );
}

export const RegimeGauge = memo(RegimeGaugeComponent);
RegimeGauge.displayName = "RegimeGauge";
