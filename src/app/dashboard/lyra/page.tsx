"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sparkles,
  AlertCircle,
  History,
  Send,
  Zap,
  Clock,
  ChevronDown,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, useRef, useEffect, useMemo, useCallback, memo, Suspense } from "react";
import dynamic from "next/dynamic";
import useSWR, { mutate as swrMutate } from "swr";
import { useAuth } from "@/lib/clerk-shim";
import { formatRelativeTime as fmtRelativeTime } from "@/lib/format-relative-time";
import { ExportButton } from "@/components/lyra/export-button";
import { parseEliteCommand } from "@/lib/ai/elite-commands";
import { usePlan } from "@/hooks/use-plan";

const EliteCommandBar = dynamic(
  () => import("@/components/lyra/elite-command-bar").then((m) => m.EliteCommandBar),
  { ssr: false },
);

const AnswerWithSources = dynamic(
  () => import("@/components/lyra/answer-with-sources").then((m) => m.AnswerWithSources),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-3">
        <div className="h-4 w-4/5 rounded bg-muted/20 animate-pulse" />
        <div className="h-4 w-3/5 rounded bg-muted/20 animate-pulse" />
        <div className="h-4 w-2/3 rounded bg-muted/20 animate-pulse" />
      </div>
    ),
  },
);
import { parseLyraMessage, type Source } from "@/lib/lyra-utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ErrorBoundary,
  SectionErrorFallback,
} from "@/components/error-boundary";
import { useRegion } from "@/lib/context/RegionContext";
import { cn } from "@/lib/utils";

import {
  clearAllPersistedLyraChats,
  getLyraChatSessionController,
} from "@/lib/lyra-chat-session";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  relatedQuestions?: string[];
  contextTruncated?: boolean;
}

interface HistoryItem {
  id: string;
  inputQuery: string;
  outputResponse: string;
  createdAt: string;
}

interface LyraPromptQuestion {
  id: string;
  question: string;
  displayOrder: number;
}

interface MoverItem {
  symbol: string;
  name: string;
  price: number;
  changePercent: number;
  type: string;
}

const LYRA_FALLBACK_PROMPTS: LyraPromptQuestion[] = [
  {
    id: "fallback-1",
    question: "What are the key technical drivers for BTC-USD and the crypto market this week?",
    displayOrder: 1,
  },
  {
    id: "fallback-2",
    question: "Analyze the current market regime. Are we in an inflationary or deflationary environment?",
    displayOrder: 2,
  },
  {
    id: "fallback-3",
    question: "Which sectors are gaining institutional momentum right now?",
    displayOrder: 3,
  },
];

import { fetcher } from "@/lib/swr-fetcher";

function BriefingStalenessBadge({ region }: { region: string }) {
  const { data } = useSWR<{ briefing?: { generatedAt?: string } }>(
    `/api/lyra/briefing?region=${region}`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 300_000 },
  );

  const generatedAt = data?.briefing?.generatedAt;
  const [now, setNow] = useState(0);

  useEffect(() => {
    if (!generatedAt) {
      return;
    }

    const generatedMs = new Date(generatedAt).getTime();
    const currentAgeHours = (Date.now() - generatedMs) / 3_600_000;

    const updateNow = () => setNow(Date.now());
    updateNow();

    // Only run the recurring interval when the badge is visible (age >= 16h).
    // Otherwise, set a single timeout to wake up when the badge would appear.
    if (currentAgeHours >= 16) {
      const interval = setInterval(updateNow, 60_000);
      return () => clearInterval(interval);
    }

    // Schedule a single wake-up near the 16h mark
    const msUntil16h = Math.max(60_000, (16 - currentAgeHours) * 3_600_000);
    const timeout = setTimeout(() => {
      updateNow();
      // After waking up, the effect re-runs and will start the interval if needed
    }, msUntil16h);
    return () => clearTimeout(timeout);
  }, [generatedAt]);

  const ageHours = generatedAt
    ? Math.max(0, (now - new Date(generatedAt).getTime()) / 3_600_000)
    : null;

  if (ageHours === null || ageHours < 18) return null;

  const hoursLabel = ageHours < 24
    ? `${Math.floor(ageHours)}h`
    : `${Math.floor(ageHours / 24)}d`;

  return (
    <div className="inline-flex items-center gap-1.5 rounded-full border border-warning/30 bg-warning/10 px-3 py-1.5 text-[10px] font-bold text-warning">
      <Clock className="h-3 w-3 shrink-0" />
      Market briefing is {hoursLabel} old — Lyra context may be stale
    </div>
  );
}

