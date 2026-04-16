"use client";

import { cn } from "@/lib/utils";
import {
  TrendingUp,
  DollarSign,
  Globe,
  Zap,
  BarChart3,
  Coins,
} from "lucide-react";
import useSWR from "swr";

interface TrendingQuestion {
  id: string;
  question: string;
  category: string;
  displayOrder: number;
}

interface TrendingQuestionsProps {
  onQuestionClick: (question: string, questionId: string) => void;
}

const categoryIcons: Record<string, typeof TrendingUp> = {
  markets: TrendingUp,
  economy: Globe,
  policy: BarChart3,
  crypto: Coins,
  commodities: DollarSign,
  corporate: Zap,
};


const FALLBACK_QUESTIONS: TrendingQuestion[] = [
  {
    id: "fallback-1",
    question: "What are the key technical drivers for BTC-USD and the crypto market this week?",
    category: "markets",
    displayOrder: 1,
  },
  {
    id: "fallback-2",
    question: "Analyze the current market regime. Are we in an inflationary or deflationary environment?",
    category: "economy",
    displayOrder: 2,
  },
  {
    id: "fallback-3",
    question: "Which sectors are gaining institutional momentum right now?",
    category: "policy",
    displayOrder: 3,
  },
  {
    id: "fallback-4",
    question: "Is Bitcoin outperforming high-beta tech in this regime?",
    category: "crypto",
    displayOrder: 4,
  },
  {
    id: "fallback-5",
    question: "How are gold and crude reacting to macro risk shifts?",
    category: "commodities",
    displayOrder: 5,
  },
  {
    id: "fallback-6",
    question: "What could break the current market rally this month?",
    category: "corporate",
    displayOrder: 6,
  },
];

const trendingFetcher = async (url: string): Promise<TrendingQuestion[]> => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Trending fetch failed: ${response.status}`);
  const data = await response.json();
  if (data.success && data.questions && data.questions.length > 0) {
    return data.questions;
  }
  return FALLBACK_QUESTIONS;
};

function ScrollRow({ questions, onQuestionClick, index, desktopSpeed = false }: {
  questions: TrendingQuestion[];
  onQuestionClick: (q: TrendingQuestion) => void;
  index: number;
  desktopSpeed?: boolean;
}) {
  return (
    <div className="relative overflow-hidden w-full select-none py-1">
      {/* Edge Gradients */}
      <div className="absolute inset-y-0 left-0 w-8 bg-linear-to-r from-card/80 to-transparent z-10 pointer-events-none" />
      <div className="absolute inset-y-0 right-0 w-8 bg-linear-to-l from-card/80 to-transparent z-10 pointer-events-none" />

      {/* Marquee Track */}
      <div className={cn(
        "flex w-max hover:[animation-play-state:paused] items-center",
        index % 2 === 0 ? "" : "animation-delay-1000",
        desktopSpeed ? "animate-marquee-desktop" : "animate-marquee"
      )}>
        {/* Track 1 */}
        <div className="flex items-center gap-2 shrink-0 pr-4">
        {questions.map((question) => {
          const Icon = categoryIcons[question.category] || TrendingUp;
          return (
            <button
              key={`${question.id}-1`}
              onClick={() => onQuestionClick(question)}
              className={cn(
                "group flex items-center gap-2 px-3.5 py-2 rounded-full border shrink-0",
                "bg-card/60 border-white/5 hover:border-primary/40 hover:bg-primary/5",
                "transition-all duration-200 text-left outline-none",
                "active:scale-[0.97]"
              )}
            >
              <Icon className="h-3 w-3 text-muted-foreground/60 group-hover:text-primary transition-colors shrink-0" />
              <span className="text-[11px] font-medium text-muted-foreground group-hover:text-foreground transition-colors whitespace-nowrap">
                {question.question.length > 55
                  ? question.question.slice(0, 55) + "…"
                  : question.question}
              </span>
            </button>
          );
        })}
        </div>
        
        {/* Track 2 (Duplicate for infinite loop) */}
        <div className="flex items-center gap-2 shrink-0 pr-4">
        {questions.map((question) => {
          const Icon = categoryIcons[question.category] || TrendingUp;
          return (
            <button
              key={`${question.id}-2`}
              onClick={() => onQuestionClick(question)}
              className={cn(
                "group flex items-center gap-2 px-3.5 py-2 rounded-full border shrink-0",
                "bg-card/60 border-white/5 hover:border-primary/40 hover:bg-primary/5",
                "transition-all duration-200 text-left outline-none",
                "active:scale-[0.97]"
              )}
            >
              <Icon className="h-3 w-3 text-muted-foreground/60 group-hover:text-primary transition-colors shrink-0" />
              <span className="text-[11px] font-medium text-muted-foreground group-hover:text-foreground transition-colors whitespace-nowrap">
                {question.question.length > 55
                  ? question.question.slice(0, 55) + "…"
                  : question.question}
              </span>
            </button>
          );
        })}
        </div>
      </div>
    </div>
  );
}

export function TrendingQuestions({ onQuestionClick }: TrendingQuestionsProps) {
  const { data: questions, isLoading: loading } = useSWR<TrendingQuestion[]>(
    "/api/lyra/trending",
    trendingFetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 120000,
      fallbackData: FALLBACK_QUESTIONS,
    },
  );

  const handleQuestionClick = (question: TrendingQuestion) => {
    fetch("/api/lyra/trending/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId: question.id }),
    }).catch(() => {
      // Fire-and-forget analytics tracking — intentional silent failure.
      // User's click is always honored (onQuestionClick fires below); we just
      // drop the tracking event if the endpoint is unreachable.
    });
    onQuestionClick(question.question, question.id);
  };

  if (loading && (!questions || questions.length === 0)) {
    return (
      <div className="space-y-2">
        <div className="flex gap-2 overflow-hidden">
          {[...Array(3)].map((_, idx) => (
            <div key={idx} className="h-9 w-48 rounded-full bg-muted/20 animate-pulse shrink-0" />
          ))}
        </div>
        <div className="flex gap-2 overflow-hidden">
          {[...Array(3)].map((_, idx) => (
            <div key={idx} className="h-9 w-56 rounded-full bg-muted/20 animate-pulse shrink-0" />
          ))}
        </div>
      </div>
    );
  }

  const displayQuestions = questions ?? FALLBACK_QUESTIONS;

  return (
    <div className="space-y-2 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center gap-2 mb-3">
        <div className="h-1 w-1 rounded-full bg-primary/60 animate-pulse" />
        <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground/50">
          Ask Lyra
        </span>
      </div>

      {/* Mobile & Desktop: 1 Row */}
      <ScrollRow 
        questions={displayQuestions} 
        onQuestionClick={handleQuestionClick} 
        index={0} 
        desktopSpeed={true}
      />
    </div>
  );
}
