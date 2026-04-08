"use client";

import React, { useState, useEffect, useRef } from "react";
import { Crown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ELITE_COMMAND_DEFINITIONS,
  getCommandSuggestions,
  isCommandInput,
} from "@/lib/ai/elite-commands";

interface EliteCommandBarProps {
  inputValue: string;
  onCommandSelect: (command: string) => void;
  visible: boolean;
}

export function EliteCommandBar({ inputValue, onCommandSelect, visible }: EliteCommandBarProps) {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const showSuggestions = visible && isCommandInput(inputValue);
  const suggestions = React.useMemo(() => {
    if (!showSuggestions) return ELITE_COMMAND_DEFINITIONS;
    const matches = getCommandSuggestions(inputValue);
    return matches.length > 0 ? matches : ELITE_COMMAND_DEFINITIONS;
  }, [inputValue, showSuggestions]);

  // Clamp to valid range — naturally resets to 0 when suggestions shrink
  const clampedIdx = Math.min(selectedIdx, Math.max(suggestions.length - 1, 0));

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!showSuggestions) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIdx((i) => Math.min(i + 1, suggestions.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === "Tab" && suggestions[selectedIdx]) {
        e.preventDefault();
        onCommandSelect(suggestions[selectedIdx].syntax);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showSuggestions, suggestions, selectedIdx, onCommandSelect]);

  if (!visible) return null;

  // Show command chips when not typing a command
  if (!showSuggestions) {
    return (
      <div className="flex items-center gap-1.5 flex-wrap px-1 py-1">
        <div className="flex items-center gap-1 shrink-0">
          <Crown className="h-2.5 w-2.5 text-primary" />
          <span className="text-[8px] font-bold uppercase tracking-[0.15em] text-primary/70">Elite Commands:</span>
        </div>
        {ELITE_COMMAND_DEFINITIONS.slice(0, 4).map((cmd) => (
          <button
            key={cmd.command}
            onClick={() => onCommandSelect(cmd.syntax)}
            className="px-2 py-0.5 rounded-lg border border-primary/20 bg-primary/5 text-[8px] font-bold text-primary/80 hover:bg-primary/15 hover:border-primary/40 transition-colors"
          >
            {cmd.command}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="absolute bottom-full left-0 right-0 mb-2 rounded-2xl border border-primary/30 bg-card/95 backdrop-blur-xl shadow-2xl overflow-hidden z-50"
    >
      <div className="px-3 py-2 border-b border-border/30 flex items-center gap-1.5">
        <Crown className="h-3 w-3 text-primary" />
        <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-primary">Elite Commands</span>
      </div>
      <div className="py-1">
        {suggestions.map((cmd, i) => (
          <button
            key={cmd.command}
            onClick={() => onCommandSelect(cmd.syntax)}
            className={cn(
              "w-full flex items-start gap-3 px-3 py-2.5 text-left transition-colors",
              i === clampedIdx ? "bg-primary/10" : "hover:bg-muted/30",
            )}
          >
            <div className="shrink-0 mt-0.5">
              <span className="text-[10px] font-bold text-primary font-mono">{cmd.command}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-foreground/80">{cmd.description}</p>
              <p className="text-[9px] text-muted-foreground/60 font-mono mt-0.5">{cmd.example}</p>
            </div>
            <ChevronRight className="h-3 w-3 text-muted-foreground/40 shrink-0 mt-0.5" />
          </button>
        ))}
      </div>
      <div className="px-3 py-1.5 border-t border-border/20 bg-muted/10">
        <p className="text-[8px] text-muted-foreground/50">Tab to select · Enter to send · Esc to dismiss</p>
      </div>
    </div>
  );
}
