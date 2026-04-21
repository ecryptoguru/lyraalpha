"use client";

import { Card, CardContent } from "@/components/ui/card";

interface FinancialTableProps {
  title: string;
  data: Array<{ metric: string; value: string | number; context?: string }>;
}

export function FinancialTable({ title, data }: FinancialTableProps) {
  return (
    <Card className="my-6 border-primary/10 bg-white/80 dark:bg-foreground/30">
      <div className="px-4 py-3 border-b border-primary/10">
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
          {title}
        </h3>
      </div>
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-primary/5 text-muted-foreground text-[10px]">
              <th className="px-4 py-2 text-left font-medium">METRIC</th>
              <th className="px-4 py-2 text-right font-medium">VALUE</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30 dark:divide-primary/5">
            {data.map((row, i) => (
              <tr
                key={i}
                className="group hover:bg-primary/5 transition-colors"
              >
                <td className="px-4 py-3">
                  <div className="font-medium text-foreground">{row.metric}</div>
                  {row.context && (
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      {row.context}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-mono font-bold text-primary">
                  {row.value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
