"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { ChevronRight, PlayCircle, Clock, Award, Star } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import confetti from "canvas-confetti";
import { LEARNING_PATHS, type LearningPathDefinition, type LearningPathIconKey } from "@/lib/learning/path-definitions";

function getPathIcon(iconKey: LearningPathIconKey) {
  switch (iconKey) {
    case "award":
      return <Award className="h-4 w-4 text-success" />;
    case "play":
      return <PlayCircle className="h-4 w-4 text-cyan-400" />;
    case "clock":
      return <Clock className="h-4 w-4 text-[#FFD700]" />;
    case "star":
    default:
      return <Star className="h-4 w-4 text-[#FFD700]" />;
  }
}

export function LearningPathsCarousel({
  completedSlugs,
  isElite,
}: {
  completedSlugs: Set<string>;
  isElite: boolean;
}) {
  const [claiming, setClaiming] = useState<string | null>(null);
  const scrollingPaths = [...LEARNING_PATHS, ...LEARNING_PATHS];
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const pausedRef = useRef(false);
  const frameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const loopWidthRef = useRef(0);

  useEffect(() => {
    const measure = () => {
      if (!trackRef.current) return;
      loopWidthRef.current = trackRef.current.scrollWidth / 2;
    };

    const step = (time: number) => {
      if (lastTimeRef.current == null) {
        lastTimeRef.current = time;
      }

      const delta = time - lastTimeRef.current;
      lastTimeRef.current = time;

      if (!pausedRef.current && viewportRef.current && loopWidthRef.current > 0) {
        viewportRef.current.scrollLeft += (delta * 91) / 1000;

        if (viewportRef.current.scrollLeft >= loopWidthRef.current) {
          viewportRef.current.scrollLeft -= loopWidthRef.current;
        }
      }

      frameRef.current = window.requestAnimationFrame(step);
    };

    measure();
    if (viewportRef.current) {
      viewportRef.current.scrollLeft = 0;
    }
    window.addEventListener("resize", measure);
    frameRef.current = window.requestAnimationFrame(step);

    return () => {
      window.removeEventListener("resize", measure);
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
      lastTimeRef.current = null;
    };
  }, []);

  const handleClaimReward = async (pathId: string) => {
    if (claiming) return;
    setClaiming(pathId);

    try {
      const res = await fetch("/api/learning/path-reward", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pathId }),
      });
      const data = await res.json();

      if (data.success && data.awarded) {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ["#FFD700", "#10b981", "#3b82f6", "#00D4FF"],
        });
        toast.success(`Path Completed! +${data.amount} XP`, {
          icon: "🌟",
        });
      } else if (data.alreadyAwarded) {
        toast.success("Path already claimed!");
      }
    } catch {
      toast.error("Failed to claim reward");
    } finally {
      setClaiming(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wider">Curated Paths</h2>
      </div>
      
      <div
        ref={viewportRef}
        className="overflow-hidden pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        onMouseEnter={() => {
          pausedRef.current = true;
          lastTimeRef.current = null;
        }}
        onMouseLeave={() => {
          pausedRef.current = false;
          lastTimeRef.current = null;
        }}
      >
        <div
          ref={trackRef}
          className="flex w-max gap-4"
        >
        {scrollingPaths.map((path: LearningPathDefinition, index) => {
          const locked = path.isEliteOnly && !isElite;
          const completedCount = path.modules.filter((m) => completedSlugs.has(m)).length;
          const totalCount = path.modules.length;
          const percent = Math.round((completedCount / totalCount) * 100);
          const isComplete = percent === 100;
          const nextModule = path.modules.find((m) => !completedSlugs.has(m)) || path.modules[0];
          const ctaHref = locked ? "/dashboard/upgrade" : `/dashboard/learning/${nextModule}`;
          const cardClassName = cn(
            "min-w-[280px] sm:min-w-[320px] shrink-0 snap-start rounded-2xl border bg-linear-to-br p-5 flex flex-col relative overflow-hidden transition-all",
            path.color,
            locked ? "opacity-80 grayscale-[0.15] hover:border-warning/40" : "hover:border-primary/50"
          );

          const cardContent = (
            <>
              <div className="flex items-start justify-between mb-3 relative z-10">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-2xl bg-background/50 backdrop-blur-xl">
                    {getPathIcon(path.iconKey)}
                  </div>
                  <h3 className="font-bold text-foreground tracking-tight">{path.title}</h3>
                </div>
                {locked && (
                  <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground bg-background/50 px-2 py-0.5 rounded-full">
                    Elite
                  </span>
                )}
              </div>

              <p className="text-xs text-muted-foreground/90 font-medium mb-5 line-clamp-2 relative z-10">
                {path.description}
              </p>

              <div className="mt-auto space-y-3 relative z-10">
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider">
                  <span className="text-muted-foreground">{completedCount} / {totalCount} Modules</span>
                  <span className={isComplete ? "text-success" : "text-foreground"}>{percent}%</span>
                </div>
                <div className="h-1.5 w-full bg-background/50 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-1000",
                      isComplete ? "bg-success" : "bg-primary"
                    )}
                    style={{ width: `${percent}%` }}
                  />
                </div>

                <div className="pt-2">
                  {isComplete && !locked ? (
                    <button
                      type="button"
                      onClick={() => handleClaimReward(path.id)}
                      disabled={claiming === path.id}
                      className="w-full py-2 rounded-2xl bg-success/10 text-success text-xs font-bold border border-success/20 hover:bg-success/20 transition-colors"
                    >
                      {claiming === path.id ? "Claiming..." : "Claim Bonus XP"}
                    </button>
                  ) : (
                    <div className="w-full flex items-center justify-between py-2 px-3 rounded-2xl bg-background/50 text-xs font-bold border border-border/10 hover:bg-background/80 transition-colors">
                      {locked ? "See Elite Features" : completedCount === 0 ? "Start Path" : "Continue"}
                      <ChevronRight className="h-3.5 w-3.5" />
                    </div>
                  )}
                </div>
              </div>

              <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-current opacity-5 blur-3xl rounded-full pointer-events-none" />
            </>
          );

          return (
            locked || !isComplete ? (
              <Link key={`${path.id}-${index}`} href={ctaHref} className={cardClassName}>
                {cardContent}
              </Link>
            ) : (
              <div key={`${path.id}-${index}`} className={cardClassName}>
                {cardContent}
              </div>
            )
          );
        })}
        </div>
      </div>
    </div>
  );
}
