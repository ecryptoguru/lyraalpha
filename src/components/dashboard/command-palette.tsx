"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  ChartLine,
  Bot,
  GitCompare,
  Star,
  Radar,
  Newspaper,
  GraduationCap,
  ArrowRight,
  Sparkles,
  Shield,
  Settings2,
  Gift,
  PieChart,
  FlaskConical,
  Globe,
  Zap,
  Keyboard,
  Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePlan } from "@/hooks/use-plan";
import { useTheme } from "next-themes";
import { Kbd } from "@/hooks/use-keyboard-shortcut";
import { dialogVariants, fadeIn } from "@/lib/motion";

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  action: () => void;
  category: "navigate" | "ai" | "action" | "asset";
  keywords: string[];
  /** If set, item is visible but gated behind this plan tier */
  gatedPlan?: "ELITE" | "PRO";
}

const PLAN_ORDER: Record<string, number> = { STARTER: 0, PRO: 1, ELITE: 2, ENTERPRISE: 3 };

function isGated(gatedPlan: string | undefined, userPlan: string): boolean {
  if (!gatedPlan) return false;
  return (PLAN_ORDER[userPlan] ?? 0) < (PLAN_ORDER[gatedPlan] ?? 0);
}

function buildCommands(
  router: ReturnType<typeof useRouter>,
  userPlan: string,
  toggleTheme: () => void,
): CommandItem[] {
  return [
    // ── Navigate ────────────────────────────────────────────────────────────
    {
      id: "nav-dashboard",
      label: "Dashboard",
      description: "Home feed and briefing",
      icon: <Sparkles className="h-4 w-4" />,
      action: () => router.push("/dashboard"),
      category: "navigate",
      keywords: ["home", "dashboard", "feed"],
    },
    {
      id: "nav-lyra",
      label: "Ask Lyra",
      description: "AI crypto analyst",
      icon: <Bot className="h-4 w-4" />,
      action: () => router.push("/dashboard/lyra"),
      category: "navigate",
      keywords: ["lyra", "ai", "chat", "intel", "ask"],
    },
    {
      id: "nav-macro",
      label: "Research",
      description: "Market regime & macro",
      icon: <FlaskConical className="h-4 w-4" />,
      action: () => router.push("/dashboard/macro"),
      category: "navigate",
      keywords: ["research", "macro", "regime"],
    },
    {
      id: "nav-assets",
      label: "Asset Intel",
      description: "Browse crypto assets",
      icon: <ChartLine className="h-4 w-4" />,
      action: () => router.push("/dashboard/assets"),
      category: "navigate",
      keywords: ["assets", "crypto", "market", "analysis", "intel"],
    },
    {
      id: "nav-portfolio",
      label: "Portfolio Intel",
      description: "Holdings & health",
      icon: <PieChart className="h-4 w-4" />,
      action: () => router.push("/dashboard/portfolio"),
      category: "navigate",
      keywords: ["portfolio", "holdings", "health"],
    },
    {
      id: "nav-discovery",
      label: "Multibagger Radar",
      description: "AI-curated signals",
      icon: <Radar className="h-4 w-4" />,
      action: () => router.push("/dashboard/discovery"),
      category: "navigate",
      keywords: ["discovery", "signals", "feed", "multibagger", "radar"],
    },
    {
      id: "nav-sector-pulse",
      label: "Sector Pulse",
      description: "Sector momentum",
      icon: <Globe className="h-4 w-4" />,
      action: () => router.push("/dashboard/sector-pulse"),
      category: "navigate",
      keywords: ["sector", "pulse", "momentum"],
    },
    {
      id: "nav-compare",
      label: "Compare Assets",
      description: "Side-by-side comparison",
      icon: <GitCompare className="h-4 w-4" />,
      action: () => isGated("ELITE", userPlan)
        ? router.push("/dashboard/upgrade")
        : router.push("/dashboard/compare"),
      category: "navigate",
      keywords: ["compare", "comparison", "vs"],
      gatedPlan: "ELITE",
    },
    {
      id: "nav-stress-test",
      label: "Shock Test",
      description: "Stress-test your portfolio",
      icon: <Shield className="h-4 w-4" />,
      action: () => isGated("ELITE", userPlan)
        ? router.push("/dashboard/upgrade")
        : router.push("/dashboard/stress-test"),
      category: "navigate",
      keywords: ["stress", "shock", "test", "simulator"],
      gatedPlan: "ELITE",
    },
    {
      id: "nav-timeline",
      label: "Market Events",
      description: "Institutional events",
      icon: <Newspaper className="h-4 w-4" />,
      action: () => router.push("/dashboard/timeline"),
      category: "navigate",
      keywords: ["timeline", "events", "news"],
    },
    {
      id: "nav-watchlist",
      label: "Watchlist",
      description: "Your tracked assets",
      icon: <Star className="h-4 w-4" />,
      action: () => router.push("/dashboard/watchlist"),
      category: "navigate",
      keywords: ["watchlist", "saved", "tracked", "stars"],
    },
    {
      id: "nav-learning",
      label: "Learning Hub",
      description: "Market education",
      icon: <GraduationCap className="h-4 w-4" />,
      action: () => router.push("/dashboard/learning"),
      category: "navigate",
      keywords: ["learning", "education", "modules"],
    },
    {
      id: "nav-rewards",
      label: "Credits & XP",
      description: "Your credits and rewards",
      icon: <Gift className="h-4 w-4" />,
      action: () => router.push("/dashboard/rewards"),
      category: "navigate",
      keywords: ["credits", "xp", "rewards", "points"],
    },
    {
      id: "nav-settings",
      label: "Settings",
      description: "Preferences & account",
      icon: <Settings2 className="h-4 w-4" />,
      action: () => router.push("/dashboard/settings"),
      category: "navigate",
      keywords: ["settings", "preferences", "account"],
    },
    // ── AI ─────────────────────────────────────────────────────────────────
    {
      id: "ai-deepdive",
      label: "Ask Lyra: Deep Dive",
      description: "Full analysis on a symbol",
      icon: <Sparkles className="h-4 w-4" />,
      action: () => router.push("/dashboard/lyra?q=/deepdive+"),
      category: "ai",
      keywords: ["deepdive", "deep", "analysis", "lyra"],
    },
    {
      id: "ai-watchlist-audit",
      label: "Ask Lyra: Watchlist Audit",
      description: "Holistic watchlist review",
      icon: <Sparkles className="h-4 w-4" />,
      action: () => router.push("/dashboard/lyra?q=/watchlist-audit"),
      category: "ai",
      keywords: ["audit", "watchlist", "review", "lyra"],
    },
    // ── Actions ────────────────────────────────────────────────────────────
    {
      id: "action-theme",
      label: "Toggle Theme",
      description: "Switch dark / light mode",
      icon: <Zap className="h-4 w-4" />,
      action: toggleTheme,
      category: "action",
      keywords: ["theme", "dark", "light", "mode", "toggle"],
    },
    {
      id: "action-shortcuts",
      label: "Keyboard Shortcuts",
      description: "View all shortcuts",
      icon: <Keyboard className="h-4 w-4" />,
      action: () => { /* Will be wired to shortcuts cheatsheet in Phase 1.2 */ },
      category: "action",
      keywords: ["shortcuts", "keyboard", "help"],
    },
  ];
}

