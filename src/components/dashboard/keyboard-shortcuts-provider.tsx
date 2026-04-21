"use client";

import React, { useState, useCallback } from "react";
import { useKeyboardShortcut, Kbd } from "@/hooks/use-keyboard-shortcut";
import { motion, AnimatePresence } from "framer-motion";
import { dialogVariants, fadeIn } from "@/lib/motion";
import { X } from "lucide-react";

interface ShortcutEntry {
  keys: string[];
  description: string;
  category: string;
}

const SHORTCUTS: ShortcutEntry[] = [
  { keys: ["⌘", "K"], description: "Open command palette", category: "General" },
  { keys: ["⌘", "⇧", "P"], description: "Toggle density mode", category: "General" },
  { keys: ["⌘", "⇧", "D"], description: "Toggle dark / light theme", category: "General" },
  { keys: ["Esc"], description: "Close palette / dialog", category: "General" },
  { keys: ["?"], description: "Show keyboard shortcuts", category: "General" },
  { keys: ["G", "D"], description: "Go to Dashboard", category: "Navigation" },
  { keys: ["G", "A"], description: "Go to Asset Intel", category: "Navigation" },
  { keys: ["G", "L"], description: "Go to Ask Lyra", category: "Navigation" },
  { keys: ["G", "W"], description: "Go to Watchlist", category: "Navigation" },
  { keys: ["G", "S"], description: "Go to Settings", category: "Navigation" },
];

function ShortcutsCheatsheet({ onClose }: { onClose: () => void }) {
  const grouped = SHORTCUTS.reduce<Record<string, ShortcutEntry[]>>((acc, s) => {
    if (!acc[s.category]) acc[s.category] = [];
    acc[s.category].push(s);
    return acc;
  }, {});

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-100 flex items-start justify-center pt-[12vh] sm:pt-[15vh]"
        initial="hidden"
        animate="visible"
        exit="exit"
        variants={fadeIn()}
      >
        <motion.div
          className="absolute inset-0 bg-black/60 backdrop-blur-xl"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        />
        <motion.div
          className="relative w-full max-w-md mx-4 rounded-2xl border border-primary/20 bg-card/95 backdrop-blur-xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.5)] overflow-hidden"
          variants={dialogVariants}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/30">
            <h2 className="text-sm font-bold">Keyboard Shortcuts</h2>
            <button
              onClick={onClose}
              className="rounded-lg p-1 text-muted-foreground hover:bg-muted/30 transition-colors"
              aria-label="Close shortcuts"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="max-h-80 overflow-y-auto py-3 px-5 space-y-4">
            {Object.entries(grouped).map(([category, entries]) => (
              <div key={category}>
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/50 mb-2">{category}</p>
                <div className="space-y-2">
                  {entries.map((entry) => (
                    <div key={entry.description} className="flex items-center justify-between">
                      <span className="text-sm text-foreground/80">{entry.description}</span>
                      <div className="flex items-center gap-0.5">
                        {entry.keys.map((key, i) => (
                          <React.Fragment key={i}>
                            {i > 0 && <span className="text-[9px] text-muted-foreground/40 mx-0.5">+</span>}
                            <Kbd className="text-[10px]!">{key}</Kbd>
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * Mount once in the dashboard layout. Wires global keyboard shortcuts
 * and provides the shortcuts cheatsheet overlay.
 */
export function KeyboardShortcutsProvider() {
  const [showCheatsheet, setShowCheatsheet] = useState(false);

  // ? to open cheatsheet (only when not in an input)
  useKeyboardShortcut({
    key: "?",
    onTrigger: useCallback(() => setShowCheatsheet(true), []),
  });

  // Escape to close cheatsheet
  useKeyboardShortcut({
    key: "Escape",
    onTrigger: useCallback(() => setShowCheatsheet(false), []),
    allowInInput: true,
    enabled: showCheatsheet,
  });

  return showCheatsheet ? <ShortcutsCheatsheet onClose={() => setShowCheatsheet(false)} /> : null;
}
