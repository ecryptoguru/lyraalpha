"use client";

import {
  TrendingUp,
  TrendingDown,
  Sparkles,
  LucideIcon,
  HelpCircle,
  Loader2,
  Info,
  SquareArrowOutUpRight,
} from "lucide-react";
import { createClientLogger } from "@/lib/logger/client";

const logger = createClientLogger("crypto-card");

/** Map rating labels to human-readable display */
function formatRatingLabel(rating: string): string {
  const map: Record<string, string> = {
    STRONG_BUY: "Strong Buy",
    BUY: "Buy",
    NEUTRAL: "Neutral",
    SELL: "Sell",
    STRONG_SELL: "Strong Sell",
    Bullish: "Bullish",
    Bearish: "Bearish",
  };
  return map[rating] || rating || "—";
}

/** Map rating labels to Tailwind color classes */
function getRatingColor(rating: string): string {
  const bullish = ["STRONG_BUY", "BUY", "Bullish"];
  const bearish = ["STRONG_SELL", "SELL", "Bearish"];
  if (bullish.includes(rating)) return "text-success";
  if (bearish.includes(rating)) return "text-danger";
  return "text-cyan-400";
}
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CryptoCardData } from "./types";
import { useState } from "react";
import { getFriendlySymbol } from "@/lib/format-utils";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LyraInsightSheet } from "@/components/lyra/lyra-insight-sheet";

interface CryptoCardProps {
  data: CryptoCardData;
  inclusionReason?: string;
}

