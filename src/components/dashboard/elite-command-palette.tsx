"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Crown,
  ChartLine,
  Bot,
  GitCompare,
  Star,
  Radar,
  Newspaper,
  GraduationCap,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  action: () => void;
  category: "navigate" | "ai" | "asset";
  keywords: string[];
}

const STATIC_COMMANDS = (router: ReturnType<typeof useRouter>): CommandItem[] => [
  {
    id: "nav-lyra",
    label: "Lyra AI Intel",
    description: "Open AI chat interface",
    icon: <Bot className="h-4 w-4" />,
    action: () => router.push("/dashboard"),
    category: "navigate",
    keywords: ["lyra", "ai", "chat", "intel"],
  },
  {
    id: "nav-assets",
    label: "Market Intel",
    description: "Browse all assets",
    icon: <ChartLine className="h-4 w-4" />,
    action: () => router.push("/dashboard/assets"),
    category: "navigate",
    keywords: ["assets", "stocks", "market", "analysis"],
  },
  {
    id: "nav-compare",
    label: "Compare Assets",
    description: "Side-by-side comparison",
    icon: <GitCompare className="h-4 w-4" />,
    action: () => router.push("/dashboard/compare"),
    category: "navigate",
    keywords: ["compare", "comparison", "vs"],
  },
  {
    id: "nav-watchlist",
    label: "Watchlist",
    description: "Your tracked assets",
    icon: <Star className="h-4 w-4" />,
    action: () => router.push("/dashboard/watchlist"),
    category: "navigate",
    keywords: ["watchlist", "saved", "tracked"],
  },
  {
    id: "nav-discovery",
    label: "Discovery Feed",
    description: "AI-curated signals",
    icon: <Radar className="h-4 w-4" />,
    action: () => router.push("/dashboard/discovery"),
    category: "navigate",
    keywords: ["discovery", "signals", "feed"],
  },
  {
    id: "nav-timeline",
    label: "Market Timeline",
    description: "Institutional events",
    icon: <Newspaper className="h-4 w-4" />,
    action: () => router.push("/dashboard/timeline"),
    category: "navigate",
    keywords: ["timeline", "events", "news"],
  },
  {
    id: "nav-learning",
    label: "Learning Hub",
    description: "Market education modules",
    icon: <GraduationCap className="h-4 w-4" />,
    action: () => router.push("/dashboard/learning"),
    category: "navigate",
    keywords: ["learning", "education", "modules"],
  },
  {
    id: "ai-deepdive",
    label: "Ask Lyra: Deep Dive",
    description: "Type a symbol for full analysis",
    icon: <Sparkles className="h-4 w-4" />,
    action: () => router.push("/dashboard?q=/deepdive+"),
    category: "ai",
    keywords: ["deepdive", "deep", "analysis", "lyra"],
  },
  {
    id: "ai-watchlist-audit",
    label: "Ask Lyra: Watchlist Audit",
    description: "Holistic watchlist review",
    icon: <Sparkles className="h-4 w-4" />,
    action: () => router.push("/dashboard?q=/watchlist-audit"),
    category: "ai",
    keywords: ["audit", "watchlist", "review", "lyra"],
  },
];

export function EliteCommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const commands = React.useMemo(() => STATIC_COMMANDS(router), [router]);

  const filtered = React.useMemo(() => {
    if (!query.trim()) return commands;
    const q = query.toLowerCase();
    return commands.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        c.description?.toLowerCase().includes(q) ||
        c.keywords.some((k) => k.includes(q)),
    );
  }, [query, commands]);

  const runCommand = useCallback(
    (cmd: CommandItem) => {
      setOpen(false);
      setQuery("");
      cmd.action();
    },
    [],
  );

  // Global ⌘K listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
        setQuery("");
        setSelectedIdx(0);
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Arrow key navigation
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIdx((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && filtered[selectedIdx]) {
        e.preventDefault();
        runCommand(filtered[selectedIdx]);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, filtered, selectedIdx, runCommand]);

  // Reset selection when filter changes
  const clampedIdx = Math.min(selectedIdx, Math.max(filtered.length - 1, 0));

  if (!open) return null;

  const categoryLabels: Record<string, string> = {
    navigate: "Navigate",
    ai: "Ask Lyra",
    asset: "Assets",
  };

  const grouped = filtered.reduce<Record<string, CommandItem[]>>((acc, cmd) => {
    if (!acc[cmd.category]) acc[cmd.category] = [];
    acc[cmd.category].push(cmd);
    return acc;
  }, {});

  return (
    <div className="fixed inset-0 z-100 flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-xl"
        onClick={() => setOpen(false)}
      />

      {/* Palette */}
      <div className="relative w-full max-w-lg mx-4 rounded-2xl border border-primary/30 bg-card/95 backdrop-blur-xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.5)] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border/30">
          <Crown className="h-4 w-4 text-primary shrink-0" />
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIdx(0); }}
            placeholder="Search commands, assets, pages..."
            className="flex-1 bg-transparent text-sm font-medium placeholder:text-muted-foreground/40 focus:outline-none"
          />
          <kbd className="hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-white/5 text-[9px] font-bold text-muted-foreground">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-80 overflow-y-auto scroll-smooth py-2">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-muted-foreground font-bold">No commands found</p>
            </div>
          ) : (
            Object.entries(grouped).map(([category, items]) => (
              <div key={category}>
                <p className="px-4 py-1.5 text-[8px] font-bold uppercase tracking-[0.18em] text-muted-foreground/40">
                  {categoryLabels[category] || category}
                </p>
                {items.map((cmd) => {
                  const globalIdx = filtered.indexOf(cmd);
                  return (
                    <button
                      key={cmd.id}
                      onClick={() => runCommand(cmd)}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors",
                        globalIdx === clampedIdx ? "bg-primary/10" : "hover:bg-muted/20",
                      )}
                    >
                      <div className={cn(
                        "p-1.5 rounded-2xl border shrink-0",
                        globalIdx === clampedIdx
                          ? "bg-primary/15 border-primary/30 text-primary"
                          : "bg-muted/20 border-border/30 text-muted-foreground",
                      )}>
                        {cmd.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate">{cmd.label}</p>
                        {cmd.description && (
                          <p className="text-[10px] text-muted-foreground truncate">{cmd.description}</p>
                        )}
                      </div>
                      <ArrowRight className={cn(
                        "h-3.5 w-3.5 shrink-0 transition-opacity",
                        globalIdx === clampedIdx ? "opacity-80 text-primary" : "opacity-20",
                      )} />
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-border/20 bg-muted/5 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Crown className="h-2.5 w-2.5 text-primary" />
            <span className="text-[8px] font-bold uppercase tracking-[0.15em] text-primary/70">Elite Command Palette</span>
          </div>
          <div className="flex items-center gap-2 text-[8px] text-muted-foreground/40 font-bold">
            <span>↑↓ navigate</span>
            <span>↵ select</span>
          </div>
        </div>
      </div>
    </div>
  );
}
