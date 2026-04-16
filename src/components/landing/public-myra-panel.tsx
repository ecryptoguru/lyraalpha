"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Minus, Sparkles, MessageCircle, RotateCcw } from "lucide-react";
import { renderContent } from "@/components/shared/chat-markdown-renderer";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  id: string;
  createdAt: string;
}

const QUICK_REPLIES = [
  "What is LyraAlpha AI?",
  "How does ELITE Beta work?",
  "What are the 300 credits for?",
  "What assets are covered?",
];

const STORAGE_KEY = "myra-public-messages";

// Shared spring config — snappy but not bouncy
const SPRING = { type: "spring" as const, stiffness: 420, damping: 36, mass: 0.8 };
// Bubble entry — fast slide-up fade
const BUBBLE_VARIANTS = {
  hidden: { opacity: 0, y: 8, scale: 0.97 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { ...SPRING } },
};

function loadPersistedMessages(): ChatMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ChatMessage[];
    // Only restore messages from the current session (within 30 min)
    const cutoff = Date.now() - 30 * 60_000;
    return parsed.filter((m) => new Date(m.createdAt).getTime() > cutoff);
  } catch {
    return [];
  }
}

function persistMessages(messages: ChatMessage[]) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  } catch {
    // sessionStorage full — silently ignore
  }
}

// Smooth typing dots using Framer Motion
function TypingDots() {
  return (
    <span className="flex gap-1 items-center">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-slate-400 dark:bg-white/45"
          animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1, 0.8] }}
          transition={{
            duration: 1.1,
            repeat: Infinity,
            delay: i * 0.18,
            ease: "easeInOut",
          }}
        />
      ))}
    </span>
  );
}

// Blinking cursor for streaming text
function StreamingCursor() {
  return (
    <motion.span
      className="inline-block w-[2px] h-[14px] bg-amber-500 dark:bg-amber-300 ml-0.5 align-middle"
      animate={{ opacity: [1, 0] }}
      transition={{ duration: 0.53, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }}
    />
  );
}

