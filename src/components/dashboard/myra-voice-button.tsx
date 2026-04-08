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
          ? "bg-amber-400 text-slate-950 shadow-[0_0_0_3px_rgba(245,158,11,0.28)] hover:bg-amber-300"
          : state === "error"
            ? "border border-red-300/60 bg-red-50 text-red-500 hover:bg-red-100 dark:border-red-400/30 dark:bg-red-400/10 dark:text-red-400 dark:hover:bg-red-400/18"
            : state === "connecting"
              ? "cursor-not-allowed border border-amber-300/40 bg-white text-amber-400 opacity-70 dark:border-amber-300/22 dark:bg-white/4 dark:text-amber-300"
              : "border border-slate-200/80 bg-white text-slate-500 hover:border-amber-300/50 hover:bg-amber-50 hover:text-amber-500 dark:border-white/10 dark:bg-white/3 dark:text-white/48 dark:hover:border-amber-300/28 dark:hover:bg-amber-300/8 dark:hover:text-amber-200",
      ].join(" ")}
    >
      {state === "connecting" && (
        <motion.span
          className="absolute inset-0 rounded-full border-2 border-amber-400/60"
          animate={{ scale: [1, 1.35, 1], opacity: [0.7, 0, 0.7] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
        />
      )}

      {state === "active" ? (
        <span className="flex items-end gap-[2px]">
          {WAVEFORM_HEIGHTS.map((h, i) => (
            <motion.span
              key={i}
              className="w-[3px] rounded-full bg-slate-950"
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
