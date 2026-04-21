"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEffect, useRef, useMemo } from "react";
import {
  createChart,
  ColorType,
  IChartApi,
  AreaSeries,
} from "lightweight-charts";

interface CryptoChartProps {
  symbol: string;
  data?: { date: string; price: number }[];
}

export function CryptoChart({ symbol, data }: CryptoChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  // Mock performance data if none provided
  const rawData = useMemo(() => data || [
    { date: "2025-02-25", price: 2800 },
    { date: "2025-03-25", price: 2950 },
    { date: "2025-05-25", price: 2850 },
    { date: "2025-07-25", price: 3000 },
    { date: "2025-08-25", price: 3100 },
    { date: "2025-10-25", price: 2900 },
    { date: "2025-12-25", price: 3200 },
    { date: "2026-02-26", price: 3150 },
  ], [data]);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#64748b",
        attributionLogo: false,
      },
      width: chartContainerRef.current.clientWidth,
      height: 250,
      grid: {
        vertLines: { visible: false },
        horzLines: { color: "#1e293b", style: 1 }, // Dotted style
      },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: {
          top: 0.1,
          bottom: 0.1,
        },
      },
      timeScale: {
        borderVisible: false,
        fixLeftEdge: true,
        fixRightEdge: true,
      },
      handleScroll: false,
      handleScale: false,
    });

    const areaSeries = chart.addSeries(AreaSeries, {
      lineColor: "#3b82f6",
      topColor: "rgba(59, 130, 246, 0.3)",
      bottomColor: "rgba(59, 130, 246, 0.0)",
      lineWidth: 2,
    });

    const formattedData = rawData.map((d) => ({
      time: d.date, // Ensure ISO format YYYY-MM-DD
      value: d.price,
    }));

    // Lightweight charts requires sorted data
    formattedData.sort(
      (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime(),
    );

    areaSeries.setData(formattedData);

    chartRef.current = chart;

    const handleResize = () => {
      chart.applyOptions({ width: chartContainerRef.current!.clientWidth });
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, [rawData]);

  return (
    <Card className="my-6 overflow-hidden border-primary/10 bg-white/80 dark:bg-foreground/50 backdrop-blur-xl">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-mono text-primary flex items-center gap-2">
            PRICE SNAPSHOT: {symbol}
          </CardTitle>
          <div className="flex gap-2">
            <div className="px-2 py-0.5 rounded bg-primary/20 text-[10px] text-primary font-bold">
              1Y PERFORMANCE
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div
          ref={chartContainerRef}
          className="h-[250px] w-full mt-2 relative"
        />
        <div className="grid grid-cols-4 border-t border-primary/10 py-3">
          {[
            { l: "1D", v: "+3.28%", c: "text-success" },
            { l: "1M", v: "-12.70%", c: "text-danger" },
            { l: "1Y", v: "+9.92%", c: "text-success" },
            { l: "5Y", v: "+58.65%", c: "text-success" },
          ].map((m) => (
            <div key={m.l} className="text-center">
              <div className="text-[10px] text-muted-foreground font-bold">{m.l}</div>
              <div className={`text-xs font-mono font-bold ${m.c}`}>{m.v}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