const trendingPromptFetcher = async (url: string): Promise<LyraPromptQuestion[]> => {
  const response = await fetch(url);
  if (!response.ok) return LYRA_FALLBACK_PROMPTS;
  const data = await response.json();
  if (data.success && Array.isArray(data.questions) && data.questions.length > 0) {
    return data.questions;
  }
  return LYRA_FALLBACK_PROMPTS;
};

function formatRelativeTime(dateString: string): string {
  return fmtRelativeTime(dateString);
}

function getGreeting(): { greeting: string; subtitle: string } {
  const hour = new Date().getHours();
  if (hour < 6) return { greeting: "Late night", subtitle: "Asia is trading. Ask Lyra what matters right now." };
  if (hour < 12) return { greeting: "Good morning", subtitle: "What are you trying to figure out today?" };
  if (hour < 17) return { greeting: "Good afternoon", subtitle: "Mid-session. What do you need to work through?" };
  if (hour < 21) return { greeting: "Good evening", subtitle: "Day's done. What's still on your mind?" };
  return { greeting: "Night session", subtitle: "Something caught your eye. Ask Lyra about it." };
}

function formatTelemetryHeader(content: string): string {
  // Step 1: Strip any GPT CoD scaffold lines that leaked into output
  // e.g. "scaffold: dovish repricing → curve inversion → ..."
  const strippedLines = content
    .split("\n")
    .filter((l) => !/^\s*scaffold\s*:/i.test(l));
  const stripped = strippedLines.join("\n");

  // Step 2: Format first non-empty line if it looks like a telemetry header
  // e.g. "T:neutral + breadth:50 → high narrative sensitivity"
  const lines = stripped.split("\n");
  const firstNonEmptyIndex = lines.findIndex((l) => l.trim().length > 0);
  if (firstNonEmptyIndex < 0) return stripped;

  const header = lines[firstNonEmptyIndex].trim();
  const looksLikeTelemetry =
    header.includes("→") && /(\bbreadth\b|\bdispersion\b|\bT:|\bM:|\bV:)/i.test(header);
  if (!looksLikeTelemetry) return stripped;

  const arrowIdx = header.indexOf("→");
  const metricsRaw = header.slice(0, arrowIdx).trim();
  const implicationRaw = header.slice(arrowIdx + 1).trim();
  if (!metricsRaw || !implicationRaw) return stripped;

  const expandedMetrics = metricsRaw
    .replace(/\bT\s*:/g, "Trend:")
    .replace(/\bM\s*:/g, "Momentum:")
    .replace(/\bV\s*:/g, "Volatility:")
    .replace(/\bL\s*:/g, "Liquidity:")
    .replace(/\bS\s*:/g, "Sentiment:");

  lines[firstNonEmptyIndex] = `${expandedMetrics}\n\nImplication: ${implicationRaw}`;
  return lines.join("\n");
}