export function PublicMyraPanel({
  isMinimized,
  onExpand,
  onMinimize,
  onClose,
}: {
  isMinimized: boolean;
  onExpand: () => void;
  onMinimize: () => void;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(loadPersistedMessages);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [sending, setSending] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const [lastFailedInput, setLastFailedInput] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const errorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Synchronous guard against double-send (same pattern as dashboard's sendingRef)
  const sendingRef = useRef(false);
  // Mirror the input state in a ref so `sendMessage` can read the latest value
  // without declaring `input` as a dependency — otherwise the callback is rebuilt
  // on every keystroke, invalidating memoized children that consume it.
  const inputValueRef = useRef("");

  // Persist messages on change
  useEffect(() => {
    persistMessages(messages);
  }, [messages]);

  // Keep the ref in sync with the controlled `input` state.
  useEffect(() => {
    inputValueRef.current = input;
  }, [input]);

  // Auto-focus input on mount (not on every render)
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 120);
    return () => clearTimeout(t);
  }, []);

  // Auto-dismiss error after 6s
  useEffect(() => {
    if (!sendError) return;
    if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
    errorTimeoutRef.current = setTimeout(() => {
      setSendError(null);
      setLastFailedInput(null);
    }, 6000);
    return () => {
      if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
    };
  }, [sendError]);

  // Keyboard: Escape to minimize, focus trap
  useEffect(() => {
    if (isMinimized) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onMinimize();
        return;
      }
      // Focus trap: keep Tab within panel
      if (e.key === "Tab" && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll<HTMLElement>(
          'button, input, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isMinimized, onMinimize]);

  // Throttled scroll — matches dashboard pattern
  const scrollToBottom = useCallback((instant = false) => {
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => {
      scrollTimeoutRef.current = null;
      messagesEndRef.current?.scrollIntoView({
        behavior: instant ? "instant" : "smooth",
        block: "end",
      });
    }, 80);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages.length, isTyping, scrollToBottom]);

  useEffect(() => {
    if (streamingText) scrollToBottom();
  }, [streamingText, scrollToBottom]);

  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      abortRef.current?.abort();
    };
  }, []);

  // Tick every 60s so relative timestamps stay fresh
  const [nowTick, setNowTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setNowTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const formatTime = useCallback((dateStr: string) => {
    void nowTick;
    const date = new Date(dateStr);
    const diffMs = Date.now() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }, [nowTick]);

  // Memoize rendered streaming content to avoid re-parsing on every token
  const renderedStreaming = useMemo(() => renderContent(streamingText), [streamingText]);

  const sendMessage = useCallback(async (text?: string) => {
    const content = (text ?? inputValueRef.current).trim();
    if (!content || sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    setInput("");
    setSendError(null);
    setLastFailedInput(null);
    setIsTyping(true);
    setStreamingText("");

    const userMsg: ChatMessage = {
      role: "user",
      content,
      id: `temp-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);

    abortRef.current?.abort();
    const streamAbort = new AbortController();
    abortRef.current = streamAbort;

    try {
      const res = await fetch("/api/support/public-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content }),
        signal: streamAbort.signal,
      });

      if (!res.ok) {
        const statusText = res.status === 429
          ? "Too many requests — please wait a moment."
          : res.status === 500
            ? "Server error — please try again later."
            : `Request failed (${res.status})`;
        setSendError(statusText);
        setLastFailedInput(content);
        // Remove the optimistic user message on failure
        setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
        return;
      }

      if (res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          accumulated += decoder.decode(value, { stream: true });
          setStreamingText(accumulated);
        }

        accumulated += decoder.decode();
        if (accumulated.trim()) {
          const aiMsg: ChatMessage = {
            role: "assistant",
            content: accumulated,
            id: `stream-${Date.now()}`,
            createdAt: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, aiMsg]);
        }
        setStreamingText("");
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      console.error("Myra panel stream failed:", err);
      setSendError("Message failed to send — please try again.");
      setLastFailedInput(content);
      setStreamingText("");
    } finally {
      setIsTyping(false);
      sendingRef.current = false;
      setSending(false);
      inputRef.current?.focus();
    }
  }, []);

  const handleRetry = useCallback(() => {
    if (lastFailedInput) {
      setInput(lastFailedInput);
      setSendError(null);
      setLastFailedInput(null);
      // Use setTimeout to ensure input state updates before sending
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [lastFailedInput]);

  const showQuickReplies = messages.length === 0;
  const hasHistory = messages.length > 0;
  const cardClass = "relative overflow-hidden rounded-4xl border border-slate-200/80 bg-white/96 shadow-[0_30px_90px_rgba(15,23,42,0.16)] backdrop-blur-2xl dark:border-white/10 dark:bg-[#07111f]/96 dark:shadow-[0_30px_90px_rgba(0,0,0,0.48)]";
  const launcherClassName = "group relative flex h-16 w-16 items-center justify-center rounded-full border border-amber-300/40 bg-white text-amber-500 shadow-[0_16px_48px_rgba(245,158,11,0.16)] transition-all duration-300 hover:-translate-y-1 hover:border-amber-300/60 hover:bg-amber-50 dark:border-amber-300/30 dark:bg-[#0b1322] dark:text-amber-200 dark:shadow-[0_16px_48px_rgba(0,0,0,0.42)] dark:hover:border-amber-300/45 dark:hover:bg-[#0f182b]";

  // ─── Minimized bubble ───
  if (isMinimized) {
    return (
      <motion.button
        initial={{ opacity: 0, scale: 0.7 }}
        animate={{ opacity: 1, scale: 1, transition: SPRING }}
        exit={{ opacity: 0, scale: 0.7, transition: { duration: 0.15 } }}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.93 }}
        onClick={onExpand}
        className={launcherClassName}
        aria-label="Open Myra"
      >
        <span className="absolute inset-1 rounded-full bg-[radial-gradient(circle,rgba(245,158,11,0.24),rgba(245,158,11,0.02)_68%,transparent)] blur-md transition-opacity duration-300 group-hover:opacity-100 dark:bg-[radial-gradient(circle,rgba(251,191,36,0.22),rgba(251,191,36,0.02)_68%,transparent)]" />
        <MessageCircle className="relative z-10 h-7 w-7" />
        <span className="absolute inset-0 rounded-full border border-amber-300/18" />
      </motion.button>
    );
  }

  // ─── Full chat widget ───
  return (
    <motion.div
      ref={panelRef}
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1, transition: SPRING }}
      exit={{ opacity: 0, y: 12, scale: 0.96, transition: { duration: 0.15 } }}
      className={`w-[calc(100vw-1.5rem)] sm:w-[410px] flex flex-col overflow-hidden ${cardClass}`}
      style={{ height: "min(640px, calc(100dvh - 3rem))" }}
      role="dialog"
      aria-label="Myra AI chat"
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.65),transparent_22%,transparent_78%,rgba(245,158,11,0.08))] dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.04),transparent_22%,transparent_78%,rgba(245,158,11,0.06))]" />

      {/* Header */}
      <div className="relative flex shrink-0 items-center justify-between border-b border-slate-200/80 px-5 py-4 dark:border-white/8">
        <div className="flex items-center gap-3">
          <div className="relative flex h-11 w-11 items-center justify-center rounded-full border border-amber-300/30 bg-amber-50 text-amber-500 shadow-inner dark:border-amber-300/18 dark:bg-amber-300/8 dark:text-amber-200">
            <Sparkles className="h-5 w-5" />
            <span className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-white bg-emerald-400 dark:border-[#07111f]" />
          </div>
          <div>
            <div className="mb-1 flex items-center gap-2">
              <span className="text-base font-bold tracking-tight text-slate-900 dark:text-white">Myra</span>
              <span className="rounded-full border border-amber-300/30 bg-amber-50 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.28em] text-amber-600 dark:border-amber-300/18 dark:bg-amber-300/8 dark:text-amber-100/75">
                AI
              </span>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-[0.28em] text-slate-500 dark:text-white/38">Online · no sign-up needed</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={onMinimize}
            className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 cursor-pointer dark:text-white/48 dark:hover:bg-white/6 dark:hover:text-white/75"
            aria-label="Minimise"
          >
            <Minus className="h-4 w-4" />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 cursor-pointer dark:text-white/48 dark:hover:bg-white/6 dark:hover:text-white/75"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </motion.button>
        </div>
      </div>

      {/* Status bar */}
      <div className="relative shrink-0 border-b border-amber-200/70 bg-amber-50/80 px-5 py-3 dark:border-white/8 dark:bg-amber-300/6">
        <span className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-white/56">
          Ask about Beta access, ELITE plan or
          <Link href="/sign-up" className="font-bold text-amber-600 transition-colors hover:text-amber-500 dark:text-amber-100 dark:hover:text-white">
            sign up free →
          </Link>
        </span>
      </div>

      {/* Messages area */}
      <div className="relative flex-1 min-h-0 space-y-4 overflow-y-auto bg-transparent p-5 scroll-smooth">
        {/* Welcome back banner */}
        {hasHistory && showQuickReplies && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-2 rounded-[1.35rem] border border-slate-200/80 bg-slate-50/90 px-3 py-2 text-center dark:border-white/8 dark:bg-white/3"
          >
            <p className="text-xs text-slate-500 dark:text-white/46">
              Welcome back! Myra remembers your conversation.
            </p>
          </motion.div>
        )}

        {/* Empty state + quick replies */}
        <AnimatePresence>
          {showQuickReplies && (
            <motion.div
              key="quick-replies"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0, transition: { ...SPRING, delay: 0.05 } }}
              exit={{ opacity: 0, transition: { duration: 0.12 } }}
              className="space-y-6 pt-2"
            >
              <div className="space-y-3 text-center">
                <motion.div
                  className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full border border-amber-300/30 bg-amber-50 text-amber-500 shadow-[0_10px_30px_rgba(245,158,11,0.12)] dark:border-amber-300/18 dark:bg-amber-300/8 dark:text-amber-200 dark:shadow-[0_10px_30px_rgba(245,158,11,0.08)]"
                  animate={{ scale: [1, 1.06, 1] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                >
                  <Sparkles className="h-8 w-8" />
                </motion.div>
                <p className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">Hi! I am Myra.</p>
                <p className="px-4 text-sm font-medium leading-relaxed text-slate-500 dark:text-white/52">
                  I&apos;m Lyra&apos;s companion for platform support. I can explain how the Beta works, what ELITE access includes, which assets are covered and how LyraAlpha works.
                </p>
                <p className="pt-1 text-sm font-medium text-amber-600 dark:text-amber-300">
                  How may I help you today?
                </p>
              </div>
              <div className="grid grid-cols-1 gap-2.5">
                {QUICK_REPLIES.map((qr, i) => (
                  <motion.button
                    key={qr}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0, transition: { ...SPRING, delay: 0.08 + i * 0.04 } }}
                    whileHover={{ scale: 1.02, transition: { duration: 0.12 } }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => sendMessage(qr)}
                    className="rounded-[1.35rem] border border-slate-200/80 bg-white/90 p-3 text-left text-sm text-slate-600 transition-all duration-300 hover:-translate-y-0.5 hover:border-amber-300/40 hover:bg-amber-50 hover:text-slate-900 cursor-pointer dark:border-white/8 dark:bg-white/2.5 dark:text-white/72 dark:hover:border-amber-300/18 dark:hover:bg-amber-300/[0.07] dark:hover:text-white"
                  >
                    {qr}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Message list */}
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              variants={BUBBLE_VARIANTS}
              initial="hidden"
              animate="visible"
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[84%] rounded-[1.35rem] px-3.5 py-3 text-sm ${
                  msg.role === "user"
                    ? "rounded-br-sm border border-amber-300/40 bg-amber-50 text-slate-900 dark:border-amber-300/24 dark:bg-amber-300/12 dark:text-white"
                    : "rounded-bl-sm border border-slate-200/80 bg-white/92 text-slate-700 dark:border-white/8 dark:bg-white/3 dark:text-white/82"
                }`}
              >
                {msg.role === "assistant" && (
                  <span className="mb-1 flex items-center gap-1 text-[10px] font-medium uppercase tracking-[0.22em] text-amber-600 dark:text-amber-200/70">
                    <Sparkles className="w-2.5 h-2.5" />
                    Myra
                  </span>
                )}
                <p className="leading-relaxed">{renderContent(msg.content)}</p>
                <span className="mt-1 block text-[10px] text-slate-400 dark:text-white/28">
                  {formatTime(msg.createdAt)}
                </span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Streaming bubble — no exit animation to avoid flicker on commit */}
        {streamingText ? (
          <motion.div
            key="streaming-bubble"
            variants={BUBBLE_VARIANTS}
            initial="hidden"
            animate="visible"
            className="flex justify-start"
          >
            <div className="max-w-[84%] rounded-[1.35rem] rounded-bl-sm border border-slate-200/80 bg-white/92 px-3.5 py-3 text-sm text-slate-700 dark:border-white/8 dark:bg-white/3 dark:text-white/82">
              <span className="mb-1 flex items-center gap-1 text-[10px] font-medium uppercase tracking-[0.22em] text-amber-600 dark:text-amber-200/70">
                <Sparkles className="w-2.5 h-2.5" />
                Myra
              </span>
              <p className="leading-relaxed inline">
                {renderedStreaming}
                <StreamingCursor />
              </p>
            </div>
          </motion.div>
        ) : null}

        {/* Typing indicator — only before first token */}
        <AnimatePresence>
          {isTyping && !streamingText && (
            <motion.div
              key="typing"
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1, transition: SPRING }}
              exit={{ opacity: 0, scale: 0.92, transition: { duration: 0.12 } }}
              className="flex justify-start"
            >
              <div className="flex items-center gap-2 rounded-[1.35rem] rounded-bl-sm border border-slate-200/80 bg-white/92 px-3 py-2.5 dark:border-white/8 dark:bg-white/3">
                <Sparkles className="h-3 w-3 text-amber-600 dark:text-amber-200/70" />
                <span className="text-[10px] uppercase tracking-[0.22em] text-slate-400 dark:text-white/42">Myra is typing</span>
                <TypingDots />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="relative shrink-0 border-t border-slate-200/80 bg-slate-50/90 p-3 dark:border-white/8 dark:bg-black/18">
        {sendError && (
          <div className="mb-2 flex items-center gap-2 rounded-xl bg-red-500/10 px-3 py-2">
            <p className="flex-1 text-xs font-medium text-red-500 dark:text-red-400">
              {sendError}
            </p>
            {lastFailedInput && (
              <button
                onClick={handleRetry}
                className="inline-flex items-center gap-1 rounded-lg bg-red-500/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-red-600 transition-colors hover:bg-red-500/25 dark:text-red-300 dark:hover:bg-red-400/20"
              >
                <RotateCcw className="h-2.5 w-2.5" />
                Retry
              </button>
            )}
          </div>
        )}
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Ask about Beta access, ELITE plan or coverage..."
            disabled={sending}
            className="flex-1 rounded-full border border-slate-200/80 bg-white px-4 py-3 text-sm text-slate-900 transition-all placeholder:text-slate-400 focus:border-amber-300/50 focus:outline-none focus:ring-1 focus:ring-amber-300/18 disabled:opacity-60 disabled:cursor-not-allowed dark:border-white/10 dark:bg-white/3 dark:text-white dark:placeholder:text-white/28 dark:focus:border-amber-300/28"
          />
          <motion.button
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => sendMessage()}
            disabled={!input.trim() || sending}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-400 text-slate-950 shadow-[0_10px_30px_rgba(245,158,11,0.22)] transition-all hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
            aria-label="Send message"
          >
            <Send className="h-4 w-4" />
          </motion.button>
        </div>
        <div className="mt-2 flex items-center justify-center">
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200/80 bg-white/90 px-3 py-1 text-[10px] uppercase tracking-[0.24em] text-slate-400 dark:border-white/8 dark:bg-white/3 dark:text-white/46">
            <Sparkles className="h-2.5 w-2.5 text-amber-600 dark:text-amber-200/70" />
            Beta users get free ELITE access with 300 credits
          </span>
        </div>
      </div>
    </motion.div>
  );
}
