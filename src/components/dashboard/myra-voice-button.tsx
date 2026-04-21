"use client";

import { motion } from "framer-motion";
import { Mic, MicOff } from "lucide-react";
import type { VoiceState } from "@/hooks/use-myra-voice";

interface MyraVoiceButtonProps {
  state: VoiceState;
  onStart: () => void;
  onStop: () => void;
  disabled?: boolean;
}

const WAVEFORM_HEIGHTS = [0.45, 1, 0.7, 1, 0.45];

export function MyraVoiceButton({ state, onStart, onStop, disabled }: MyraVoiceButtonProps) {
  const handleClick = () => {
    if (disabled) return;
    if (state === "active") {
      onStop();
    } else if (state === "idle" || state === "error") {
      onStart();
    }
  };

  const isDisabled = disabled || state === "connecting";

  const ariaLabel =
    state === "idle" ? "Start voice chat"
    : state === "connecting" ? "Connecting…"
    : state === "active" ? "Stop voice chat"
    : "Retry voice chat";

  return (
    <motion.button
      whileHover={isDisabled ? {} : { scale: 1.06 }}
      whileTap={isDisabled ? {} : { scale: 0.9 }}
      onClick={handleClick}
      disabled={isDisabled}
      aria-label={ariaLabel}
      title={ariaLabel}
      className={[
        "relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-all duration-200",
        state === "active"
          ? "bg-warning text-foreground shadow-[0_0_0_3px_rgba(245,158,11,0.28)] hover:bg-warning1345"
          : state === "error"
            ? "border border-danger/60 bg-danger/5 text-danger hover:bg-danger/10 dark:border-danger/30 dark:bg-danger/10 dark:text-danger dark:hover:bg-danger/18"
            : state === "connecting"
              ? "cursor-not-allowed border border-warning/40 bg-white text-warning opacity-70 dark:border-warning/22 dark:bg-white/4 dark:text-warning"
              : "border border-border/80 bg-white text-muted-foreground hover:border-warning/50 hover:bg-primary/5 hover:text-warning dark:border-white/10 dark:bg-white/3 dark:text-white/48 dark:hover:border-warning/28 dark:hover:bg-warning1969 dark:hover:text-primary/60",
      ].join(" ")}
    >
      {state === "connecting" && (
        <motion.span
          className="absolute inset-0 rounded-full border-2 border-warning/60"
          animate={{ scale: [1, 1.35, 1], opacity: [0.7, 0, 0.7] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
        />
      )}

      {state === "active" ? (
        <span className="flex items-end gap-[2px]">
          {WAVEFORM_HEIGHTS.map((h, i) => (
            <motion.span
              key={i}
              className="w-[3px] rounded-full bg-foreground/5"
              style={{ height: 4 }}
              animate={{ scaleY: [h, 1, h * 0.6, 1, h] }}
              transition={{
                duration: 0.9,
                repeat: Infinity,
                delay: i * 0.09,
                ease: "easeInOut",
              }}
            />
          ))}
        </span>
      ) : state === "error" ? (
        <MicOff className="h-4 w-4" />
      ) : (
        <Mic className="h-4 w-4" />
      )}
    </motion.button>
  );
}
