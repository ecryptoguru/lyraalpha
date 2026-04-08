"use client";

import { useState } from "react";
import { CheckCircle2, Circle, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "ux:getting-started:v1";
const DISMISSED_KEY = "ux:getting-started-dismissed:v1";

interface ChecklistStep {
  id: string;
  label: string;
  description: string;
  href?: string;
  actionLabel?: string;
}

const STEPS: ChecklistStep[] = [
  {
    id: "onboarding",
    label: "Complete setup",
    description: "You told us your region, experience level and interests.",
  },
  {
    id: "open_asset",
    label: "Open an asset",
    description: "Browse assets and click any card to see its full analysis.",
    href: "/dashboard/assets",
    actionLabel: "Browse Assets →",
  },
  {
    id: "ask_lyra",
    label: "Ask Lyra a question",
    description: "Type any market question in plain English and get an instant answer.",
    href: "/dashboard/lyra",
    actionLabel: "Ask Lyra →",
  },
  {
    id: "add_watchlist",
    label: "Add an asset to your Watchlist",
    description: "Tap the ★ on any asset card to track it.",
    href: "/dashboard/assets",
    actionLabel: "Find an Asset →",
  },
  {
    id: "learn_module",
    label: "Complete a Learning module",
    description: "Short lessons that explain what the scores mean — earn XP as you go.",
    href: "/dashboard/learning",
    actionLabel: "Start Learning →",
  },
];

function loadCompleted(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const arr = raw ? (JSON.parse(raw) as string[]) : ["onboarding"];
    return new Set(arr);
  } catch {
    return new Set(["onboarding"]);
  }
}

function saveCompleted(ids: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(ids)));
  } catch {
    // ignore
  }
}

function loadDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

export function GettingStartedChecklist() {
  const [completed, setCompleted] = useState<Set<string>>(() => loadCompleted());
  const [dismissed, setDismissed] = useState<boolean>(() => loadDismissed());
  const [collapsed, setCollapsed] = useState(false);

  const completedCount = completed.size;
  const totalCount = STEPS.length;
  const allDone = completedCount >= totalCount;

  const handleDismiss = () => {
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // ignore
    }
    setDismissed(true);
  };

  const markDone = (id: string) => {
    setCompleted((prev) => {
      const next = new Set(prev);
      next.add(id);
      saveCompleted(next);
      return next;
    });
  };

  if (dismissed) return null;
  if (allDone) return null;

  const progressPct = Math.round((completedCount / totalCount) * 100);

  return (
    <div className="rounded-2xl border border-primary/20 bg-primary/5 overflow-hidden">
      <button
        type="button"
        onClick={() => setCollapsed((p) => !p)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-primary/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Sparkles className="h-4 w-4 text-primary shrink-0" />
          <div className="text-left">
            <p className="text-xs font-bold uppercase tracking-widest text-primary">
              Getting Started
            </p>
            <p className="text-[10px] text-muted-foreground">
              {completedCount}/{totalCount} steps complete
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2">
            <div className="h-1.5 w-24 bg-muted/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span className="text-[10px] font-bold text-primary">{progressPct}%</span>
          </div>
          {collapsed ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {!collapsed && (
        <div className="px-4 pb-4 space-y-2 border-t border-primary/10 pt-3">
          {STEPS.map((step) => {
            const isDone = completed.has(step.id);
            return (
              <div
                key={step.id}
                className={cn(
                  "flex items-start gap-3 rounded-2xl px-3 py-2.5 transition-colors",
                  isDone ? "opacity-70" : "bg-background/40 border border-border/30"
                )}
              >
                <button
                  type="button"
                  onClick={() => !isDone && markDone(step.id)}
                  className="mt-0.5 shrink-0"
                  aria-label={isDone ? "Completed" : "Mark as done"}
                >
                  {isDone ? (
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground/40" />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={cn("text-xs font-bold", isDone ? "line-through text-muted-foreground" : "text-foreground")}>
                    {step.label}
                  </p>
                  {!isDone && (
                    <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
                      {step.description}
                    </p>
                  )}
                </div>
                {!isDone && step.href && (
                  <Link
                    href={step.href}
                    onClick={() => markDone(step.id)}
                    className="shrink-0 text-[10px] font-bold text-primary hover:underline whitespace-nowrap"
                  >
                    {step.actionLabel}
                  </Link>
                )}
              </div>
            );
          })}

          <button
            type="button"
            onClick={handleDismiss}
            className="w-full text-[10px] text-muted-foreground hover:text-muted-foreground pt-1 transition-colors"
          >
            Dismiss this guide
          </button>
        </div>
      )}
    </div>
  );
}
