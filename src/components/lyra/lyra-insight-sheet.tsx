"use client";

import { useEffect, useRef, useState, useCallback, memo } from "react";
import dynamic from "next/dynamic";
import { mutate as swrMutate } from "swr";
import {
  Sparkles,
  AlertTriangle,
  X,
  Copy,
  Check,
  Send,
  Bot,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { applyOptimisticCreditDelta, revalidateCreditViews, setAuthoritativeCreditBalance } from "@/lib/credits/client";
import { parseLyraMessage, Source } from "@/lib/lyra-utils";
import { formatConversationAsText, copyToClipboard } from "@/lib/export-utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

const AnswerWithSources = dynamic(
  () => import("@/components/lyra/answer-with-sources").then((m) => m.AnswerWithSources),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-3 p-1">
        <div className="h-3.5 w-4/5 rounded-xl bg-muted/30 animate-pulse" />
        <div className="h-3.5 w-3/5 rounded-xl bg-muted/25 animate-pulse" />
        <div className="h-3.5 w-2/3 rounded-xl bg-muted/20 animate-pulse" />
      </div>
    ),
  },
);

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  relatedQuestions?: string[];
}

interface LyraInsightSheetProps {
  open: boolean;
  onClose: () => void;
  symbol: string;
  assetName?: string;
  contextData: Record<string, unknown>;
  initialQuery?: string;
  initialDisplayQuery?: string;
  sourcesLimit?: number;
}

const FOLLOW_UP_SUGGESTIONS = [
  "What's the bull vs bear case right now?",
  "What are the key risks to watch?",
  "How does this compare to sector peers?",
];

const ChatMessageItem = memo(function ChatMessageItem({
  message,
  onSuggestionClick,
}: {
  message: Message;
  onSuggestionClick: (q: string) => void;
}) {
  const { text, sources, relatedQuestions } =
    message.role === "assistant"
      ? parseLyraMessage(message.content)
      : { text: message.content, sources: [] as Source[], relatedQuestions: [] as string[] };

  return (
    <div
      className={cn(
        "flex w-full flex-col gap-1.5 text-sm animate-in fade-in slide-in-from-bottom-2 duration-300 overflow-x-hidden",
        message.role === "user" ? "items-end" : "items-start w-full min-w-0",
      )}
    >
      <div className={cn("flex items-center gap-1.5 shrink-0", message.role === "user" ? "flex-row-reverse" : "")}>
        {message.role === "assistant" ? (
          <>
            <div className="p-1 rounded-lg bg-primary/10 border border-primary/20">
              <Sparkles className="h-2.5 w-2.5 text-primary" />
            </div>
            <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60">
              Lyra
            </span>
          </>
        ) : (
          <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60">
            You
          </span>
        )}
      </div>

      {message.role === "user" ? (
        <div className="bg-primary text-black px-4 py-3 rounded-2xl rounded-tr-none shadow-lg shadow-primary/15 max-w-[88%]">
          <p className="whitespace-pre-wrap font-bold text-xs leading-relaxed tracking-tight">
            {text}
          </p>
        </div>
      ) : (
        <div className="w-full min-w-0 rounded-2xl rounded-tl-none overflow-hidden">
          <AnswerWithSources
            content={text}
            sources={sources}
            relatedQuestions={message.relatedQuestions?.length ? message.relatedQuestions : relatedQuestions}
            onRelatedQuestionClick={onSuggestionClick}
            className="bg-transparent border-none shadow-none w-full min-w-0 p-0"
            showSources={true}
          />
        </div>
      )}
    </div>
  );
});

