"use client";

import React, { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

type Modifier = "alt" | "ctrl" | "meta" | "shift";

interface ShortcutConfig {
  /** Key name (e.g. "k", "Escape", "ArrowDown"). Case-insensitive for letters. */
  key: string;
  /** Required modifier keys. */
  modifiers?: Modifier[];
  /** Handler when the shortcut fires. */
  onTrigger: () => void;
  /** Whether the shortcut is currently active. Default: true */
  enabled?: boolean;
  /** Prevent default browser behavior. Default: true */
  preventDefault?: boolean;
  /** Stop event propagation. Default: false */
  stopPropagation?: boolean;
  /**
   * If true, the shortcut fires even when the user is typing in an input/textarea/select.
   * Only set this for Escape-like shortcuts. Default: false
   */
  allowInInput?: boolean;
}

function isTypingInInput(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return false;
}

function matchesModifiers(event: KeyboardEvent, modifiers: Modifier[]): boolean {
  const required = new Set(modifiers);
  const altOk = required.has("alt") ? event.altKey : !event.altKey;
  const ctrlOk = required.has("ctrl") ? event.ctrlKey : !event.ctrlKey;
  const metaOk = required.has("meta") ? event.metaKey : !event.metaKey;
  const shiftOk = required.has("shift") ? event.shiftKey : !event.shiftKey;
  return altOk && ctrlOk && metaOk && shiftOk;
}

/**
 * Composable keyboard shortcut hook.
 * Safe by default: does not fire when typing in inputs unless `allowInInput` is set.
 * Automatically cleans up on unmount.
 */
export function useKeyboardShortcut(config: ShortcutConfig) {
  const {
    key,
    modifiers,
    onTrigger,
    enabled = true,
    preventDefault = true,
    stopPropagation = false,
    allowInInput = false,
  } = config;

  // Stable modifier dependency — sorting makes ["meta","shift"] === ["shift","meta"]
  const modifierKey = (modifiers ?? []).slice().sort().join(",");

  // Keep handler ref fresh without re-attaching listener
  const handlerRef = useRef(onTrigger);
  useEffect(() => { handlerRef.current = onTrigger; });

  useEffect(() => {
    if (!enabled) return;

    const activeModifiers: Modifier[] = modifierKey ? (modifierKey.split(",") as Modifier[]) : [];

    const onKeyDown = (event: KeyboardEvent) => {
      // Key match (case-insensitive for single letters)
      if (event.key.toLowerCase() !== key.toLowerCase() && event.key !== key) return;

      // Skip if typing in input (unless explicitly allowed)
      if (!allowInInput && isTypingInInput(event.target)) return;

      // Check modifiers
      if (!matchesModifiers(event, activeModifiers)) return;

      if (preventDefault) event.preventDefault();
      if (stopPropagation) event.stopPropagation();

      handlerRef.current();
    };

    document.addEventListener("keydown", onKeyDown, { passive: !preventDefault });
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [key, modifierKey, enabled, preventDefault, stopPropagation, allowInInput]);
}

// ── Kbd rendering helper ────────────────────────────────────────────────────

interface KbdProps {
  children: React.ReactNode;
  className?: string;
}

export function Kbd({ children, className }: KbdProps) {
  return (
    <kbd
      className={cn(
        "inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5",
        "text-[11px] font-mono font-medium leading-none",
        "rounded-md border border-border/60 bg-muted/60 text-muted-foreground",
        "shadow-[0_1px_0_1px_rgba(0,0,0,0.05)] dark:shadow-[0_1px_0_1px_rgba(255,255,255,0.04)]",
        className,
      )}
    >
      {children}
    </kbd>
  );
}