export function CryptoCard({ data, inclusionReason }: CryptoCardProps) {
  const [explanation, setExplanation] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lyraOpen, setLyraOpen] = useState(false);

  const fetchExplanation = async () => {
    if (explanation) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/discovery/explain?assetId=${data.assetId}&sectorId=${data.sectorId}`,
      );
      const json = await res.json();
      if (!res.ok) {
        if (res.status === 403) {
          setExplanation(json.error || "Insufficient credits.");
        } else {
          setExplanation("Unable to retrieve at this time.");
        }
      } else {
        setExplanation(json.data.explanation);
        // Update credit balance from server response
        const creditsRemaining = res.headers.get("X-Credits-Remaining");
        if (creditsRemaining) {
          const nextCredits = Number(creditsRemaining);
          if (Number.isFinite(nextCredits)) {
            const { setAuthoritativeCreditBalance, revalidateCreditViews } = await import("@/lib/credits/client");
            void setAuthoritativeCreditBalance(nextCredits);
            void revalidateCreditViews();
          }
        }
      }
    } catch (error) {
      logger.error("Failed to fetch explanation", { error });
      // Silently fail in UI - user will see fallback message
      setExplanation("Unable to retrieve institutional research at this time.");
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return "text-success";
    if (score >= 40) return "text-cyan-400";
    return "text-danger";
  };

  return (
    <div className="group relative block h-full">
      <div className="absolute -inset-0.5 bg-primary/10 rounded-3xl opacity-0 group-hover:opacity-100 transition duration-500" />
      
      <div className="relative bg-card/60 backdrop-blur-2xl border border-white/5 rounded-3xl p-5 transition-all duration-300 group-hover:bg-muted/30 flex flex-col h-full shadow-md hover:shadow-xl">
        {/* Header: Name, Symbol - Linked to analysis */}
        <div className="flex justify-between items-start mb-5 font-data">
          <Link
            href={`/dashboard/assets/${data.symbol}`}
            className="flex gap-3 items-center group/header min-w-0 flex-1"
          >
            <div className="h-10 w-10 rounded-2xl bg-muted/30 border border-border flex items-center justify-center text-lg font-bold font-data text-primary shadow-lg shadow-primary/5 group-hover/header:bg-primary/10 transition-colors shrink-0">
              {data.symbol[0]}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                 <h3 className="font-bold text-base leading-tight group-hover/header:text-primary transition-colors truncate font-sans uppercase">
                  {getFriendlySymbol(data.symbol, data.type, data.name)}
                </h3>
              </div>
            
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[9px] font-bold text-muted-foreground whitespace-nowrap uppercase tracking-widest opacity-80">
                  {data.symbol}
                </span>
                 <span
                  className={cn(
                    "text-[9px] font-bold flex items-center gap-0.5",
                    data.oneYearChange.isPositive
                      ? "text-success"
                      : "text-danger"
                  )}
                >
                  {data.oneYearChange.isPositive ? (
                    <TrendingUp className="h-2.5 w-2.5" />
                  ) : (
                    <TrendingDown className="h-2.5 w-2.5" />
                  )}
                  {data.oneYearChange.value}
                </span>
              </div>
            </div>
          </Link>

          <div className="flex items-center gap-1.5 ml-2 sm:ml-4 shrink-0">
            <Sheet>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 sm:px-3 rounded-2xl bg-accent-cta/10 border border-accent-cta/20 text-accent-cta hover:bg-accent-cta/20 hover:text-accent-cta transition-all flex items-center justify-center gap-1.5 font-bold text-[9px] sm:text-[10px] uppercase tracking-widest shadow-(--shadow-glow-cta) shrink-0"
                  onClick={fetchExplanation}
                >
                  <span>ASK</span>
                  <Sparkles className="h-3 w-3" />
                </Button>
              </SheetTrigger>
              <SheetContent className="w-full sm:max-w-md border-border dark:border-white/5 bg-background/98 dark:bg-foreground/98 backdrop-blur-xl text-foreground p-0! overflow-hidden flex flex-col">
                <Tabs defaultValue="insight" className="flex-1 flex flex-col min-h-0">
                  <div className="p-4 sm:p-8 pb-4 space-y-6 shrink-0">
                    <SheetHeader className="p-0 space-y-4 font-data">
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-2xl bg-linear-to-br from-accent-cta/20 to-warning/10 border border-accent-cta/30 shadow-(--shadow-glow-cta)">
                            <Sparkles className="h-5 w-5 text-accent-cta" />
                          </div>
                          <SheetTitle className="text-2xl font-bold tracking-tight uppercase bg-clip-text text-transparent bg-linear-to-r from-accent-cta/70 to-accent-cta">
                            Lyra Research
                          </SheetTitle>
                        </div>
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent-cta/10 border border-accent-cta/30 shadow-(--shadow-glow-cta)">
                          <span className="text-[9px] font-black text-accent-cta tracking-widest uppercase">1 Credit</span>
                        </div>
                      </div>
                      <SheetDescription className="text-muted-foreground font-medium leading-relaxed font-sans">
                        Lyra Intelligence for{" "}
                        <span className="text-foreground font-bold">
                          {data.name} ({data.symbol})
                        </span>
                      </SheetDescription>
                    </SheetHeader>

                    <TabsList className="w-full grid grid-cols-2 bg-muted/20 p-1 rounded-2xl">
                      <TabsTrigger 
                        value="insight" 
                        className="rounded-2xl text-xs font-bold uppercase tracking-wider data-[state=active]:bg-accent-cta/10 data-[state=active]:text-accent-cta"
                      >
                        Insight
                      </TabsTrigger>
                      <TabsTrigger 
                        value="chat" 
                        className="rounded-2xl text-xs font-bold uppercase tracking-wider data-[state=active]:bg-accent-cta/10 data-[state=active]:text-accent-cta"
                      >
                        Ask Lyra
                      </TabsTrigger>
                    </TabsList>
                  </div>

                  <div className="h-px bg-border shrink-0" />

                  <TabsContent value="insight" className="flex-1 overflow-y-auto scroll-smooth scrollbar-hide p-4 sm:p-8 pt-4 sm:pt-6 space-y-8 mt-0">
                    <div className="space-y-4 font-data">
                      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-primary/60">
                        <HelpCircle className="h-3 w-3" />
                        Why Included?
                      </div>
                      <div className="p-6 rounded-3xl surface-interactive font-medium leading-loose text-sm text-foreground/80 relative font-sans">
                        {loading ? (
                          <div className="flex flex-col items-center justify-center py-16 gap-6">
                            <div className="relative flex items-center justify-center">
                              <div className="absolute inset-0 rounded-full border-t-2 border-r-2 border-accent-cta/30 animate-[spin_3s_linear_infinite]" />
                              <div className="absolute inset-2 rounded-full border-b-2 border-l-2 border-accent-cta/60 animate-[spin_2s_linear_infinite_reverse]" />
                              <Loader2 className="h-8 w-8 animate-spin text-accent-cta drop-shadow-[0_0_10px_color-mix(in_srgb,var(--accent-cta)_50%,transparent)]" />
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] font-data text-accent-cta/80 animate-pulse">
                              Synthesizing Evidence...
                            </span>
                          </div>
                        ) : explanation ? (
                          <div className="prose dark:prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-p:opacity-90 prose-headings:text-accent-cta prose-headings:font-bold prose-headings:tracking-tight prose-li:marker:text-accent-cta prose-strong:text-accent-cta/90">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {explanation}
                            </ReactMarkdown>
                          </div>
                        ) : (
                          inclusionReason ||
                          "Structural business alignment identified by LyraAlpha AI intelligence engine."
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 font-data">
                      <DetailMetric
                        label="Tier"
                        value={
                          data.eligibilityScore >= 75
                            ? "Strong"
                            : data.eligibilityScore >= 55
                              ? "Moderate"
                              : "Emerging"
                        }
                      />
                      <DetailMetric
                        label="Confidence"
                        value={`${data.confidence}%`}
                      />
                      <DetailMetric label="Data Currency" value="High" />
                      <DetailMetric
                        label="Strategic Fit"
                        value={inclusionReason || "N/A"}
                      />
                    </div>

                    <div className="pt-8 mt-auto">
                      <div className="flex items-center gap-3 p-4 rounded-2xl bg-muted/10 border border-border surface-elevated">
                        <Info className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                        <p className="text-[9px] font-medium leading-relaxed text-muted-foreground/40 uppercase tracking-wider font-data">
                          This analysis is provided by Lyra for informational
                          purposes. It does not constitute investment advice.
                        </p>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="chat" className="flex-1 flex flex-col items-center justify-center gap-4 p-8 mt-0">
                    <div className="p-4 rounded-2xl bg-accent-cta/10 border border-accent-cta/20 shadow-(--shadow-glow-cta)">
                      <Sparkles className="h-8 w-8 text-accent-cta opacity-90" />
                    </div>
                    <div className="text-center space-y-1.5">
                      <p className="text-sm font-black tracking-tight text-accent-cta-foreground">Ask Lyra about {data.symbol}</p>
                      <p className="text-xs text-muted-foreground/80">Get an institutional-grade analysis in a full panel</p>
                    </div>
                    <button
                      onClick={() => setLyraOpen(true)}
                      className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-accent-cta text-accent-cta-foreground font-black text-xs uppercase tracking-wider shadow-lg shadow-accent-cta/20 hover:bg-accent-cta/90 active:scale-95 transition-all duration-200"
                    >
                      <Sparkles className="h-4 w-4" />
                      Open Lyra
                    </button>
                  </TabsContent>
                </Tabs>
              </SheetContent>
            </Sheet>
            <Link href={`/dashboard/assets/${data.symbol}`}>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-2xl bg-muted/30 border border-border text-muted-foreground hover:bg-primary/10 hover:text-primary hover:border-primary/20 transition-all shadow-sm shrink-0"
              >
                <SquareArrowOutUpRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Intelligence Grid: Signals (Unified Engine) */}
        {data.signals && (
            <div className="grid grid-cols-3 gap-y-3 gap-x-2 pt-2 border-t border-border/30 mb-4 font-data">
            <SignalItem
                label="Trend"
                score={data.signals.trend}
                color={getScoreColor(data.signals.trend)}
            />
            <SignalItem
                label="Momntm"
                score={data.signals.momentum}
                color={getScoreColor(data.signals.momentum)}
            />
            <SignalItem
                label="Voltlty"
                score={data.signals.volatility}
                color={getScoreColor(100 - data.signals.volatility)}
            />
            <SignalItem
                label="Sentmnt"
                score={data.signals.sentiment}
                color={getScoreColor(data.signals.sentiment)}
            />
            <SignalItem
                label="Liq'dty"
                score={data.signals.liquidity}
                color={getScoreColor(data.signals.liquidity)}
            />
            <SignalItem
                label="Gov'nce"
                score={data.signals.trust}
                color={getScoreColor(data.signals.trust)}
            />
            </div>
        )}

        {/* Metrics Grid - Footer Style */}
        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border/10 bg-muted/10 -mx-5 px-5 py-4 rounded-b-3xl mt-auto font-data">
            <MetricItem
              label="Inclusion"
              value={inclusionReason || "N/A"}
            />
             <MetricItem 
                label="Market Cap" 
                value={data.marketCap} 
                border={false}
                 
            />
           
            <MetricItem
                label="Technical"
                value={formatRatingLabel(data.technicalRating)}
                valueClassName={getRatingColor(data.technicalRating)}
                border
            />
             <MetricItem
                label="Analyst"
                value={formatRatingLabel(data.analystRating)}
                valueClassName={getRatingColor(data.analystRating)}
                border
            />
             <MetricItem label="Confidence" value={`${data.confidence}%`} border />
        </div>



          <LyraInsightSheet
            open={lyraOpen}
            onClose={() => setLyraOpen(false)}
            symbol={data.symbol}
            assetName={data.name}
            contextData={{
              metrics: {
                marketCap: data.marketCap,
                performance: data.oneYearChange,
              },
              signals: data.signals,
              sectorId: data.sectorId,
            }}
            sourcesLimit={3}
          />
      </div>
    </div>
  );
}

function MetricItem({
  label,
  value,
  border = false,
  valueClassName = "",
  icon: Icon,
}: {
  label: string;
  value: string;
  border?: boolean;
  valueClassName?: string;
  icon?: LucideIcon;
}) {
  return (
    <div
      className={cn(
        "min-w-0 font-data",
        border && "border-t border-border/10 pt-3", // Subtle border
      )}
    >
      <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest opacity-80 dark:opacity-40 mb-1">
        {label}
      </p>
      <div className="flex items-center gap-1">
        {Icon && <Icon className={cn("h-3 w-3", valueClassName)} />}
        <p
          className={cn(
            "text-[11px] font-bold truncate tracking-tight uppercase",
            valueClassName,
          )}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

function SignalItem({
  label,
  score,
  color,
}: {
  label: string;
  score: number;
  color: string;
}) {
  const getProgressBarColor = (colorClass: string) => {
    if (colorClass.includes("success")) return "bg-success";
    if (colorClass.includes("warning") || colorClass.includes("accent-cta")) return "bg-warning";
    if (colorClass.includes("danger")) return "bg-danger";
    return "bg-muted-foreground";
  };

  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-wider">
        {label}
      </span>
      <div className="flex items-center gap-1.5">
        <div className="h-1 flex-1 bg-muted/40 rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full transition-all duration-1000",
              getProgressBarColor(color)
            )}
            style={{ width: `${score}%` }}
          />
        </div>
        <span
          className={cn(
            "text-[10px] font-mono font-bold w-5 text-right",
            color,
          )}
        >
          {Math.round(score)}
        </span>
      </div>
    </div>
  );
}

function DetailMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-4 rounded-2xl surface-elevated space-y-1 font-data">
      <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest opacity-40">
        {label}
      </p>
      <p className="text-sm font-bold text-foreground uppercase tracking-tight">
        {value}
      </p>
    </div>
  );
}