const CATEGORY_META: Record<string, { label: string; order: number }> = {
  navigate: { label: "Navigate", order: 0 },
  ai: { label: "Ask Lyra", order: 1 },
  asset: { label: "Assets", order: 2 },
  action: { label: "Actions", order: 3 },
};

export function CommandPalette() {
  const router = useRouter();
  const { plan } = usePlan();
  const { resolvedTheme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const toggleTheme = useCallback(() => {
    const next = resolvedTheme === "dark" ? "light" : "dark";
    setTheme(next);
  }, [resolvedTheme, setTheme]);

  const commands = useMemo(
    () => buildCommands(router, plan ?? "STARTER", toggleTheme),
    [router, plan, toggleTheme],
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return commands;
    const q = query.toLowerCase();
    return commands.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        c.description?.toLowerCase().includes(q) ||
        c.keywords.some((k) => k.includes(q)),
    );
  }, [query, commands]);

  const runCommand = useCallback((cmd: CommandItem) => {
    setOpen(false);
    setQuery("");
    cmd.action();
  }, []);

  // Global ⌘K listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
        setQuery("");
        setSelectedIdx(0);
      }
      if (e.key === "Escape" && open) {
        e.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus());
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

  // Scroll selected item into view
  useEffect(() => {
    if (!open || !listRef.current) return;
    const selected = listRef.current.querySelector('[data-palette-selected="true"]');
    selected?.scrollIntoView({ block: "nearest" });
  }, [open, selectedIdx]);

  // Reset selection when filter changes
  const clampedIdx = Math.min(selectedIdx, Math.max(filtered.length - 1, 0));

  // Group filtered results by category, preserving each item's index in `filtered`
  // so the render loop doesn't need an O(n) indexOf per item.
  const grouped = useMemo(() => {
    const groups: Record<string, Array<{ cmd: CommandItem; index: number }>> = {};
    filtered.forEach((cmd, index) => {
      if (!groups[cmd.category]) groups[cmd.category] = [];
      groups[cmd.category].push({ cmd, index });
    });
    return Object.entries(groups).sort(
      ([a], [b]) => (CATEGORY_META[a]?.order ?? 99) - (CATEGORY_META[b]?.order ?? 99),
    );
  }, [filtered]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-100 flex items-start justify-center pt-[12vh] sm:pt-[15vh]"
          initial="hidden"
          animate="visible"
          exit="exit"
          variants={fadeIn()}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-xl"
            onClick={() => { setOpen(false); setQuery(""); }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          />

          {/* Palette */}
          <motion.div
            className="relative w-full max-w-lg mx-4 rounded-2xl border border-primary/20 bg-card/95 backdrop-blur-xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.5)] overflow-hidden"
            variants={dialogVariants}
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border/30">
              <Search className="h-4 w-4 text-muted-foreground shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => { setQuery(e.target.value); setSelectedIdx(0); }}
                placeholder="Search commands, pages, actions..."
                className="flex-1 bg-transparent text-sm font-medium placeholder:text-muted-foreground/40 focus:outline-none"
                aria-label="Search commands"
              />
              <Kbd>esc</Kbd>
            </div>

            {/* Results */}
            <div ref={listRef} className="max-h-80 overflow-y-auto scroll-smooth py-2 glass-scrollbar">
              {filtered.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <p className="text-sm text-muted-foreground font-medium">No results found</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Try a different search term</p>
                </div>
              ) : (
                grouped.map(([category, items]) => (
                  <div key={category} role="group" aria-label={CATEGORY_META[category]?.label || category}>
                    <p className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/50">
                      {CATEGORY_META[category]?.label || category}
                    </p>
                    {items.map(({ cmd, index }) => {
                      const isSelected = index === clampedIdx;
                      const gated = isGated(cmd.gatedPlan, plan ?? "STARTER");
                      return (
                        <button
                          key={cmd.id}
                          data-palette-selected={isSelected || undefined}
                          onClick={() => runCommand(cmd)}
                          className={cn(
                            "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors duration-100",
                            isSelected ? "bg-primary/10" : "hover:bg-muted/20",
                          )}
                          role="option"
                          aria-selected={isSelected}
                        >
                          <div className={cn(
                            "p-1.5 rounded-xl border shrink-0 transition-colors",
                            isSelected
                              ? "bg-primary/15 border-primary/30 text-primary"
                              : "bg-muted/20 border-border/30 text-muted-foreground",
                          )}>
                            {cmd.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate flex items-center gap-2">
                              {cmd.label}
                              {gated && (
                                <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-primary/70 bg-primary/10 border border-primary/20 rounded-full px-1.5 py-0.5">
                                  <Lock className="h-2.5 w-2.5" />
                                  {cmd.gatedPlan}
                                </span>
                              )}
                            </p>
                            {cmd.description && (
                              <p className="text-[11px] text-muted-foreground truncate">{cmd.description}</p>
                            )}
                          </div>
                          <ArrowRight className={cn(
                            "h-3.5 w-3.5 shrink-0 transition-opacity",
                            isSelected ? "opacity-80 text-primary" : "opacity-20",
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
                <Sparkles className="h-2.5 w-2.5 text-primary" />
                <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-primary/60">Command Palette</span>
              </div>
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground/50 font-medium">
                <span className="flex items-center gap-1"><Kbd className="min-w-[18px]! h-[18px]! text-[9px]!">↑</Kbd><Kbd className="min-w-[18px]! h-[18px]! text-[9px]!">↓</Kbd> navigate</span>
                <span className="flex items-center gap-1"><Kbd className="min-w-[18px]! h-[18px]! text-[9px]!">↵</Kbd> select</span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
