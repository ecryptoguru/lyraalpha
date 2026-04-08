"use client";

import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

interface ExplanationData {
  title: string;
  score: number;
  definition: string;
  drivers: string[];
  context: string;
  limitations: string;
}

interface AiExplanationData {
  summary: string;
  whatItMeans: string;
  whatToWatch: string;
  nextAction: string;
}

interface ExplainSheetProps {
  isOpen: boolean;
  onClose: () => void;
  data: ExplanationData | null;
}

export function ExplainSheet({ isOpen, onClose, data }: ExplainSheetProps) {
  const [isDesktop, setIsDesktop] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(min-width: 640px)").matches;
  });
  const [aiExplanation, setAiExplanation] = useState<AiExplanationData | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)");
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    if (!isOpen || !data) {
      setAiExplanation(null);
      setAiLoading(false);
      return;
    }

    const controller = new AbortController();
    let active = true;

    const load = async () => {
      setAiLoading(true);
      try {
        const response = await fetch("/api/lyra/explain-signal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify(data),
        });

        if (!response.ok) return;
        const payload = await response.json() as { success?: boolean; explanation?: AiExplanationData | null };
        if (active && payload.success && payload.explanation) {
          setAiExplanation(payload.explanation);
        }
      } catch {
        if (active) setAiExplanation(null);
      } finally {
        if (active) setAiLoading(false);
      }
    };

    void load();

    return () => {
      active = false;
      controller.abort();
    };
  }, [data, isOpen]);

  if (!data) return null;

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent
        side={isDesktop ? "right" : "bottom"}
        className="h-[85dvh] sm:h-full sm:max-w-xl overflow-y-auto sm:p-8 sm:px-10"
      >
        <SheetHeader className="text-left">
          <div className="flex items-center gap-3 mb-2">
            <Badge variant="secondary" className="text-lg px-3 py-1">
              {data.score}/100
            </Badge>
            <SheetTitle className="text-2xl">{data.title}</SheetTitle>
          </div>
          <SheetDescription className="text-base text-foreground font-medium">
            {data.definition}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-8 space-y-6">
          <section className="rounded-2xl border border-primary/15 bg-primary/5 p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h4 className="text-sm font-semibold uppercase tracking-wider text-primary">Lyra read</h4>
              {aiLoading && <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Thinking…</span>}
            </div>
            {aiExplanation ? (
              <div className="space-y-3 text-sm leading-relaxed">
                <p className="text-foreground font-medium">{aiExplanation.summary}</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/8 bg-card/50 p-3">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1">What it means</p>
                    <p>{aiExplanation.whatItMeans}</p>
                  </div>
                  <div className="rounded-2xl border border-white/8 bg-card/50 p-3">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1">What to watch</p>
                    <p>{aiExplanation.whatToWatch}</p>
                  </div>
                </div>
                <div className="rounded-2xl border border-primary/10 bg-background/60 p-3">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-primary mb-1">Next action</p>
                  <p>{aiExplanation.nextAction}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm leading-relaxed text-muted-foreground">
                Open a score or signal and Lyra will add a plain-English interpretation here.
              </p>
            )}
          </section>

          {/* Drivers Section */}
          <section>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Key Drivers
            </h4>
            <ul className="space-y-2">
              {data.drivers.map((driver, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="text-primary mt-1">•</span>
                  <span>{driver}</span>
                </li>
              ))}
            </ul>
          </section>

          <Separator />

          {/* Context Section */}
          <section>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Current Context
            </h4>
            <div className="bg-muted/50 p-4 rounded-2xl text-sm leading-relaxed border">
              {data.context}
            </div>
          </section>

          {/* Limitations Section - Regulatory Safe */}
          <section>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              What this does NOT mean
            </h4>
            <p className="text-sm text-muted-foreground">{data.limitations}</p>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
