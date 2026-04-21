"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Minus, Sparkles, MessageCircle, Mic, Volume2, AlertCircle } from "lucide-react";
import { renderContent } from "@/components/shared/chat-markdown-renderer";
import { useMyraVoice, type VoiceTranscript } from "@/hooks/use-myra-voice";
import { MyraVoiceButton } from "@/components/dashboard/myra-voice-button";
import { supabaseRealtime } from "@/lib/supabase-realtime";
import { createClientLogger } from "@/lib/logger/client";
import {
  createSupportConversation,
  fetchSupportConversation,
  saveSupportMessage,
  streamSupportReply,
  type SupportConversation as Conversation,
  type SupportMessage as Message,
} from "@/lib/support-chat-client";

interface LiveChatWidgetProps {
  onClose: () => void;
  onUnread: () => void;
}

const QUICK_REPLIES = [
  "How do credits work?",
  "How do I use Lyra Intel?",
  "I found a bug",
];

// Shared spring config — snappy but not bouncy
const SPRING = { type: "spring" as const, stiffness: 420, damping: 36, mass: 0.8 };
// Bubble entry — fast slide-up fade
const BUBBLE_VARIANTS = {
  hidden: { opacity: 0, y: 8, scale: 0.97 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { ...SPRING } },
};

function isAiMessage(msg: Message): boolean {
  return msg.senderRole === "AGENT" && msg.senderId === "AI_ASSISTANT";
}


// renderInline and renderContent are now imported from @/components/shared/chat-markdown-renderer
// Re-export for backward compatibility with existing test imports
export { renderInline, renderContent } from "@/components/shared/chat-markdown-renderer";

