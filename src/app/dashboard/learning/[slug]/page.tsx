"use client";

import { useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
  BookOpen,
  Trophy,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { SectionErrorBoundary } from "@/components/error-boundary";

const fetcher = (url: string) => fetch(url).then(r => r.json());

// ─── Types ───

interface QuickCheckItem {
  statement: string;
  isTrue: boolean;
  explanation?: string;
}

interface ModuleSection {
  heading: string;
  content: string;
}

interface ModuleResponse {
  success: boolean;
  metadata: {
    slug: string;
    title: string;
    category: string;
    xpReward: number;
    estimatedTime: string;
    description: string;
    isEliteOnly: boolean;
    badgeContribution: string | null;
  };
  content: {
    sections: ModuleSection[];
    quickCheck: QuickCheckItem[];
  };
  completed: boolean;
  score: number | null;
}

// ─── Skeleton ───

function ModuleReaderSkeleton() {
  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-6 animate-pulse p-3 sm:p-4 md:p-6 pt-6">
      <div className="h-8 w-32 bg-muted/20 rounded-2xl" />
      <div className="space-y-4">
        <div className="h-10 w-3/4 bg-muted/30 rounded-2xl" />
        <div className="h-5 w-1/2 bg-muted/20 rounded-2xl" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-4 bg-muted/15 rounded-2xl" style={{ width: `${85 - i * 8}%` }} />
        ))}
      </div>
      <div className="h-48 bg-muted/10 rounded-2xl border border-border/10" />
    </div>
  );
}

// ─── Main Page ───

export default function ModuleReaderPage() {
  return (
    <SectionErrorBoundary>
      <ModuleReaderContent />
    </SectionErrorBoundary>
  );
}

