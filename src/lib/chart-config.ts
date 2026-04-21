// Chart theme configuration for consistent visualization styling
export const chartTheme = {
  colors: {
    primary: "hsl(193 100% 50%)", // cyan-500 #00D4FF
    success: "hsl(142 76% 36%)", // green-600
    warning: "hsl(51 100% 50%)", // gold #FFD700
    danger: "hsl(0 84% 60%)", // rose-500
    info: "hsl(193 100% 50%)", // cyan-500 #00D4FF
    muted: "hsl(217 32% 17%)", // slate-700
  },

  grid: {
    stroke: "hsl(217 32% 12%)", // Subtle grid lines
    strokeDasharray: "3 3",
    strokeWidth: 1,
    opacity: 0.2,
  },

  tooltip: {
    background: "hsl(222 47% 8%)", // card background
    border: "hsl(217 32% 12%)",
    borderRadius: 8,
    padding: 12,
    shadow: "0 4px 6px -1px rgb(0 0 0 / 0.3)",
  },

  axis: {
    stroke: "hsl(217 32% 17%)",
    strokeWidth: 1,
    fontSize: 10,
    fontWeight: 600,
    color: "hsl(215 20% 65%)", // muted-foreground
  },

  legend: {
    fontSize: 11,
    fontWeight: 600,
    color: "hsl(215 20% 65%)",
    spacing: 16,
  },

  // Regime-specific colors
  regimes: {
    STRONG_RISK_ON: "hsl(142 76% 36%)", // emerald-500
    RISK_ON: "hsl(142 71% 45%)", // green-500
    NEUTRAL: "hsl(215 16% 47%)", // slate-400
    DEFENSIVE: "hsl(51 100% 50%)", // gold #FFD700
    RISK_OFF: "hsl(0 84% 60%)", // rose-500
  },

  // Gradient definitions for area charts
  gradients: {
    primary: {
      start: "hsl(193 100% 50% / 0.3)",
      end: "hsl(193 100% 50% / 0.05)",
    },
    success: {
      start: "hsl(142 76% 36% / 0.3)",
      end: "hsl(142 76% 36% / 0.05)",
    },
    danger: {
      start: "hsl(0 84% 60% / 0.3)",
      end: "hsl(0 84% 60% / 0.05)",
    },
  },

  // Animation settings
  animation: {
    duration: 800,
    easing: "ease-in-out",
  },
};

// Helper function to get color by regime
export function getRegimeColor(regime: string): string {
  return (
    chartTheme.regimes[regime as keyof typeof chartTheme.regimes] ||
    chartTheme.colors.muted
  );
}

// Helper function to get gradient by type
export function getGradientId(type: "primary" | "success" | "danger"): string {
  return `gradient-${type}`;
}

// Export type for TypeScript support
export type ChartTheme = typeof chartTheme;
