"use client";

import { useEffect, useRef, memo, useMemo } from "react";
import {
  createChart,
  ColorType,
  IChartApi,
  CandlestickSeries,
  AreaSeries,
  LineSeries,
  ISeriesApi,
  createSeriesMarkers,
  ISeriesMarkersPluginApi,
  SeriesMarker,
  Time,
  CandlestickData,
  AreaData,
  WhitespaceData,
  LineData
} from "lightweight-charts";
import { OHLCV } from "@/lib/engines/types";
import { AssetAnalyticsResponse, ChartMarker } from "@/types/analytics";

function isValidChartRow(row: OHLCV | undefined | null): row is OHLCV {
  return !!row
    && typeof row.date === "string"
    && Number.isFinite(row.open)
    && Number.isFinite(row.high)
    && Number.isFinite(row.low)
    && Number.isFinite(row.close);
}

// Calculate Simple Moving Average
function calculateSMA(data: OHLCV[], period: number): { time: string; value: number }[] {
  if (data.length < period) return [];
  
  const result: { time: string; value: number }[] = [];
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += data[i - j].close;
    }
    result.push({
      time: data[i].date.split("T")[0],
      value: sum / period
    });
  }
  return result;
}

// Calculate Exponential Moving Average
function calculateEMA(data: OHLCV[], period: number): { time: string; value: number }[] {
  if (data.length < period) return [];
  
  const result: { time: string; value: number }[] = [];
  const multiplier = 2 / (period + 1);
  
  // First EMA is SMA
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += data[i].close;
  }
  let ema = sum / period;
  result.push({ time: data[period - 1].date.split("T")[0], value: ema });
  
  // Calculate rest
  for (let i = period; i < data.length; i++) {
    ema = (data[i].close - ema) * multiplier + ema;
    result.push({ time: data[i].date.split("T")[0], value: ema });
  }
  return result;
}

// Calculate Bollinger Bands
function calculateBollingerBands(data: OHLCV[], period: number = 20, stdDev: number = 2): {
  upper: { time: string; value: number }[];
  middle: { time: string; value: number }[];
  lower: { time: string; value: number }[];
} {
  const sma = calculateSMA(data, period);
  if (sma.length === 0) return { upper: [], middle: [], lower: [] };
  
  const upper: { time: string; value: number }[] = [];
  const middle = sma;
  const lower: { time: string; value: number }[] = [];
  
  for (let i = 0; i < sma.length; i++) {
    const dataIdx = i + period - 1;
    let sumSq = 0;
    for (let j = 0; j < period; j++) {
      sumSq += Math.pow(data[dataIdx - j].close - sma[i].value, 2);
    }
    const sd = Math.sqrt(sumSq / period);
    upper.push({ time: sma[i].time, value: sma[i].value + stdDev * sd });
    lower.push({ time: sma[i].time, value: sma[i].value - stdDev * sd });
  }
  
  return { upper, middle, lower };
}

interface PriceChartProps {
  data: (OHLCV & { events?: AssetAnalyticsResponse["events"] })[];
  colors?: {
    backgroundColor?: string;
    lineColor?: string;
    textColor?: string;
    areaTopColor?: string;
    areaBottomColor?: string;
  };
  chartType?: "CANDLESTICK" | "AREA";
}

