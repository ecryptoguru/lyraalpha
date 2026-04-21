"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface ResponseFeedbackProps {
  answerId: string;
  query: string;
  responseSnippet?: string;
  symbol?: string;
  queryTier?: string;
  model?: string;
}

// ─── Shared sub-component ────────────────────────────────────────────────────
interface FeedbackButtonProps {
  direction: 1 | -1;
  vote: 1 | -1 | null;
  isLocked: boolean;
  submitting: boolean;
  onVote: (v: 1 | -1) => void;
}

function FeedbackButton({ direction, vote, isLocked, submitting, onVote }: FeedbackButtonProps) {
  const isUp = direction === 1;
  const isActive = vote === direction;
  const isOtherLocked = isLocked && !isActive;

  const activeClasses = isUp
    ? ["border-success bg-success/20 text-success cursor-default",
       "shadow-[0_0_8px_2px_rgba(52,211,153,0.5),0_0_20px_4px_rgba(52,211,153,0.2)]"]
    : ["border-danger bg-danger/20 text-danger cursor-default",
       "shadow-[0_0_8px_2px_rgba(251,113,133,0.5),0_0_20px_4px_rgba(251,113,133,0.2)]"];

  const hoverClasses = isUp
    ? "hover:border-success/50 hover:text-success hover:bg-success/10 hover:scale-110"
    : "hover:border-danger/50 hover:text-danger hover:bg-danger/10 hover:scale-110";

  const dotClasses = isUp
    ? "bg-success shadow-[0_0_6px_2px_rgba(52,211,153,0.7)]"
    : "bg-danger shadow-[0_0_6px_2px_rgba(251,113,133,0.7)]";

  const Icon = isUp ? ThumbsUp : ThumbsDown;

  return (
    <button
      onClick={() => onVote(direction)}
      disabled={submitting || isLocked || isActive}
      aria-label={isUp ? "Thumbs up" : "Thumbs down"}
      className={cn(
        "relative flex items-center justify-center w-8 h-8 rounded-xl border-2 transition-all duration-300 outline-none active:scale-95",
        isOtherLocked
          ? "opacity-20 cursor-not-allowed border-border/30 bg-muted/10 text-muted-foreground/30"
          : isActive
          ? activeClasses
          : `border-border/40 bg-muted/20 text-muted-foreground/40 ${hoverClasses}`,
      )}
    >
      <Icon className={cn("w-3.5 h-3.5 transition-transform duration-200", isActive && "scale-110")} />
      {isActive && (
        <motion.span
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className={cn("absolute -top-1 -right-1 w-2 h-2 rounded-full", dotClasses)}
        />
      )}
    </button>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

export function ResponseFeedback({
  answerId,
  query,
  responseSnippet,
  symbol,
  queryTier,
  model,
}: ResponseFeedbackProps) {
  const [vote, setVote] = useState<1 | -1 | null>(null);
  const [changeCount, setChangeCount] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [showThanks, setShowThanks] = useState(false);
  const initialized = useRef(false);
  const thanksTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup the thanks-message timer on unmount to prevent stale state updates
  useEffect(() => {
    return () => { if (thanksTimer.current) clearTimeout(thanksTimer.current); };
  }, []);

  // Restore existing vote on mount — counts as the initial state (not a "change")
  useEffect(() => {
    if (initialized.current || !answerId) return;
    initialized.current = true;
    fetch(`/api/lyra/feedback?answerId=${encodeURIComponent(answerId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.vote != null) {
          setVote(data.vote);
          setChangeCount(1); // already voted once — one change left
        }
      })
      .catch(() => {
        // Fire-and-forget: if the prior-vote fetch fails we treat the user as
        // unvoted (default state), which is correct and safe. Surfacing a toast
        // here would annoy users on every transient network hiccup.
      });
  }, [answerId]);

  const canVote = changeCount < 2;
  const isLocked = changeCount >= 2;

  const handleVote = useCallback(async (newVote: 1 | -1) => {
    if (submitting || !canVote || newVote === vote) return;

    const prevVote = vote;
    setVote(newVote);
    setChangeCount((c) => c + 1);
    setSubmitting(true);
    if (thanksTimer.current) clearTimeout(thanksTimer.current);
    setShowThanks(true);

    try {
      const res = await fetch("/api/lyra/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answerId, vote: newVote, query, responseSnippet, symbol, queryTier, model }),
      });
      if (!res.ok) throw new Error("Failed");
    } catch {
      setVote(prevVote);
      setChangeCount((c) => Math.max(0, c - 1));
      setShowThanks(false);
      return;
    } finally {
      setSubmitting(false);
    }

    thanksTimer.current = setTimeout(() => setShowThanks(false), 2500);
  }, [submitting, canVote, vote, answerId, query, responseSnippet, symbol, queryTier, model]);

  return (
    <div className="flex items-center gap-3 mt-6 pt-4 border-t border-border/30">
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 select-none">
        Was this helpful?
      </span>

      <div className="flex items-center gap-2">
        <FeedbackButton direction={1}  vote={vote} isLocked={isLocked} submitting={submitting} onVote={handleVote} />
        <FeedbackButton direction={-1} vote={vote} isLocked={isLocked} submitting={submitting} onVote={handleVote} />
      </div>

      <AnimatePresence mode="wait">
        {showThanks && (
          <motion.span
            key={`thanks-${vote}-${changeCount}`}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 6 }}
            transition={{ duration: 0.2 }}
            className={cn(
              "text-[10px] font-bold uppercase tracking-widest",
              vote === 1 ? "text-success/80" : "text-danger/80",
            )}
          >
            {changeCount === 2
              ? (vote === 1 ? "Updated to helpful ✓" : "Updated to not helpful ✓")
              : (vote === 1 ? "Thanks! 🙌" : "Got it, we'll improve!")}
          </motion.span>
        )}
        {isLocked && !showThanks && (
          <motion.span
            key="locked"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-[10px] text-muted-foreground/30 select-none"
          >
            Feedback locked
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}
