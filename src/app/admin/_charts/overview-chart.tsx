"use client";

import { PieChart, Pie, Cell, Tooltip } from "recharts";

const PLAN_COLORS: Record<string, string> = {
  STARTER: "#64748b",
  PRO: "#3b82f6",
  ELITE: "#f59e0b",
  ENTERPRISE: "#0ea5e9",
};

export function PlanDistributionChart({ data }: { data: { name: string; value: number }[] }) {
  return (
    <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
      <div className="flex h-32 w-32 items-center justify-center sm:h-40 sm:w-40">
        <PieChart width={160} height={160}>
          <Pie data={data} cx="50%" cy="50%" innerRadius={35} outerRadius={65} paddingAngle={2} dataKey="value">
            {data.map((entry) => (
              <Cell key={entry.name} fill={PLAN_COLORS[entry.name] || "#64748b"} />
            ))}
          </Pie>
          <Tooltip contentStyle={{ background: "hsl(222 47% 8%)", border: "1px solid hsl(217 32% 12%)", borderRadius: 8, fontSize: 11 }} />
        </PieChart>
      </div>
      <div className="space-y-1.5 sm:space-y-2 w-full sm:w-auto">
        {data.map((entry) => (
          <div key={entry.name} className="flex items-center gap-2">
            <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full shrink-0" style={{ background: PLAN_COLORS[entry.name] || "#64748b" }} />
            <span className="text-[10px] sm:text-xs font-semibold text-foreground">{entry.name}</span>
            <span className="text-[10px] sm:text-xs text-muted-foreground ml-auto">{entry.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