function CopyButton({ messages }: { messages: Message[] }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    const text = formatConversationAsText(messages);
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };
  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-muted-foreground/50 hover:text-primary transition-colors cursor-pointer"
    >
      {copied ? <Check className="h-2.5 w-2.5" /> : <Copy className="h-2.5 w-2.5" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export function LyraInsightSheet({
  open,
  onClose,
  symbol,
  assetName,
  contextData,
  initialQuery,
  initialDisplayQuery,
  sourcesLimit,
}: LyraInsightSheetProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const userHasScrolledUp = useRef(false);
  const hasFiredInitial = useRef(false);
  const [localInput, setLocalInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesRef = useRef<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isNearBottom = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  }, []);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const handleScroll = () => {
      userHasScrolledUp.current = !isNearBottom();
    };
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [isNearBottom]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    if (messages.length === 0 && !isLoading) return;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg?.role === "user") userHasScrolledUp.current = false;
    if (userHasScrolledUp.current) return;
    const id = requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: isLoading ? "auto" : "smooth", block: "end" });
    });
    return () => cancelAnimationFrame(id);
  }, [messages, isLoading]);

  const sendMessage = useCallback(async (content: string, displayText?: string) => {
    if (!content.trim() || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: displayText?.trim() || content.trim(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);
    setError(null);

    // Optimistically deduct 1 credit (minimum query cost) so the UI updates instantly.
    // The server response will correct this via X-Credits-Remaining header.
    void applyOptimisticCreditDelta(-1);

    // Use messagesRef (not stale closure) so we always send the latest history.
    const apiMessages = [...messagesRef.current, { ...userMsg, content: content.trim() }];

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: apiMessages.map((m) => ({ role: m.role, content: m.content })),
          symbol,
          contextData: { ...contextData, assetName },
          sourcesLimit,
          skipAssetLinks: true,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `API error: ${response.statusText}`);
      }

      let headerSources: Source[] = [];
      const sourcesHeader = response.headers.get("X-Lyra-Sources");
      if (sourcesHeader) {
        try { headerSources = JSON.parse(decodeURIComponent(sourcesHeader)); } catch { /* ignore */ }
      }

      const creditsRemaining = response.headers.get("X-Credits-Remaining");
      if (creditsRemaining !== null) {
        const nextCredits = Number(creditsRemaining);
        if (Number.isFinite(nextCredits)) {
          void setAuthoritativeCreditBalance(nextCredits);
          void revalidateCreditViews();
        }
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let content_ = "";
      const assistantId = (Date.now() + 1).toString();

      setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "" }]);

      let lastUpdate = 0;
      const THROTTLE = 32;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        content_ += decoder.decode(value, { stream: true });
        const now = Date.now();
        if (now - lastUpdate > THROTTLE) {
          setMessages((prev) =>
            prev.map((m) => m.id === assistantId ? { ...m, content: content_ } : m)
          );
          lastUpdate = now;
        }
      }

      // Flush any buffered multi-byte sequences at end of stream.
      content_ += decoder.decode();

      const parsed = parseLyraMessage(content_);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                content: parsed.text,
                sources: headerSources.length > 0 ? headerSources : parsed.sources,
                relatedQuestions: parsed.relatedQuestions,
              }
            : m
        )
      );
      void revalidateCreditViews();
      swrMutate("/api/points");
    } catch (err: unknown) {
      // Refund the optimistic deduction since the request failed
      void applyOptimisticCreditDelta(1);
      void revalidateCreditViews();
      setError(err instanceof Error ? err.message : "Failed to connect to Lyra");
    } finally {
      setIsLoading(false);
    }
  }, [assetName, contextData, isLoading, sourcesLimit, symbol]); // messagesRef used instead of messages to break stale closure

  // Auto-fire initial thesis query when sheet opens
  useEffect(() => {
    if (open && initialQuery && !hasFiredInitial.current && messages.length === 0) {
      hasFiredInitial.current = true;
      sendMessage(initialQuery, initialDisplayQuery);
    }
    if (!open) {
      hasFiredInitial.current = false;
    }
  }, [open, initialQuery, initialDisplayQuery, messages.length, sendMessage]);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = localInput.trim();
    if (!val) return;
    setLocalInput("");
    await sendMessage(val);
  };

  const displayName = assetName || symbol;

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      {/* Mobile: bottom drawer (h-[92dvh]); Desktop: right panel (w-[480px]) */}
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className={cn(
          "p-0 flex flex-col gap-0 overflow-hidden",
          // Desktop: right-side panel, 50% viewport width
          "sm:inset-y-0 sm:right-0 sm:left-auto sm:bottom-auto sm:top-0",
          "sm:h-full sm:w-1/2 sm:max-w-[50vw] sm:border-l sm:border-t-0 sm:rounded-none",
          // Mobile: full-width bottom drawer
          "h-[92dvh] w-full rounded-t-3xl border-t border-border/60",
          "bg-background/95 backdrop-blur-2xl",
        )}
      >
        {/* Accessible title (visually hidden via sr-only alternative) */}
        <SheetTitle className="sr-only">Lyra Insight — {displayName}</SheetTitle>
        <SheetDescription className="sr-only">AI-powered institutional analysis for {displayName}</SheetDescription>

        {/* ── Header ── */}
        <div className="relative flex items-center justify-between px-5 sm:px-8 py-4 border-b border-white/5 bg-background/80 backdrop-blur-xl shrink-0">
          {/* Mobile drag handle */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-muted-foreground/20 sm:hidden" />

          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="p-2 rounded-2xl bg-primary/10 border border-primary/25">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold tracking-tight premium-gradient-text">
                  Lyra INTEL
                </span>
                <span className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest">
                  •
                </span>
                <span className="text-[11px] font-bold text-foreground/80 uppercase tracking-wider">
                  {symbol}
                </span>
              </div>
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground/50">
                AI-Powered Market Intelligence
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-2xl hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-all duration-200 active:scale-95"
            aria-label="Close Lyra panel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Messages ── */}
        <div
          ref={scrollContainerRef}
          className="flex-1 min-h-0 overflow-y-auto will-change-scroll overscroll-contain scroll-smooth glass-scrollbar"
        >
          <div className="p-5 sm:px-8 sm:py-6 space-y-6 pb-4">
            {/* Empty state — shown only if no initial query */}
            {messages.length === 0 && !isLoading && (
              <div className="flex flex-col items-center justify-center gap-5 py-16 text-center animate-in fade-in zoom-in duration-500">
                <div className="p-5 rounded-3xl bg-primary/5 border border-primary/10 shadow-inner">
                  <Bot className="h-10 w-10 text-primary opacity-35" />
                </div>
                <div className="space-y-1.5">
                  <p className="text-sm font-bold tracking-tight text-foreground/80">
                    Institutional Analysis
                  </p>
                  <p className="text-xs text-muted-foreground/60">
                    Ask anything about {displayName}
                  </p>
                </div>
                <div className="w-full space-y-2 px-2">
                  {FOLLOW_UP_SUGGESTIONS.map((q) => (
                    <button
                      key={q}
                      onClick={() => sendMessage(q)}
                      className="w-full text-left text-[11px] font-bold border border-border/60 rounded-2xl px-4 py-3 hover:bg-primary/8 hover:border-primary/25 hover:text-primary transition-all duration-200 flex items-center justify-between group/q"
                    >
                      {q}
                      <Send className="h-3 w-3 opacity-0 group-hover/q:opacity-100 -translate-x-1 group-hover/q:translate-x-0 transition-all shrink-0 ml-2" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m) => (
              <ChatMessageItem
                key={m.id}
                message={m}
                onSuggestionClick={sendMessage}
              />
            ))}

            {/* Streaming indicator */}
            {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
              <div className="flex items-center gap-3 px-1 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="p-1.5 rounded-xl bg-primary/10 border border-primary/20 shrink-0">
                  <Sparkles className="h-3 w-3 text-primary animate-pulse" />
                </div>
                <div className="flex gap-1 items-center">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 animate-pulse">
                    Lyra is analyzing
                  </span>
                  <span className="flex gap-0.5 ml-1">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="w-1 h-1 rounded-full bg-primary/60 animate-bounce"
                        style={{ animationDelay: `${i * 150}ms` }}
                      />
                    ))}
                  </span>
                </div>
              </div>
            )}

            {error && (
              <div className="flex items-start gap-3 bg-destructive/8 border border-destructive/20 rounded-2xl px-4 py-3 text-sm text-destructive animate-in fade-in duration-200">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span className="font-medium text-xs">{error}</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* ── Follow-up suggestions (after first response) ── */}
        {messages.length >= 2 && !isLoading && (
          <div className="px-5 sm:px-8 py-2.5 border-t border-border/30 bg-muted/20 shrink-0">
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-0.5">
              {FOLLOW_UP_SUGGESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="shrink-0 text-[10px] font-bold px-3 py-1.5 rounded-full border border-white/5 hover:border-primary/30 hover:bg-primary/8 hover:text-primary transition-all duration-200 whitespace-nowrap text-muted-foreground"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Input bar ── */}
        <div className="px-5 sm:px-8 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] border-t border-white/5 bg-background/80 backdrop-blur-xl shrink-0">
          <form onSubmit={handleFormSubmit} className="relative flex items-center gap-2">
            <Input
              value={localInput}
              onChange={(e) => setLocalInput(e.target.value)}
              placeholder={`Ask about ${symbol}...`}
              className="flex-1 h-12 rounded-2xl border-border/60 bg-muted/30 text-sm font-medium pr-14 focus-visible:ring-primary/30 focus-visible:border-primary/40 transition-all"
              disabled={isLoading}
              aria-label="Ask Lyra"
            />
            <Button
              type="submit"
              size="icon"
              disabled={isLoading || !localInput.trim()}
              className="absolute right-1.5 top-1.5 h-9 w-9 rounded-2xl bg-primary hover:bg-primary/90 text-black shadow-md shadow-primary/20 transition-all hover:scale-105 active:scale-95 disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center"
            >
              <Sparkles className="h-4 w-4 fill-current" />
            </Button>
          </form>

          <div className="flex items-center justify-between mt-2.5">
            <div className="flex items-center gap-3 text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40">
              <span>Dimensional Analytics</span>
              <span>·</span>
              <span>Not Financial Advice</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40">
                <Zap className="h-2.5 w-2.5" />
                <span>Credits</span>
              </div>
              {messages.length > 1 && <CopyButton messages={messages} />}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
