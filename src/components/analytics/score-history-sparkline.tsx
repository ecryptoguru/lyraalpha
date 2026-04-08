"use client";

import React, { useMemo, useId } from "react";
import { cn } from "@/lib/utils";

interface SparklinePoint {
  date: string;
  value: number;
}

interface ScoreHistorySparklineProps {
  data: SparklinePoint[];
  currentScore: number;
  className?: string;
  height?: number;
  width?: number;
  color?: string;
}

export function ScoreHistorySparkline({
  data,
  currentScore,
  className,
  height = 28,
  width = 80,
  color,
}: ScoreHistorySparklineProps) {
  const uid = useId();
  const path = useMemo(() => {
    if (!data || data.length < 2) return null;

    const values = data.map((d) => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    const points = data.map((d, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((d.value - min) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    return `M ${points.join(" L ")}`;
  }, [data, height, width]);

  const trend = useMemo(() => {
    if (!data || data.length < 3) return "neutral";
    const recent = data.slice(-7);
    const first = recent[0]?.value ?? 0;
    const last = recent[recent.length - 1]?.value ?? 0;
    const diff = last - first;
    if (diff > 3) return "up";
    if (diff < -3) return "down";
    return "neutral";
  }, [data]);

  const strokeColor = color || (
    currentScore >= 70 ? "#10b981" :
    currentScore >= 50 ? "#f59e0b" :
    "#f43f5e"
  );

  if (!path) {
    return (
      <div
        className={cn("flex items-center justify-center opacity-30", className)}
        style={{ width, height }}
      >
        <div className="w-full h-px bg-border" />
      </div>
    );
  }

  return (
    <div className={cn("relative flex items-center gap-1", className)}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="overflow-visible"
      >
        <defs>
          <linearGradient id={`spark-fill-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.15" />
            <stop offset="100%" stopColor={strokeColor} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d={path + ` L ${width},${height} L 0,${height} Z`}
          fill={`url(#spark-fill-${uid})`}
        />
        <path
          d={path}
          fill="none"
          stroke={strokeColor}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span
        className={cn(
          "text-[8px] font-bold",
          trend === "up" ? "text-emerald-400" : trend === "down" ? "text-rose-400" : "text-muted-foreground",
        )}
      >
        {trend === "up" ? "↑" : trend === "down" ? "↓" : "→"}
      </span>
    </div>
  );
}