// Isolated loading indicator with its own elapsed timer — prevents the parent
// LyraPageInner from re-rendering every second during loading.
const LoadingIndicator = memo(function LoadingIndicator({
  loadingStartTime,
}: {
  loadingStartTime: number | null;
}) {
  const [elapsed, setElapsed] = useState(() =>
    loadingStartTime ? Math.floor((Date.now() - loadingStartTime) / 1000) : 0,
  );

  useEffect(() => {
    if (!loadingStartTime) return;
    const start = loadingStartTime;
    const update = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [loadingStartTime]);

  if (!loadingStartTime) return null;

  return (
    <div className="flex items-start gap-3 px-1 py-3 animate-in fade-in duration-300">
      <div className="p-2 rounded-2xl bg-primary/10 border border-primary/20 shrink-0 mt-0.5">
        <Sparkles className={cn("h-3.5 w-3.5 text-primary", elapsed > 5 ? "animate-spin" : "animate-pulse")} style={{ animationDuration: elapsed > 5 ? "2s" : "1s" }} />
      </div>
      <div className="flex flex-col gap-1 min-w-0">
        {elapsed <= 4 ? (
          <p className="text-xs font-bold text-muted-foreground animate-pulse">Lyra is analyzing...</p>
        ) : elapsed <= 14 ? (
          <>
            <p className="text-xs font-bold text-primary/80">Lyra is reasoning deeply...</p>
            <p className="text-[10px] text-muted-foreground/70 leading-relaxed">Cross-referencing signals &amp; market regime</p>
          </>
        ) : (
          <>
            <p className="text-xs font-bold text-primary">Lyra is building full institutional analysis...</p>
            <p className="text-[10px] text-muted-foreground/70 leading-relaxed">Deep synthesis in progress — 20–45s for complex queries</p>
          </>
        )}
        {elapsed > 0 && (
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-muted-foreground/50 font-mono">{elapsed}s</span>
            <div className="flex items-center gap-0.5">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-1 h-1 rounded-full bg-primary/50"
                  style={{ animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

// Memoized so parseLyraMessage is not re-called on every parent re-render
// (e.g. during streaming of a different message or elapsed-seconds tick)
const AssistantMessage = memo(function AssistantMessage({
  message,
  userQuery,
  onRelatedQuestionClick,
}: {
  message: Message;
  userQuery: string;
  onRelatedQuestionClick: (q: string) => void;
}) {
  const { text, sources, toolResults, relatedQuestions } = useMemo(
    () => parseLyraMessage(message.content),
    [message.content],
  );

  const formattedText = useMemo(() => formatTelemetryHeader(text), [text]);
  return (
    <div className="flex flex-col gap-1.5">
      <AnswerWithSources
        content={formattedText}
        sources={sources.length > 0 ? sources : message.sources || []}
        toolResults={toolResults}
        relatedQuestions={message.relatedQuestions?.length ? message.relatedQuestions : relatedQuestions}
        onRelatedQuestionClick={onRelatedQuestionClick}
        query={userQuery}
      />
      {message.contextTruncated && (
        <p className="text-[10px] text-muted-foreground/50 px-1 flex items-center gap-1">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-warning/60 shrink-0" />
          Context window capped — some older market data was trimmed to fit your plan’s limit.
        </p>
      )}
    </div>
  );
});


function LyraPageInner() {
  const searchParams = useSearchParams();
  const { isLoaded, userId } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStartTime, setLoadingStartTime] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rateLimitRemaining, setRateLimitRemaining] = useState<number | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const hasMessages = messages.length > 0;
  const { region } = useRegion();
  const { plan } = usePlan();
  const isElite = plan === "ELITE" || plan === "ENTERPRISE";

  const { data: regimeData } = useSWR<{
    current?: {
      regime?: { label?: string };
      risk?: { label?: string };
      volatility?: { label?: string };
      breadth?: { label?: string };
    };
  }>(`/api/market/regime-multi-horizon?region=${region}`, fetcher, {
    refreshInterval: hasMessages ? 0 : 300000,
    revalidateOnFocus: false,
    dedupingInterval: 120000,
  });
  const { data: moversData } = useSWR<{ topGainers: MoverItem[]; topLosers: MoverItem[] }>(
    `/api/stocks/movers?region=${region}`,
    fetcher,
    {
      refreshInterval: hasMessages ? 0 : 120000,
      revalidateOnFocus: false,
      dedupingInterval: 60000,
    },
  );
  const { data: promptQuestions } = useSWR<LyraPromptQuestion[]>(
    "/api/lyra/trending",
    trendingPromptFetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 120000,
      fallbackData: LYRA_FALLBACK_PROMPTS,
    },
  );

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const userHasScrolledUp = useRef(false);
  const [showScrollPill, setShowScrollPill] = useState(false);
  const autoSubmittedQueryRef = useRef<string | null>(null);
  const regimeDataRef = useRef(regimeData);
  const moversDataRef = useRef(moversData);

  // Keep refs in sync with latest SWR data so sendMessage always reads current values
  regimeDataRef.current = regimeData;
  moversDataRef.current = moversData;
  const lyraController = useMemo(
    () => (userId ? getLyraChatSessionController(userId) : null),
    [userId],
  );

  const [{ greeting }] = useState(() => getGreeting());
  const topPromptQuestions = useMemo(
    () => [...(promptQuestions ?? LYRA_FALLBACK_PROMPTS)].sort((a, b) => a.displayOrder - b.displayOrder).slice(0, 3),
    [promptQuestions],
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !isLoaded) return;
    if (!userId) {
      clearAllPersistedLyraChats();
      return;
    }
    if (!lyraController) return;

    return lyraController.subscribe((snapshot) => {
      setInput(snapshot.input);
      setMessages(snapshot.messages as Message[]);
      setIsLoading(snapshot.isLoading);
      setLoadingStartTime(snapshot.loadingStartTime);
      setError(snapshot.error);
      setRateLimitRemaining(snapshot.rateLimitRemaining);
    });
  }, [isLoaded, lyraController, mounted, userId]);

  const isNearBottom = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 150;
  }, []);

  const scrollToBottom = useCallback((smooth: boolean) => {
    if (userHasScrolledUp.current) return;
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
  }, []);

  // Track user scroll intent on the chat container
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const handleScroll = () => {
      const scrolled = !isNearBottom();
      userHasScrolledUp.current = scrolled;
      setShowScrollPill(scrolled);
    };
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [isNearBottom]);

  useEffect(() => {
    if (!mounted || !isHistoryOpen || history.length > 0) return;

    const fetchHistory = async () => {
      setHistoryLoading(true);
      try {
        const res = await fetch("/api/lyra/history");
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            setHistory(data.history);
          }
        }
      } catch {
        // Silent fail - history fetch is non-critical
      } finally {
        setHistoryLoading(false);
      }
    };

    fetchHistory();
  }, [history.length, isHistoryOpen, mounted]);

  useEffect(() => {
    if (mounted) {
      // Always scroll for new user messages (they just sent it)
      const lastMsg = messages[messages.length - 1];
      if (lastMsg?.role === "user") {
        userHasScrolledUp.current = false;
        setShowScrollPill(false);
      }
      scrollToBottom(!isLoading);
    }
  }, [messages, isLoading, mounted, scrollToBottom]);

  // Keyboard shortcut: focus input on /
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/" && !e.ctrlKey && !e.metaKey && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const sendMessage = useCallback(async (content: string) => {
    if (!lyraController) return;
    // Read from refs to always get latest SWR data (avoids stale closure)
    const currentRegime = regimeDataRef.current;
    const currentMovers = moversDataRef.current;
    await lyraController.sendMessage({
      content,
      symbol: "GLOBAL",
      contextData: {
        symbol: "GLOBAL",
        assetName: "Global Markets",
        assetType: "GLOBAL",
        regime: currentRegime?.current?.regime?.label || "Market Overview",
        scores: {},
        ...(currentRegime?.current && {
          regimeDetail: {
            regime: currentRegime.current.regime?.label,
            risk: currentRegime.current.risk?.label,
            volatility: currentRegime.current.volatility?.label,
            breadth: currentRegime.current.breadth?.label,
          },
        }),
        ...(currentMovers && {
          topMovers: {
            gainers: (currentMovers.topGainers || []).slice(0, 3).map((m: MoverItem) => `${m.symbol} +${m.changePercent?.toFixed(1)}%`),
            losers: (currentMovers.topLosers || []).slice(0, 3).map((m: MoverItem) => `${m.symbol} ${m.changePercent?.toFixed(1)}%`),
          },
        }),
        region,
      },
    });
    swrMutate("/api/points");
  }, [lyraController, region]);

  useEffect(() => {
    if (!mounted || isLoading || messages.length > 0) return;

    const initialQuery = searchParams?.get("q")?.trim();
    if (!initialQuery) return;
    if (autoSubmittedQueryRef.current === initialQuery) return;

    autoSubmittedQueryRef.current = initialQuery;
    void sendMessage(initialQuery);
  }, [lyraController, mounted, isLoading, messages.length, searchParams, sendMessage]);

  const handleQuestionClick = useCallback(async (question: string) => {
    if (!lyraController) {
      return;
    }
    userHasScrolledUp.current = false;
    setShowScrollPill(false);
    await sendMessage(question);
  }, [lyraController, sendMessage]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const messageContent = input.trim();
    if (!messageContent) return;

    // Parse Elite slash commands
    if (isElite) {
      const cmd = parseEliteCommand(messageContent);
      if (cmd) {
        await sendMessage(cmd.lyraQuery);
        return;
      }
    }

    await sendMessage(messageContent);
  };

  const handleCommandSelect = (syntax: string) => {
    lyraController?.setInput(syntax);
    inputRef.current?.focus();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    lyraController?.setInput(e.target.value);
  };

  const renderChatInput = (params: { placeholder: string; buttonLabel: string; fullWidth?: boolean }) => {
    return (
      <form onSubmit={handleSubmit} className={cn("relative group/input mx-auto w-full", params.fullWidth ? "max-w-none" : "max-w-4xl")}>
        <div className="absolute -inset-2 bg-linear-to-r from-primary/20 via-primary/30 to-primary/20 rounded-3xl opacity-80 group-focus-within/input:opacity-100 transition-opacity duration-500 blur-xl" />
        <div className="relative rounded-2xl border border-border/60 dark:border-white/10 bg-card/80 backdrop-blur-2xl overflow-hidden shadow-2xl group-focus-within/input:border-primary/50 transition-all duration-300">
          <div className="flex items-center gap-3 p-2 sm:p-3">
            <div className="pl-2 shrink-0">
              <div className="p-2 rounded-2xl bg-primary/10 border border-primary/20">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
            </div>
            <Input
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              placeholder={params.placeholder}
              className="flex-1 h-12 border-none bg-transparent text-base font-medium focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground"
              disabled={isLoading}
              aria-label="Chat input"
            />
            <Button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="h-12 px-6 rounded-2xl font-bold shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300 mr-1 shrink-0 bg-primary text-primary-foreground"
            >
              {isLoading ? (
                <div className="h-5 w-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              ) : (
                <>
                  <span className="hidden sm:inline font-bold tracking-wide text-sm">{params.buttonLabel}</span>
                  <Send className="sm:ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      </form>
    );
  };

  const renderHistoryMenu = (buttonClassName: string) => (
    <DropdownMenu onOpenChange={setIsHistoryOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          id="lyra-history-trigger"
          variant="outline"
          size="sm"
          className={buttonClassName}
        >
          <History className="h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4 text-primary" />
          <span className="hidden md:inline text-[8px] sm:text-[9px] md:text-[10px] font-bold uppercase tracking-wider">History</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-80 rounded-3xl border border-border/60 dark:border-white/10 bg-card/90 dark:bg-card/70 p-2 shadow-[0_24px_80px_-36px_rgba(2,6,23,0.72)] backdrop-blur-xl"
      >
        <DropdownMenuLabel className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest opacity-70">
          Recent Sessions
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="surface-elevated" />
        {historyLoading ? (
          <div className="p-4 text-center text-[10px] font-bold uppercase tracking-widest opacity-40">
            Loading...
          </div>
        ) : history.length === 0 ? (
          <div className="p-4 text-center text-[10px] font-bold uppercase tracking-widest opacity-40">
            No sessions yet
          </div>
        ) : (
          history.slice(0, 8).map((item) => (
            <DropdownMenuItem
              key={item.id}
              onClick={() => lyraController?.loadHistorySession(item)}
              className="cursor-pointer flex flex-col items-start gap-1 p-3 rounded-2xl hover:surface-elevated transition-all"
            >
              <span className="font-bold truncate w-full text-xs tracking-tight">
                {item.inputQuery}
              </span>
              <span className="text-[9px] font-bold uppercase tracking-widest opacity-40 text-muted-foreground">
                {formatRelativeTime(item.createdAt)}
              </span>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <ErrorBoundary
      fallback={
        <SectionErrorFallback
          error={new Error("Chat interface failed to load")}
          resetError={() => window.location.reload()}
        />
      }
    >
      <div className="flex flex-col px-3 sm:px-4 md:px-6 pb-4 sm:pb-4" style={{ height: "calc(100dvh - 4rem)" }}>
        {hasMessages && (
          <div className="flex items-center justify-between shrink-0 pt-2 sm:pt-4 mb-2 sm:mb-4">
            <div className="flex items-center gap-1.5 sm:gap-2">
              {hasMessages && isElite && (
                <ExportButton messages={messages} />
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => lyraController?.clearSession()}
                className="h-7 sm:h-8 md:h-9 px-2 sm:px-3 md:px-4 text-[8px] sm:text-[9px] md:text-[10px] font-bold uppercase tracking-wider border-border/40 dark:border-white/5 hover:border-primary/40 hover:bg-primary/5 rounded-2xl sm:rounded-2xl transition-all"
              >
                <span className="hidden sm:inline">New Chat</span>
                <span className="sm:hidden">New</span>
              </Button>
              {renderHistoryMenu("h-7 sm:h-8 md:h-9 px-2 sm:px-3 md:px-4 border-border/40 dark:border-white/5 hover:border-primary/40 hover:bg-primary/5 rounded-2xl sm:rounded-2xl flex gap-1 sm:gap-1.5 md:gap-2 transition-all")}
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-h-0 w-full overflow-hidden">

          {hasMessages ? (
            /* ─── CHAT MODE ─── */
            <>
              {/* Messages — scrollable, fills all available space */}
              <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-y-auto will-change-scroll overscroll-contain scroll-smooth px-1 sm:px-2 py-4 space-y-5 glass-scrollbar">
                {messages.map((message, idx) => (
                  <div key={message.id} className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className={cn(
                      "flex flex-col gap-1.5",
                      message.role === "user" ? "items-end ml-auto max-w-[85%] sm:max-w-[72%]" : "items-start w-full"
                    )}>
                      <div className="flex items-center gap-1.5 mb-0.5">
                        {message.role === "assistant" ? (
                          <>
                            <Sparkles className="h-3 w-3 text-primary" />
                            <span className="text-[9px] font-bold uppercase tracking-wider text-primary/70">Lyra</span>
                          </>
                        ) : (
                          <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">You</span>
                        )}
                      </div>
                      {message.role === "user" ? (
                        <div className="rounded-2xl px-4 py-3 bg-primary text-primary-foreground border border-primary/20 shadow-lg shadow-primary/10">
                          <p className="text-sm font-semibold leading-relaxed">{message.content}</p>
                        </div>
                      ) : (
                        <div className="w-full border-l-2 border-primary/40 pl-4 py-1 mt-1">
                          <AssistantMessage
                            message={message}
                            userQuery={messages[idx - 1]?.content ?? ""}
                            onRelatedQuestionClick={handleQuestionClick}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {isLoading && (!messages.length || messages[messages.length - 1].role !== "assistant" || !messages[messages.length - 1].content) && (
                  <LoadingIndicator loadingStartTime={loadingStartTime} />
                )}

                {error && (
                  <div className="flex justify-center py-2">
                    <div className="bg-destructive/10 text-destructive rounded-2xl p-4 max-w-md border border-destructive/20">
                      <div className="flex items-center gap-2 mb-1">
                        <AlertCircle className="h-4 w-4" />
                        <span className="font-bold text-sm">Error</span>
                      </div>
                      <p className="text-sm">{error}</p>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Scroll-to-bottom pill */}
              {showScrollPill && (
                <button
                  onClick={() => {
                    userHasScrolledUp.current = false;
                    setShowScrollPill(false);
                    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="absolute bottom-24 left-1/2 -translate-x-1/2 z-20 inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-card/90 backdrop-blur-xl px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-lg transition-all hover:bg-card hover:text-foreground hover:border-primary/30"
                  aria-label="Scroll to latest message"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                  Latest
                </button>
              )}

              {/* Rate-limit low-messages banner — shown proactively before hitting 429 */}
              {rateLimitRemaining !== null && rateLimitRemaining <= 3 && (
                <div className="shrink-0 mx-1 mb-2 animate-in fade-in slide-in-from-bottom-2 duration-400">
                  <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-2xl bg-warning/10 border border-warning/25 text-primary dark:text-warning">
                    <div className="flex items-center gap-2 min-w-0">
                      <Zap className="h-3 w-3 shrink-0" />
                      <span className="text-[11px] font-bold truncate">
                        {rateLimitRemaining === 0
                          ? "Daily message limit reached"
                          : `${rateLimitRemaining} message${rateLimitRemaining === 1 ? "" : "s"} left today`}
                      </span>
                    </div>
                    {!isElite && (
                      <Link
                        href="/dashboard/upgrade"
                        className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-primary dark:text-warning hover:text-warning transition-colors"
                      >
                        Upgrade →
                      </Link>
                    )}
                  </div>
                </div>
              )}

              {/* Input — pinned at bottom in chat mode */}
              <div className="shrink-0 pt-3 pb-3 border-t border-border/10">
                {isElite && (
                  <div className="mb-2 relative">
                    <EliteCommandBar
                      inputValue={input}
                      onCommandSelect={handleCommandSelect}
                      visible={isElite}
                    />
                  </div>
                )}
                {renderChatInput({ placeholder: "Continue...", buttonLabel: "Send" })}
              </div>
            </>
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain scroll-smooth">
              <div className="px-4 py-4 sm:px-5 sm:py-6">
                <div className="mx-auto w-full max-w-6xl space-y-5">
                  <div className="relative overflow-hidden rounded-4xl border border-border/50 dark:border-white/8 bg-card dark:bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.12),transparent_24%),linear-gradient(180deg,rgba(15,23,42,0.92),rgba(2,6,23,0.98))] p-5 shadow-lg dark:shadow-[0_24px_70px_rgba(2,6,23,0.45)] sm:p-7">
                    <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-primary/50 to-transparent" />
                    <div className="pointer-events-none absolute inset-0 opacity-[0.04] bg-[linear-gradient(rgba(248,250,252,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(248,250,252,0.08)_1px,transparent_1px)] bg-size-[22px_22px]" />
                    <div className="relative space-y-6">
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-2">
                            <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/8 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.28em] text-primary/75">
                              <Sparkles className="h-3 w-3" />
                              {greeting}
                            </div>
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary/70">Lyra terminal</p>
                              <p className="mt-1 text-xs text-muted-foreground">AI-powered market intelligence</p>
                            </div>
                          </div>
                          {renderHistoryMenu("h-7 sm:h-8 px-2 sm:px-3 border-border/40 dark:border-white/5 hover:border-primary/40 hover:bg-primary/5 rounded-2xl flex gap-1 sm:gap-1.5 transition-all shrink-0")}
                        </div>
                        <h2 className="max-w-3xl font-mono text-3xl font-bold leading-tight tracking-[-0.04em] text-foreground sm:text-4xl md:text-5xl">
                          Ask clearer market questions.
                          <span className="block premium-gradient-text">Get a sharper next step.</span>
                        </h2>
                        <p className="max-w-2xl text-sm leading-7 text-muted-foreground sm:text-[15px]">
                          Ask about a setup, a risk, or a market change. Lyra tells you what matters and where to go next.
                        </p>
                      </div>

                      <BriefingStalenessBadge region={region} />

                      {isElite && (
                        <div className="space-y-2">
                          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary/70">Elite commands</p>
                          <div className="flex flex-wrap gap-2">
                            {[
                              "/compare",
                              "/hedge",
                              "/stress-test",
                              "/watchlist-audit",
                            ].map((command) => (
                              <button
                                key={command}
                                type="button"
                                onClick={() => handleCommandSelect(command)}
                                className="rounded-full border border-primary/20 bg-primary/8 px-3 py-1.5 text-[10px] font-bold tracking-[0.16em] text-primary transition-colors hover:border-primary/35 hover:bg-primary/12"
                              >
                                {command}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="space-y-3">
                        {renderChatInput({
                          placeholder: "Ask about markets, assets, strategies...",
                          buttonLabel: "Ask Lyra",
                          fullWidth: true,
                        })}
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <span className="inline-flex items-center gap-1 rounded-full border border-warning/20 bg-warning/10 px-2.5 py-1 text-[10px] text-primary/70 dark:text-warning/70">
                            <Zap className="h-2.5 w-2.5" />
                            Credits required
                          </span>
                          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/55">
                            Terminal minimal
                          </span>
                        </div>
                      </div>

                      <div className="rounded-3xl border border-border/50 dark:border-white/8 bg-muted/30 dark:bg-black/20 p-4 sm:p-5">
                        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-primary/70">
                          <span className="h-2 w-2 rounded-full bg-success shadow-[0_0_10px_rgba(52,211,153,0.45)]" />
                          Example questions
                        </div>
                        <div className="mt-3 space-y-2">
                          {topPromptQuestions.map((prompt) => (
                            <button
                              key={prompt.id}
                              type="button"
                              onClick={() => handleQuestionClick(prompt.question)}
                              className="group flex w-full items-start gap-2 rounded-2xl border border-border/40 dark:border-white/6 bg-muted/20 dark:bg-white/3 px-3 py-2 text-left transition-colors hover:border-primary/20 hover:bg-primary/6"
                            >
                              <span className="mt-0.5 font-mono text-[11px] text-primary/60">&gt;</span>
                              <span className="text-xs leading-6 text-muted-foreground transition-colors group-hover:text-foreground">{prompt.question}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="grid gap-3 md:grid-cols-3">
                        <div className="rounded-3xl border border-border/40 dark:border-white/6 bg-muted/20 dark:bg-white/3 p-4">
                          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary/70">Ask this when</p>
                          <div className="mt-3 space-y-2 text-xs leading-6 text-muted-foreground">
                            <p>Setup changed and you need to understand why.</p>
                            <p>Testing a thesis before acting.</p>
                            <p>Cross-asset or regime context needed.</p>
                          </div>
                        </div>
                        <div className="rounded-3xl border border-border/40 dark:border-white/6 bg-muted/20 dark:bg-white/3 p-4">
                          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary/70">Ask like this</p>
                          <div className="mt-3 space-y-2 text-xs leading-6 text-muted-foreground">
                            <p>Name the asset, theme or risk specifically.</p>
                            <p>Ask what changed, what matters, or what breaks the thesis.</p>
                            <p>Compare two paths when you need a decision frame.</p>
                          </div>
                        </div>
                        <div className="rounded-3xl border border-border/40 dark:border-white/6 bg-muted/20 dark:bg-white/3 p-4">
                          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary/70">You will get</p>
                          <div className="mt-3 space-y-2 text-xs leading-6 text-muted-foreground">
                            <p>Clear read on setup, drivers and risk.</p>
                            <p>A sharper follow-up question when needed.</p>
                            <p>Next step: compare, hedge, or portfolio review.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          )}

        </div>{/* end main content */}
      </div>{/* end outer h-screen shell */}
    </ErrorBoundary>
  );
}

export default function LyraPage() {
  return (
    <Suspense fallback={null}>
      <LyraPageInner />
    </Suspense>
  );
}
