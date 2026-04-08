"use client";

import { memo } from "react";
import { motion } from "framer-motion";

interface SparklineChartProps {
  data: number[];
  color?: string;
  height?: number;
  width?: number;
  showDot?: boolean;
  className?: string;
}

function SparklineChartComponent({
  data,
  color = "rgb(34, 197, 94)", // emerald-500
  height = 32,
  width = 80,
  showDot = true,
  className = "",
}: SparklineChartProps) {
  if (!data || data.length < 2) {
    return (
      <div
        className={`flex items-center justify-center ${className}`}
        style={{ height, width }}
      >
        <span className="text-[8px] text-muted-foreground/40">No data</span>
      </div>
    );
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  // Generate SVG path
  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = height - ((value - min) / range) * height;
    return { x, y };
  });

  const pathData = points
    .map((point, index) => {
      if (index === 0) return `M ${point.x} ${point.y}`;
      return `L ${point.x} ${point.y}`;
    })
    .join(" ");

  // Area fill path
  const areaPathData = `${pathData} L ${width} ${height} L 0 ${height} Z`;

  const lastPoint = points[points.length - 1];
  const trend = data[data.length - 1] > data[0] ? "up" : "down";

  return (
    <div className={`relative ${className}`} style={{ height, width }}>
      <svg
        width={width}
        height={height}
        className="overflow-visible"
        style={{ display: "block" }}
      >
        {/* Area gradient */}
        <defs>
          <linearGradient
            id={`gradient-${color}`}
            x1="0%"
            y1="0%"
            x2="0%"
            y2="100%"
          >
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0.05" />
          </linearGradient>
        </defs>

        {/* Area fill */}
        <motion.path
          d={areaPathData}
          fill={`url(#gradient-${color})`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        />

        {/* Line */}
        <motion.path
          d={pathData}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
        />

        {/* End dot */}
        {showDot && (
          <motion.circle
            cx={lastPoint.x}
            cy={lastPoint.y}
            r="2.5"
            fill={color}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.8, type: "spring", stiffness: 200 }}
          >
            <animate
              attributeName="r"
              values="2.5;3.5;2.5"
              dur="2s"
              repeatCount="indefinite"
            />
          </motion.circle>
        )}
      </svg>

      {/* Trend indicator */}
      <div className="absolute -top-1 -right-1">
        <span
          className={`text-[8px] font-bold ${
            trend === "up" ? "text-emerald-400" : "text-rose-400"
          }`}
        >
          {trend === "up" ? "↗" : "↘"}
        </span>
      </div>
    </div>
  );
}

export const SparklineChart = memo(SparklineChartComponent);
SparklineChart.displayName = "SparklineChart";