function ModuleReaderContent() {
  const params = useParams();
  const slug = params.slug as string;

  const { data, isLoading, error, mutate } = useSWR<ModuleResponse>(
    slug ? `/api/learning/modules/${slug}` : null,
    fetcher,
    { dedupingInterval: 60000, revalidateOnFocus: false },
  );

  if (isLoading) return <ModuleReaderSkeleton />;

  if (error || !data?.success) {
    return (
      <div className="max-w-4xl mx-auto pb-6 pt-20 text-center p-3 sm:p-4 md:p-6">
        <BookOpen className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-foreground mb-2">Module Not Found</h2>
        <p className="text-sm text-muted-foreground mb-6">
          {(data as unknown as { error?: string })?.error || "This module doesn't exist or its content isn't available yet."}
        </p>
        <Link
          href="/dashboard/learning"
          className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Learning Hub
        </Link>
      </div>
    );
  }

  const { metadata, content, completed, score } = data;

  return (
    <div className="max-w-4xl mx-auto pb-6 p-3 sm:p-4 md:p-6 pt-6">
      {/* Back Link */}
      <Link
        href="/dashboard/learning"
        className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-primary transition-colors mb-6"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Learning Hub
      </Link>

      {/* Module Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] font-bold text-primary uppercase tracking-wider bg-primary/10 px-2 py-0.5 rounded-full">
            {metadata.category}
          </span>
          <span className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground">
            <Clock className="h-3 w-3" />
            {metadata.estimatedTime}
          </span>
          <span className="flex items-center gap-1 text-[10px] font-bold text-primary/85 dark:text-primary/70">
            <Zap className="h-3 w-3" />
            +{metadata.xpReward} XP
          </span>
          {completed && (
            <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-500">
              <CheckCircle2 className="h-3 w-3" />
              Completed
            </span>
          )}
        </div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
          {metadata.title}
        </h1>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
          {metadata.description}
        </p>
      </div>

      {/* Content Sections */}
      <div className="space-y-8 mb-10">
        {content.sections.map((section, i) => (
          <div key={i}>
            <h2 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
              {section.heading === "What It Does NOT Mean" && (
                <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
              )}
              {section.heading === "Key Concept" && (
                <BookOpen className="h-4 w-4 text-primary" />
              )}
              {section.heading === "What It Means" && (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-500" />
              )}
              {section.heading}
            </h2>
            <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground leading-relaxed">
              {section.content.split("\n\n").map((para, j) => {
                if (para.startsWith("- ")) {
                  return (
                    <ul key={j} className="space-y-1.5 my-3">
                      {para.split("\n").filter(l => l.startsWith("- ")).map((item, k) => (
                        <li key={k} className="text-sm leading-relaxed">
                          {renderInlineMarkdown(item.replace(/^- /, ""))}
                        </li>
                      ))}
                    </ul>
                  );
                }
                return (
                  <p key={j} className="text-sm leading-relaxed mb-3">
                    {renderInlineMarkdown(para)}
                  </p>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Quick Check */}
      {content.quickCheck.length > 0 && (
        <QuickCheck
          items={content.quickCheck}
          slug={slug}
          metadata={metadata}
          xpReward={metadata.xpReward}
          alreadyCompleted={completed}
          previousScore={score}
          onComplete={() => mutate()}
        />
      )}

      {/* Navigation */}
      <div className="mt-10 pt-6 border-t border-border/20 flex items-center justify-between">
        <Link
          href="/dashboard/learning"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-primary transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All Modules
        </Link>
        {metadata.badgeContribution && (
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-700 dark:text-amber-500/70">
            <Trophy className="h-3 w-3" />
            Contributes to: {metadata.badgeContribution}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Quick Check Component ───

function QuickCheck({
  items,
  slug,
  metadata,
  xpReward,
  alreadyCompleted,
  previousScore,
  onComplete,
}: {
  items: QuickCheckItem[];
  slug: string;
  metadata: { slug: string; title: string; category: string; xpReward: number; estimatedTime: string; description: string; isEliteOnly: boolean; badgeContribution: string | null; nextModule?: string; };
  xpReward: number;
  alreadyCompleted: boolean;
  previousScore: number | null;
  onComplete: () => void;
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<number, boolean | null>>({});
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(alreadyCompleted);

  const allRevealed = items.every((_, i) => revealed[i]);

  const score = allRevealed
    ? Math.round(
        (items.filter((item, i) => answers[i] === item.isTrue).length / items.length) * 100,
      )
    : null;

  const handleAnswer = useCallback((index: number, answer: boolean) => {
    if (revealed[index]) return; // already revealed
    setAnswers(prev => ({ ...prev, [index]: answer }));
    // Auto-reveal after answering
    setTimeout(() => {
      setRevealed(prev => ({ ...prev, [index]: true }));
    }, 150);
  }, [revealed]);

  const handleComplete = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);

    try {
      const res = await fetch(`/api/learning/modules/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score }),
      });
      const data = await res.json();

      if (data.success) {
        setSubmitted(true);
        onComplete();

        if (!data.alreadyCompleted) {
          toast.success(`Module complete! +${data.xp?.amount ?? 15} XP`, {
            description: score !== null ? `You scored ${score}%` : undefined,
          });

          if (data.xp?.leveledUp) {
            setTimeout(() => {
              toast.success(`Level ${data.xp.newLevel}! You're now ${data.xp.tierName === "a" ? "an" : "a"} ${data.xp.tierName}`, {
                icon: "🎉",
                className: "animate-level-up border-primary/50 bg-primary/10",
              });
            }, 1500);
          }

          if (data.badges?.newlyAwarded?.length > 0) {
            for (const badge of data.badges.newlyAwarded) {
              setTimeout(() => {
                toast.success(`Badge Earned: ${badge}`, { icon: "🏅" });
              }, 2500);
            }
          }
        }
      }
    } catch {
      toast.error("Failed to save progress");
    } finally {
      setSubmitting(false);
    }
  }, [slug, score, submitting, onComplete]);

  return (
    <div className="rounded-4xl border border-white/10 bg-card/70 p-6 shadow-[0_24px_80px_-36px_rgba(2,6,23,0.72)] backdrop-blur-xl">
      <div className="flex items-center gap-2 mb-4">
        <CheckCircle2 className="h-4 w-4 text-primary" />
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
          Quick Check
        </span>
        {score !== null && (
          <span className={cn(
            "text-xs font-bold px-2 py-0.5 rounded-full",
            score >= 75 ? "text-emerald-500 bg-emerald-500/10" : "text-amber-500 bg-amber-500/10",
          )}>
            {score}%
          </span>
        )}
      </div>

      <div className="space-y-4">
        {items.map((item, i) => {
          const isRevealed = revealed[i];
          const userAnswer = answers[i];
          const isCorrect = userAnswer === item.isTrue;

          return (
            <div
              key={i}
              className={cn(
                "rounded-2xl p-4 border transition-all duration-300",
                isRevealed
                  ? isCorrect
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : "border-red-500/30 bg-red-500/5"
                  : "border-white/10 bg-card/70 shadow-[0_24px_80px_-36px_rgba(2,6,23,0.72)] backdrop-blur-xl",
              )}
            >
              <p className="text-sm font-medium text-foreground mb-3">{item.statement}</p>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleAnswer(i, true)}
                  disabled={isRevealed}
                  className={cn(
                    "px-4 py-1.5 rounded-2xl text-xs font-bold transition-all",
                    isRevealed && userAnswer === true
                      ? isCorrect
                        ? "bg-emerald-500 text-white"
                        : "bg-red-500 text-white"
                      : isRevealed
                        ? item.isTrue
                          ? "bg-emerald-500/20 text-emerald-500 border border-emerald-500/30"
                          : "bg-muted/20 text-muted-foreground"
                        : userAnswer === true
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted/30 text-muted-foreground hover:bg-muted/50",
                  )}
                >
                  True
                </button>
                <button
                  onClick={() => handleAnswer(i, false)}
                  disabled={isRevealed}
                  className={cn(
                    "px-4 py-1.5 rounded-2xl text-xs font-bold transition-all",
                    isRevealed && userAnswer === false
                      ? isCorrect
                        ? "bg-emerald-500 text-white"
                        : "bg-red-500 text-white"
                      : isRevealed
                        ? !item.isTrue
                          ? "bg-emerald-500/20 text-emerald-500 border border-emerald-500/30"
                          : "bg-muted/20 text-muted-foreground"
                        : userAnswer === false
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted/30 text-muted-foreground hover:bg-muted/50",
                  )}
                >
                  False
                </button>

                {isRevealed && (
                  <span className="ml-auto">
                    {isCorrect
                      ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      : <XCircle className="h-4 w-4 text-red-500" />
                    }
                  </span>
                )}
              </div>

              {isRevealed && item.explanation && (
                <p className={cn(
                  "text-xs mt-3 leading-relaxed",
                  isCorrect ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400",
                )}>
                  {item.explanation}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Complete Button */}
      {allRevealed && !submitted && (
        <button
          onClick={handleComplete}
          disabled={submitting}
          className="mt-6 w-full py-3 rounded-2xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-colors disabled:opacity-70"
        >
          {submitting ? "Saving..." : `Complete Module (+${xpReward} XP)`}
        </button>
      )}

      {submitted && (
        <div className="mt-6 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-emerald-500">
            <CheckCircle2 className="h-4 w-4" />
            Module Completed
            {(score !== null || previousScore !== null) && (
              <span className="text-muted-foreground font-normal">
                — Score: {score ?? previousScore}%
              </span>
            )}
          </div>
          <button
            onClick={() => {
              if (metadata.nextModule) {
                router.push(`/dashboard/learning/${metadata.nextModule}`);
              } else {
                router.push("/dashboard/learning");
              }
            }}
            className="flex items-center gap-1 text-xs font-bold text-primary hover:underline"
          >
            {metadata.nextModule ? "Next Module" : "Back to Hub"} <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Markdown Helpers ───

function renderInlineMarkdown(text: string): React.ReactNode {
  // Handle **bold** and *italic*
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="text-foreground font-semibold">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}
