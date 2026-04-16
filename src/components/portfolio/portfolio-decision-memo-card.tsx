"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { Loader2, Sparkles, ClipboardCopy, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ShareInsightButton } from "@/components/dashboard/share-insight-button";
import { buildPortfolioShareObject } from "@/lib/intelligence-share";
import { fetcher as sharedFetcher } from "@/lib/swr-fetcher";

interface DecisionMemoResponse {
  headline: string;
  summary: string;
  focus: string;
  nextAction: string;
  bullets: string[];
}

type MemoEnvelope = { success: boolean; memo: DecisionMemoResponse | null };

const fetcher = (url: string): Promise<MemoEnvelope> => sharedFetcher<MemoEnvelope>(url);

export function PortfolioDecisionMemoCard({
  portfolioId,
  portfolioName,
  portfolioScoreValue,
}: {
  portfolioId: string | null;
  portfolioName: string;
  portfolioScoreValue?: string;
}) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const { data, isLoading, mutate } = useSWR(
    portfolioId ? `/api/portfolio/${portfolioId}/decision-memo` : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 300_000 },
  );

  const memo = data?.memo ?? null;
  const share = useMemo(() => {
    if (!memo) return null;
    return buildPortfolioShareObject({
      title: memo.headline,
      takeaway: memo.summary,
      context: `${memo.focus} ${memo.nextAction}`,
      href: "/dashboard/portfolio",
      scoreValue: portfolioScoreValue,
    });
  }, [memo, portfolioScoreValue]);

  return (
    <div className="rounded-3xl border border-white/10 bg-card/60 backdrop-blur-xl shadow-xl p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Decision memo</p>
          <h3 className="mt-1 text-lg font-bold tracking-tight text-foreground">Generate a shareable portfolio summary</h3>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed max-w-2xl">
            Lyra will turn your current portfolio, regime and holdings into a short memo you can act on or share.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void mutate()}
            disabled={!portfolioId || isLoading}
            className="text-xs h-8 gap-1.5"
          >
            {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            {memo ? "Refresh memo" : "Generate memo"}
          </Button>
          <Link
            href={`/dashboard/lyra?q=${encodeURIComponent(`Write a decision memo for my ${portfolioName} portfolio`)}`}
            className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-background/60 px-3 h-8 text-xs font-bold text-foreground hover:border-primary/25 hover:bg-primary/5 transition-colors"
          >
            Ask Lyra
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>

      {memo ? (
        <div className="space-y-3 rounded-2xl border border-primary/15 bg-primary/8 p-4">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-primary">{memo.headline}</p>
            <p className="mt-2 text-sm leading-relaxed text-foreground">{memo.summary}</p>
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <div className="rounded-2xl border border-white/8 bg-card/40 p-3">
              <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Focus</p>
              <p className="mt-1 text-xs leading-relaxed text-foreground">{memo.focus}</p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-card/40 p-3">
              <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Next step</p>
              <p className="mt-1 text-xs leading-relaxed text-foreground">{memo.nextAction}</p>
            </div>
          </div>
          {memo.bullets.length > 0 && (
            <div className="space-y-1.5">
              {memo.bullets.map((bullet) => (
                <div key={bullet} className="flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                  <span>{bullet}</span>
                </div>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {share && <ShareInsightButton share={share} label="Share memo" />}
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-8 gap-1.5"
              onClick={async () => {
                if (!memo || !navigator.clipboard?.writeText) {
                  setCopyState("error");
                  return;
                }

                try {
                  await navigator.clipboard.writeText([memo.headline, memo.summary, memo.focus, memo.nextAction, ...memo.bullets].join("\n\n"));
                  setCopyState("copied");
                } catch {
                  setCopyState("error");
                }
              }}
            >
              <ClipboardCopy className="h-3 w-3" />
              {copyState === "copied" ? "Copied" : copyState === "error" ? "Copy failed" : "Copy memo"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-white/10 bg-background/40 p-4 text-sm text-muted-foreground leading-relaxed">
          Use this when you want a compact portfolio memo instead of scanning every chart and table manually.
        </div>
      )}
    </div>
  );
}
