"use client";

import { PlayCircle, Clock, Star } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

interface ModuleData {
  slug: string;
  title: string;
  category: string;
  xpReward: number;
  estimatedTime: string;
  description: string;
  completed: boolean;
  locked: boolean;
}

export function ModuleOfTheDay({
  modules,
}: {
  modules: ModuleData[];
}) {
  // Deterministic daily selection favoring incomplete modules
  const modOfTheDay = useMemo(() => {
    if (!modules.length) return null;
    
    const now = new Date();
    // Simplified day of year calculation without timezone offset issues
    const start = new Date(now.getFullYear(), 0, 0);
    const diff = now.getTime() - start.getTime();
    const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));

    // Prefer uncompleted modules first
    const incomplete = modules.filter(m => !m.completed && !m.locked);
    const pool = incomplete.length > 0 ? incomplete : modules.filter(m => !m.locked);
    
    if (!pool.length) return null;
    
    return pool[dayOfYear % pool.length];
  }, [modules]);

  if (!modOfTheDay) return null;

  return (
    <div className="bg-card/60 backdrop-blur-2xl border shadow-xl rounded-3xl p-1 border-primary/20 relative overflow-hidden group">
      {/* Animated gradient border background */}
      <div className="absolute inset-0 bg-linear-to-r from-primary/10 via-primary/5 to-transparent opacity-70 group-hover:opacity-100 transition-opacity duration-700" />
      
      <div className="relative bg-card/60 backdrop-blur-2xl rounded-2xl p-5 sm:p-6 border border-border/20 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
        <div className="space-y-2 flex-1">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-xl bg-primary/10 text-primary text-[9px] font-bold uppercase tracking-widest">
              Module of the Day
            </span>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              {modOfTheDay.category}
            </span>
          </div>
          
          <h3 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
            {modOfTheDay.title}
          </h3>
          <p className="text-sm text-muted-foreground font-medium line-clamp-2 max-w-2xl">
            {modOfTheDay.description}
          </p>
          
          <div className="flex items-center gap-4 pt-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              {modOfTheDay.estimatedTime}
            </div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-warning">
              <Star className="h-3.5 w-3.5" />
              +{modOfTheDay.xpReward} XP
            </div>
          </div>
        </div>

        <div className="shrink-0">
          <Link
            href={`/dashboard/learning/${modOfTheDay.slug}`}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-transform hover:scale-105 active:scale-95"
          >
            <PlayCircle className="h-4 w-4" />
            Start Learning
          </Link>
        </div>
      </div>
    </div>
  );
}