// Smooth typing dots using Framer Motion
function TypingDots() {
  return (
    <span className="flex gap-1 items-center">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-muted dark:bg-white/45"
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

export function LiveChatWidget({ onClose, onUnread }: LiveChatWidgetProps) {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [voiceMessages, setVoiceMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isStreamingRef = useRef(false);
  const conversationRef = useRef<Conversation | null>(null);
  const isMinimizedRef = useRef(isMinimized);
  const abortRef = useRef<AbortController | null>(null);
  const sendingRef = useRef(false);
  // Throttle scroll during streaming — only scroll every ~120ms
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { isMinimizedRef.current = isMinimized; }, [isMinimized]);

  const handleVoiceTranscript = useCallback((t: VoiceTranscript) => {
    const voiceMsg: Message = {
      id: `voice-${t.id}`,
      senderId: t.role === "user" ? "user_voice" : "AI_VOICE",
      senderRole: t.role === "user" ? "USER" : "AGENT",
      content: t.text,
      createdAt: new Date().toISOString(),
    };
    setVoiceMessages((prev) => [...prev, voiceMsg]);
    if (isMinimizedRef.current) onUnread();
  }, [onUnread]);

  const { state: voiceState, startVoice, stopVoice, prefetchSession, errorMessage: voiceError, isThinking: voiceThinking, isSpeaking: voiceSpeaking, silenceCountdown, keepAlive, micLevel } = useMyraVoice({
    onTranscript: handleVoiceTranscript,
  });

  // Pre-warm session token on widget mount — eliminates 2-3s API latency on first mic click
  useEffect(() => { prefetchSession(); }, [prefetchSession]);

  useEffect(() => {
    conversationRef.current = conversation;
  }, [conversation]);

  useEffect(() => {
    setVoiceMessages([]);
    setIsAiTyping(false);
    setStreamingText("");
    isStreamingRef.current = false;
  }, [conversation?.id]);

  useEffect(() => {
    const controller = abortRef;
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      controller.current?.abort();
    };
  }, []);

  const allMessages = useMemo(() => {
    // O(n) merge of two already-chronological arrays instead of O(n log n) sort.
    // Both conversation.messages and voiceMessages are append-only so they are
    // already in ascending createdAt order — a simple merge is exact and cheaper.
    const a = conversation?.messages ?? [];
    const b = voiceMessages;
    if (a.length === 0) return b;
    if (b.length === 0) return a;
    const result: typeof a = [];
    let i = 0, j = 0;
    while (i < a.length && j < b.length) {
      if (new Date(a[i].createdAt).getTime() <= new Date(b[j].createdAt).getTime()) {
        result.push(a[i++]);
      } else {
        result.push(b[j++]);
      }
    }
    while (i < a.length) result.push(a[i++]);
    while (j < b.length) result.push(b[j++]);
    return result;
  }, [conversation?.messages, voiceMessages]);

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

  const fetchConversation = useCallback(async () => {
    try {
      const data = await fetchSupportConversation();
      if (data) {
        setConversation(data);
      }
    } catch (err) {
      createClientLogger("live-chat").warn("Failed to fetch conversation", { err: String(err) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConversation();
  }, [fetchConversation]);

  useEffect(() => {
    const realtime = supabaseRealtime;
    if (!conversation?.id || !realtime) return;
    const channel = realtime
      .channel(`support:${conversation.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "SupportMessage",
          filter: `conversationId=eq.${conversation.id}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          // Skip AI messages while streaming — committed locally after stream ends
          if (newMsg.senderRole === "AGENT" && isStreamingRef.current) return;
          setIsAiTyping(false);
          setConversation((prev) =>
            prev
              ? {
                  ...prev,
                  messages: prev.messages.some((m) => m.id === newMsg.id)
                    ? prev.messages
                    : [...prev.messages, newMsg],
                }
              : prev
          );
          if (newMsg.senderRole === "AGENT" && isMinimized) onUnread();
        }
      )
      .subscribe();

    return () => { realtime.removeChannel(channel); };
  }, [conversation?.id, isMinimized, onUnread]);

  // Scroll when messages list changes (new message committed)
  useEffect(() => {
    scrollToBottom();
  }, [allMessages.length, scrollToBottom]);

  // Scroll during streaming — throttled via scrollToBottom
  useEffect(() => {
    if (streamingText) scrollToBottom();
  }, [streamingText, scrollToBottom]);

  // Scroll when typing indicator appears
  useEffect(() => {
    if (isAiTyping) scrollToBottom();
  }, [isAiTyping, scrollToBottom]);

  // Tick every 60s so relative timestamps ("5m ago") stay fresh
  const [nowTick, setNowTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setNowTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const formatTime = useCallback((dateStr: string) => {
    // nowTick is referenced to bust the memo cache; Date.now() gives actual time
    void nowTick;
    const date = new Date(dateStr);
    const diffMs = Date.now() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }, [nowTick]);

  const sendMessage = useCallback(async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || sending || sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    setSendError(null);
    setInput("");

    let currentConv = conversationRef.current;

    // Fast-path: Create conversation if missing before applying optimistic UI
    if (!currentConv || !currentConv.id) {
      try {
        const createdConversation = await createSupportConversation();
        if (createdConversation) {
          currentConv = createdConversation;
          setConversation(createdConversation);
        } else {
          sendingRef.current = false;
          setSending(false);
          return;
        }
      } catch (err) {
        createClientLogger("live-chat").warn("Failed to create conversation", { err: String(err) });
        sendingRef.current = false;
        setSending(false);
        return;
      }
    }

    // Optimistically render user message immediately
    const tempUserMsg: Message = {
      id: `temp-${Date.now()}`,
      senderId: "user",
      senderRole: "USER",
      content,
      createdAt: new Date().toISOString(),
    };
    
    setConversation((prev) => 
      prev 
        ? { ...prev, messages: [...prev.messages, tempUserMsg] } 
        : { ...currentConv!, messages: [tempUserMsg] }
    );

    let convId = currentConv!.id;

    try {
      // 1. Save user message to DB and replace temp optimistic msg with real one
      const saveRes = await saveSupportMessage(convId, content);

      if (saveRes.status === 404) {
        // Fallback: the conversation was just deleted, try to recreate
        const freshConv = await createSupportConversation();
        if (freshConv?.id) convId = freshConv.id;
        await saveSupportMessage(convId, content);
      } else if (saveRes.ok) {
        const savedMsg: Message = await saveRes.json();
        setConversation((prev) =>
          prev
            ? { ...prev, messages: prev.messages.map((m) => m.id === tempUserMsg.id ? savedMsg : m) }
            : prev
        );
      }

      // 2. Stream AI reply — show tokens as they arrive
      isStreamingRef.current = true;
      setIsAiTyping(true);
      setStreamingText("");
      abortRef.current?.abort();
      const streamAbort = new AbortController();
      abortRef.current = streamAbort;

      try {
        const accumulated = await streamSupportReply(convId, content, setStreamingText, streamAbort.signal);

        if (!accumulated) {
          setIsAiTyping(false);
          setStreamingText("");
          return;
        }

        // Commit completed reply — clear streaming text first to avoid flicker
        setStreamingText("");
        {
          const aiMsg: Message = {
            id: `stream-${Date.now()}`,
            senderId: "AI_ASSISTANT",
            senderRole: "AGENT",
            content: accumulated,
            createdAt: new Date().toISOString(),
          };
          setConversation((prev) =>
            prev ? { ...prev, messages: [...prev.messages, aiMsg] } : prev
          );
        }
        setIsAiTyping(false);
        if (isMinimized) onUnread();
      } finally {
        isStreamingRef.current = false;
      }
    } catch (err) {
      createClientLogger("live-chat").warn("Send failed", { err: String(err) });
      setIsAiTyping(false);
      setStreamingText("");
      isStreamingRef.current = false;
      setSendError("Message failed to send — please try again.");
    } finally {
      sendingRef.current = false;
      setSending(false);
      inputRef.current?.focus();
    }
  }, [input, sending, isMinimized, onUnread]);

  const showQuickReplies = !loading && allMessages.length === 0;
  const hasHistory = !loading && allMessages.length > 0;
  const cardClass = "relative overflow-hidden rounded-4xl border border-border/80 bg-white/96 shadow-[0_30px_90px_rgba(15,23,42,0.16)] backdrop-blur-2xl dark:border-white/10 dark:bg-[#07111f]/96 dark:shadow-[0_30px_90px_rgba(0,0,0,0.48)]";
  const launcherClassName = "group relative flex h-16 w-16 items-center justify-center rounded-full border border-cyan-400/40 bg-white text-cyan-400 shadow-[0_16px_48px_rgba(0,212,255,0.16)] transition-all duration-300 hover:-translate-y-1 hover:border-cyan-400/60 hover:bg-primary/5 dark:border-cyan-400/30 dark:bg-[#0b1322] dark:text-primary/60 dark:shadow-[0_16px_48px_rgba(0,0,0,0.42)] dark:hover:border-cyan-400/45 dark:hover:bg-[#0f182b]";

  // ─── Minimized bubble ───
  if (isMinimized) {
    return (
      <motion.button
        initial={{ opacity: 0, scale: 0.7 }}
        animate={{ opacity: 1, scale: 1, transition: SPRING }}
        exit={{ opacity: 0, scale: 0.7, transition: { duration: 0.15 } }}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.93 }}
        onClick={() => setIsMinimized(false)}
        className={launcherClassName}
        aria-label="Open Myra support chat"
      >
        <span className="absolute inset-1 rounded-full bg-[radial-gradient(circle,rgba(0,212,255,0.24),rgba(0,212,255,0.02)_68%,transparent)] blur-md transition-opacity duration-300 group-hover:opacity-100 dark:bg-[radial-gradient(circle,rgba(0,212,255,0.22),rgba(0,212,255,0.02)_68%,transparent)]" />
        <MessageCircle className="relative z-10 h-7 w-7" />
        <span className="absolute inset-0 rounded-full border border-cyan-400/18" />
      </motion.button>
    );
  }

  // ─── Loading skeleton ───
  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1, transition: SPRING }}
        exit={{ opacity: 0, y: 12, scale: 0.96, transition: { duration: 0.15 } }}
        className={`w-[calc(100vw-1.5rem)] sm:w-[410px] h-[min(640px,calc(100dvh-3rem))] ${cardClass} flex items-center justify-center`}
      >
        <div className="flex flex-col items-center gap-3">
          <motion.div
            className="flex h-11 w-11 items-center justify-center rounded-full border border-cyan-400/18 bg-cyan-400/10 text-primary/60 shadow-inner"
            animate={{ scale: [1, 1.08, 1] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
          >
            <Sparkles className="h-5 w-5" />
          </motion.div>
          <span className="text-sm text-muted-foreground dark:text-white/42">Connecting to Myra…</span>
        </div>
      </motion.div>
    );
  }

  // ─── Full chat widget ───
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1, transition: SPRING }}
      exit={{ opacity: 0, y: 12, scale: 0.96, transition: { duration: 0.15 } }}
      className={`w-[calc(100vw-1.5rem)] sm:w-[410px] flex flex-col overflow-hidden ${cardClass}`}
      style={{ height: "min(640px, calc(100dvh - 3rem))" }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.65),transparent_22%,transparent_78%,rgba(0,212,255,0.08))] dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.04),transparent_22%,transparent_78%,rgba(0,212,255,0.06))]" />
      {/* Header */}
      <div className="relative flex shrink-0 items-center justify-between border-b border-border/80 px-5 py-4 dark:border-white/8">
        <div className="flex items-center gap-3">
          <div className="relative flex h-11 w-11 items-center justify-center rounded-full border border-cyan-400/30 bg-primary/5 text-cyan-400 shadow-inner dark:border-cyan-400/18 dark:bg-cyan-400/10 dark:text-primary/60">
            <Sparkles className="h-5 w-5" />
            <span className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-white bg-success dark:border-[#07111f]" />
          </div>
          <div>
            <div className="mb-1 flex items-center gap-2">
              <span className="text-base font-bold tracking-tight text-foreground dark:text-white">Myra</span>
              <span className="rounded-full border border-cyan-400/30 bg-primary/5 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.28em] text-primary dark:border-cyan-400/18 dark:bg-cyan-400/10 dark:text-primary/75">
                AI
              </span>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-[0.28em] text-muted-foreground dark:text-white/38">Online · replies instantly</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setIsMinimized(true)}
            className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground cursor-pointer dark:text-white/48 dark:hover:bg-white/6 dark:hover:text-white/75"
            aria-label="Minimise"
          >
            <Minus className="h-4 w-4" />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={onClose}
            className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground cursor-pointer dark:text-white/48 dark:hover:bg-white/6 dark:hover:text-white/75"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </motion.button>
        </div>
      </div>

      {/* Status bar */}
      <div className="relative shrink-0 border-b border-primary/70 bg-primary/80 px-5 py-3 dark:border-white/8 dark:bg-cyan-400/10">
        <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground dark:text-white/56">
          Financial questions? Use{" "}
          <a href="/dashboard/lyra" className="font-bold text-primary transition-colors hover:text-cyan-400 dark:text-primary/60 dark:hover:text-white">
            Lyra Intel →
          </a>
        </span>
      </div>

      {/* Messages area */}
      <div className="relative flex-1 min-h-0 space-y-4 overflow-y-auto bg-transparent p-5 scroll-smooth">
        {/* Welcome back banner */}
        {hasHistory && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-2 rounded-[1.35rem] border border-border/80 bg-muted/90 px-3 py-2 text-center dark:border-white/8 dark:bg-white/3"
          >
            <p className="text-xs text-muted-foreground dark:text-white/46">
              Welcome back! Myra remembers your previous conversation.
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
                  className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full border border-cyan-400/30 bg-primary/5 text-cyan-400 shadow-[0_10px_30px_rgba(0,212,255,0.12)] dark:border-cyan-400/18 dark:bg-cyan-400/10 dark:text-primary/60 dark:shadow-[0_10px_30px_rgba(0,212,255,0.08)]"
                  animate={{ scale: [1, 1.06, 1] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                >
                  <Sparkles className="h-8 w-8" />
                </motion.div>
                <p className="text-lg font-bold tracking-tight text-foreground dark:text-white">Hi! I am Myra.</p>
                <p className="px-4 text-sm font-medium leading-relaxed text-muted-foreground dark:text-white/52">
                  I&apos;m Lyra&apos;s companion for platform support. I can help you navigate LyraAlpha AI and answer your questions.
                </p>
                <p className="pt-1 text-sm font-medium text-primary dark:text-cyan-400">
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
                    className="rounded-[1.35rem] border border-border/80 bg-white/90 p-3 text-left text-sm text-foreground transition-all duration-300 hover:-translate-y-0.5 hover:border-cyan-400/40 hover:bg-primary/5 hover:text-foreground cursor-pointer dark:border-white/8 dark:bg-white/2.5 dark:text-white/72 dark:hover:border-cyan-400/18 dark:hover:bg-cyan-400/10 dark:hover:text-white"
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
          {allMessages.map((msg) => (
            <motion.div
              key={msg.id}
              variants={BUBBLE_VARIANTS}
              initial="hidden"
              animate="visible"
              className={`flex ${msg.senderRole === "USER" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[84%] rounded-[1.35rem] px-3.5 py-3 text-sm ${
                  msg.senderRole === "USER"
                    ? "rounded-br-sm border border-cyan-400/40 bg-primary/5 text-foreground dark:border-cyan-400/24 dark:bg-cyan-400/10 dark:text-white"
                    : "rounded-bl-sm border border-border/80 bg-white/92 text-foreground dark:border-white/8 dark:bg-white/3 dark:text-white/82"
                }`}
              >
                {isAiMessage(msg) && (
                  <span className="mb-1 flex items-center gap-1 text-[10px] font-medium uppercase tracking-[0.22em] text-primary dark:text-primary/70">
                    <Sparkles className="w-2.5 h-2.5" />
                    Myra
                  </span>
                )}
                {msg.senderId === "AI_VOICE" && (
                  <span className="mb-1 flex items-center gap-1 text-[10px] font-medium uppercase tracking-[0.22em] text-primary dark:text-primary/70">
                    <Sparkles className="w-2.5 h-2.5" />
                    Myra
                    <span className="ml-1 rounded-full border border-cyan-400/40 bg-primary/5 px-1.5 py-px text-[8px] font-bold uppercase tracking-[0.2em] text-primary dark:border-cyan-400/22 dark:bg-cyan-400/10 dark:text-primary/80">
                      Voice
                    </span>
                  </span>
                )}
                {msg.senderId === "user_voice" && (
                  <span className="mb-1 flex items-center gap-1 text-[10px] font-medium uppercase tracking-[0.22em] text-primary dark:text-primary/60">
                    <Mic className="w-2.5 h-2.5" />
                    You
                  </span>
                )}
                <p className="leading-relaxed">{renderContent(msg.content)}</p>
                <span className="mt-1 block text-[10px] text-muted-foreground dark:text-white/28">
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
            <div className="max-w-[84%] rounded-[1.35rem] rounded-bl-sm border border-border/80 bg-white/92 px-3.5 py-3 text-sm text-foreground dark:border-white/8 dark:bg-white/3 dark:text-white/82">
              <span className="mb-1 flex items-center gap-1 text-[10px] font-medium uppercase tracking-[0.22em] text-primary dark:text-primary/70">
                <Sparkles className="w-2.5 h-2.5" />
                Myra
              </span>
              <p className="leading-relaxed">{renderContent(streamingText)}</p>
            </div>
          </motion.div>
        ) : null}

        {/* Typing indicator — only before first token */}
        <AnimatePresence>
          {isAiTyping && !streamingText && (
            <motion.div
              key="typing"
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1, transition: SPRING }}
              exit={{ opacity: 0, scale: 0.92, transition: { duration: 0.12 } }}
              className="flex justify-start"
            >
              <div className="flex items-center gap-2 rounded-[1.35rem] rounded-bl-sm border border-border/80 bg-white/92 px-3 py-2.5 dark:border-white/8 dark:bg-white/3">
                <Sparkles className="h-3 w-3 text-primary dark:text-primary/70" />
                <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground dark:text-white/42">Myra is typing</span>
                <TypingDots />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Voice thinking indicator — Myra is generating a response but hasn't started speaking yet */}
        <AnimatePresence>
          {voiceThinking && voiceState === "active" && (
            <motion.div
              key="voice-thinking"
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1, transition: SPRING }}
              exit={{ opacity: 0, scale: 0.92, transition: { duration: 0.12 } }}
              className="flex justify-start"
            >
              <div className="flex items-center gap-2 rounded-[1.35rem] rounded-bl-sm border border-cyan-400/40 bg-primary/90 px-3 py-2.5 dark:border-cyan-400/22 dark:bg-cyan-400/10">
                <Sparkles className="h-3 w-3 text-primary dark:text-primary/70" />
                <span className="text-[10px] uppercase tracking-[0.22em] text-primary dark:text-primary/80">Myra is thinking</span>
                <TypingDots />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Voice speaking indicator — Myra's audio is actively playing */}
        <AnimatePresence>
          {voiceSpeaking && voiceState === "active" && (
            <motion.div
              key="voice-speaking"
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1, transition: SPRING }}
              exit={{ opacity: 0, scale: 0.92, transition: { duration: 0.12 } }}
              className="flex justify-start"
            >
              <div className="flex items-center gap-2 rounded-[1.35rem] rounded-bl-sm border border-cyan-400/40 bg-primary/90 px-3 py-2.5 dark:border-cyan-400/22 dark:bg-cyan-400/10">
                <Volume2 className="h-3 w-3 text-primary dark:text-primary/70" />
                <span className="flex items-center gap-1 text-[10px] uppercase tracking-[0.22em] text-primary dark:text-primary/80">
                  Myra is speaking
                  <span className="flex items-end gap-px">
                    {[0.4, 1, 0.65, 1, 0.4].map((h, i) => (
                      <motion.span
                        key={i}
                        className="w-[2px] rounded-full bg-cyan-400 dark:bg-primary/80"
                        style={{ height: 3 }}
                        animate={{ scaleY: [h, 1, h * 0.5, 1, h] }}
                        transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.08, ease: "easeInOut" }}
                      />
                    ))}
                  </span>
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Voice connecting state in chat area */}
        <AnimatePresence>
          {voiceState === "connecting" && (
            <motion.div
              key="voice-connecting"
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1, transition: SPRING }}
              exit={{ opacity: 0, scale: 0.92, transition: { duration: 0.12 } }}
              className="flex justify-start"
            >
              <div className="flex items-center gap-2 rounded-[1.35rem] rounded-bl-sm border border-warning/40 bg-primary/90 px-3 py-2.5 dark:border-warning/22 dark:bg-warning29462">
                <motion.span
                  animate={{ scale: [1, 1.2, 1], opacity: [0.7, 1, 0.7] }}
                  transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
                >
                  <Mic className="h-3 w-3 text-primary dark:text-primary/70" />
                </motion.span>
                <span className="text-[10px] uppercase tracking-[0.22em] text-primary dark:text-primary/80">Connecting voice…</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="relative shrink-0 border-t border-border/80 bg-muted/90 p-3 dark:border-white/8 dark:bg-black/18">
        {sendError && (
          <p className="mb-2 rounded-xl bg-danger/10 px-3 py-2 text-xs font-medium text-danger dark:text-danger">
            {sendError}
          </p>
        )}
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
            placeholder={voiceState === "active" ? "Type or speak…" : "Ask Myra anything..."}
            disabled={sending}
            className="flex-1 rounded-full border border-border/80 bg-white px-4 py-3 text-sm text-foreground transition-all placeholder:text-muted-foreground focus:border-warning/50 focus:outline-none focus:ring-1 focus:ring-warning/18 disabled:opacity-80 dark:border-white/10 dark:bg-white/3 dark:text-white dark:placeholder:text-white/28 dark:focus:border-warning/28"
          />
          <MyraVoiceButton
            state={voiceState}
            onStart={startVoice}
            onStop={stopVoice}
            disabled={sending}
          />
          <motion.button
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => sendMessage()}
            disabled={!input.trim() || sending}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-warning text-foreground shadow-[0_10px_30px_rgba(245,158,11,0.22)] transition-all hover:bg-warning31734 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
          >
            <Send className="h-4 w-4" />
          </motion.button>
        </div>
        <div className="mt-2 flex items-center justify-center gap-2">
          {voiceState === "active" ? (
            <>
              {silenceCountdown !== null && silenceCountdown <= 10 ? (
                <button
                  onClick={keepAlive}
                  className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/60 bg-cyan-400/5 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-cyan-400 transition-colors hover:bg-cyan-400/10 dark:border-cyan-400/30 dark:bg-cyan-400/10 dark:text-cyan-400 dark:hover:bg-cyan-400/18"
                >
                  <AlertCircle className="h-2.5 w-2.5" />
                  Ending in {silenceCountdown}s — tap to continue
                </button>
              ) : voiceThinking ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-cyan-400/40 bg-primary/5 px-3 py-1 text-[10px] uppercase tracking-[0.24em] text-primary dark:border-cyan-400/22 dark:bg-cyan-400/10 dark:text-primary/80">
                  <Sparkles className="h-2.5 w-2.5" />
                  Thinking…
                </span>
              ) : voiceSpeaking ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-cyan-400/40 bg-primary/5 px-3 py-1 text-[10px] uppercase tracking-[0.24em] text-primary dark:border-cyan-400/22 dark:bg-cyan-400/10 dark:text-primary/80">
                  <Volume2 className="h-2.5 w-2.5" />
                  Speaking…
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/40 bg-primary/5 px-3 py-1 text-[10px] uppercase tracking-[0.24em] text-primary dark:border-cyan-400/22 dark:bg-cyan-400/10 dark:text-primary/80">
                  <Mic className="h-2.5 w-2.5" />
                  Listening
                  {micLevel > 0.05 && (
                    <span className="ml-0.5 flex items-end gap-px">
                      {[0.3, 0.6, 1, 0.6, 0.3].map((h, i) => (
                        <motion.span
                          key={i}
                          className="w-[2px] rounded-full bg-cyan-400 dark:bg-primary/80"
                          style={{ height: 3 }}
                          animate={{ scaleY: micLevel > 0.1 ? [h * micLevel, micLevel, h * micLevel] : [0.2, 0.3, 0.2] }}
                          transition={{ duration: 0.3, repeat: Infinity, delay: i * 0.04, ease: "easeInOut" }}
                        />
                      ))}
                    </span>
                  )}
                </span>
              )}
            </>
          ) : voiceState === "connecting" ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-warning/40 bg-primary/5 px-3 py-1 text-[10px] uppercase tracking-[0.24em] text-primary dark:border-warning/22 dark:bg-warning34808 dark:text-primary/80">
              <motion.span animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 0.8, repeat: Infinity }}>
                <Mic className="h-2.5 w-2.5" />
              </motion.span>
              Connecting…
            </span>
          ) : voiceError && voiceState === "error" ? (
            <span
              title={voiceError}
              className="inline-flex items-center gap-1 rounded-full border border-danger/50 bg-danger/5 px-3 py-1 text-[10px] text-danger dark:border-danger/28 dark:bg-danger/8 dark:text-danger max-w-[260px] truncate"
            >
              {voiceError.length > 60 ? voiceError.slice(0, 60) + "…" : voiceError}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full border border-border/80 bg-white/90 px-3 py-1 text-[10px] uppercase tracking-[0.24em] text-muted-foreground dark:border-white/8 dark:bg-white/3 dark:text-white/46">
              <Sparkles className="h-2.5 w-2.5 text-primary dark:text-primary/70" />
              Transcribes only English, Hinglish, Hindi
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}