export function PriceChart({ data, colors = {}, chartType = "CANDLESTICK" }: PriceChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick" | "Area"> | null>(null);
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const smaRef = useRef<ISeriesApi<"Line"> | null>(null);
  const emaRef = useRef<ISeriesApi<"Line"> | null>(null);
  const bbUpperRef = useRef<ISeriesApi<"Line"> | null>(null);
  const bbLowerRef = useRef<ISeriesApi<"Line"> | null>(null);

  const safeData = useMemo(() => {
    if (!Array.isArray(data)) return [];
    return data.filter((row): row is OHLCV & { events?: AssetAnalyticsResponse["events"] } => isValidChartRow(row));
  }, [data]);

  // Calculate indicators
  const indicators = useMemo(() => ({
    sma20: calculateSMA(safeData, 20),
    ema20: calculateEMA(safeData, 20),
    bollinger: calculateBollingerBands(safeData, 20, 2),
  }), [safeData]);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const container = chartContainerRef.current;

    const {
      backgroundColor = "transparent",
      textColor = "rgba(120,120,120,0.5)",
    } = colors;

    const CHART_HEIGHT = 420;

    const chart = createChart(chartContainerRef.current, {
      autoSize: false,
      layout: {
        background: { type: ColorType.Solid, color: backgroundColor },
        textColor,
      },
      width: container.clientWidth,
      height: CHART_HEIGHT,
      grid: {
        vertLines: { color: "rgba(197, 203, 206, 0.05)" },
        horzLines: { color: "rgba(197, 203, 206, 0.05)" },
      },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false },
    });

    let series: ISeriesApi<"Candlestick" | "Area">;

    if (chartType === "AREA") {
      series = chart.addSeries(AreaSeries, {
        topColor: colors.areaTopColor || "rgba(33, 150, 243, 0.56)",
        bottomColor: colors.areaBottomColor || "rgba(33, 150, 243, 0.04)",
        lineColor: colors.lineColor || "rgba(33, 150, 243, 1)",
        lineWidth: 2,
      });
    } else {
      series = chart.addSeries(CandlestickSeries, {
        upColor: "#26a69a",
        downColor: "#ef5350",
        borderVisible: false,
        wickUpColor: "#26a69a",
        wickDownColor: "#ef5350",
      });
    }
    
    const markersPlugin = createSeriesMarkers(series);
    
    // Add indicator series
    const smaSeries = chart.addSeries(LineSeries, { color: "rgba(255, 152, 0, 0.8)", lineWidth: 1 });
    const emaSeries = chart.addSeries(LineSeries, { color: "rgba(156, 39, 176, 0.8)", lineWidth: 1 });
    const bbUpperSeries = chart.addSeries(LineSeries, { color: "rgba(96, 165, 250, 0.3)", lineWidth: 1 });
    const bbLowerSeries = chart.addSeries(LineSeries, { color: "rgba(96, 165, 250, 0.3)", lineWidth: 1 });
    
    chartRef.current = chart;
    seriesRef.current = series;
    markersRef.current = markersPlugin;
    smaRef.current = smaSeries;
    emaRef.current = emaSeries;
    bbUpperRef.current = bbUpperSeries;
    bbLowerRef.current = bbLowerSeries;

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry || !chartRef.current) return;
      chartRef.current.applyOptions({ width: entry.contentRect.width });
      chartRef.current.timeScale().fitContent();
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      markersRef.current = null;
      smaRef.current = null;
      emaRef.current = null;
      bbUpperRef.current = null;
      bbLowerRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartType, colors.backgroundColor, colors.textColor, colors.lineColor, colors.areaTopColor, colors.areaBottomColor]); // Stable primitives — avoids re-creating on every inline {} default

  useEffect(() => {
    if (!chartRef.current || !seriesRef.current) return;

    if (safeData.length === 0) {
      seriesRef.current.setData([]);
      markersRef.current?.setMarkers([]);
      smaRef.current?.setData([]);
      emaRef.current?.setData([]);
      bbUpperRef.current?.setData([]);
      bbLowerRef.current?.setData([]);
      return;
    }

    // 1. Deduplicate and format chart data
    const seenDates = new Set<string>();
    const chartData: (CandlestickData<Time> | AreaData<Time> | WhitespaceData<Time>)[] = [];
    const markers: ChartMarker[] = [];

    // Process ASC for fitContent and marker alignment
    safeData.forEach((d) => {
      const timeStr = d.date.split("T")[0];
      if (!seenDates.has(timeStr)) {
        seenDates.add(timeStr);
        
        if (chartType === "AREA") {
           // Area series expects { time, value }
           chartData.push({
             time: timeStr as Time,
             value: d.close, 
           });
        } else {
           // Candlestick expects { time, open, high, low, close }
           chartData.push({
             time: timeStr as Time,
             open: d.open,
             high: d.high,
             low: d.low,
             close: d.close,
           });
        }

        // 2. Extract markers in-loop (Efficient)
        if (d.events && d.events.length > 0) {
          d.events.forEach((e) => {
            markers.push({
              time: timeStr,
              position: "belowBar",
              color: e.type === "EARNINGS" ? "#f2c600" : "#2196f3",
              shape: "circle",
              text: e.type === "EARNINGS" ? "E" : "D",
            });
          });
        }
      }
    });

    // Lightweight charts requires sorted data (ascending)
    chartData.sort((a, b) => new Date(a.time as string).getTime() - new Date(b.time as string).getTime());

    seriesRef.current.setData(chartData);
    if (markersRef.current) {
      markersRef.current.setMarkers(markers as SeriesMarker<Time>[]);
    }
    
    // Set indicator data
    if (smaRef.current) {
      smaRef.current.setData(indicators.sma20 as LineData<Time>[]);
    }
    if (emaRef.current) {
      emaRef.current.setData(indicators.ema20 as LineData<Time>[]);
    }
    if (bbUpperRef.current) {
      bbUpperRef.current.setData(indicators.bollinger.upper as LineData<Time>[]);
    }
    if (bbLowerRef.current) {
      bbLowerRef.current.setData(indicators.bollinger.lower as LineData<Time>[]);
    }
    
    chartRef.current.timeScale().fitContent();
  }, [safeData, chartType, indicators]);

  return <div ref={chartContainerRef} className="w-full" style={{ height: "420px", minHeight: "420px", contain: "strict" }} data-testid="price-chart" />;
}

export const PriceChartMemo = memo(PriceChart, (prev, next) => {
  return (
    prev.data === next.data &&
    prev.chartType === next.chartType &&
    prev.colors?.backgroundColor === next.colors?.backgroundColor &&
    prev.colors?.lineColor === next.colors?.lineColor &&
    prev.colors?.textColor === next.colors?.textColor
  );
});

// Default export for dynamic import compatibility
export default PriceChartMemo;
