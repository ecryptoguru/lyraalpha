"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ExternalLink, MessageCircle, Minus, Send, Sparkles, X } from "lucide-react";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  id: string;
}

const QUICK_REPLIES = [
  "What is InsightAlpha AI?",
  "How do I join the waitlist?",
  "What do waitlisted users get?",
  "What assets are covered?",
];

function renderContent(content: string) {
  const parts = content.split(/(\*\*[^*]+\*\*|\[.*?\]\(.*?\))/g);
  return parts.map((part, i) => {
    const boldMatch = part.match(/^\*\*(.+)\*\*$/);
    if (boldMatch) return <strong key={i}>{boldMatch[1]}</strong>;
    const linkMatch = part.match(/^\[(.+?)\]\((.+?)\)$/);
    if (linkMatch) {
      return (
        <a
          key={i}
          href={linkMatch[2]}
          className="inline-flex items-center gap-0.5 text-amber-600 underline underline-offset-2 transition-colors hover:text-amber-500 dark:text-amber-300 dark:hover:text-amber-200"
        >
          {linkMatch[1]}
          <ExternalLink className="h-3 w-3" />
        </a>
      );
    }
    return <span key={i}>{part}</span>;
  });
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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const sendMessage = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || isTyping) return;
    setInput("");

    const userMsg: ChatMessage = { role: "user", content, id: crypto.randomUUID() };
    const updatedHistory = [...messages, userMsg];
    setMessages(updatedHistory);
    setIsTyping(true);

    try {
      const res = await fetch("/api/support/public-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content, history: messages }),
      });

      if (res.ok && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";

        const assistantId = crypto.randomUUID();
        setMessages([...updatedHistory, { role: "assistant", content: "", id: assistantId }]);

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          accumulated += decoder.decode(value, { stream: true });
          setMessages([...updatedHistory, { role: "assistant", content: accumulated, id: assistantId }]);
        }

        accumulated += decoder.decode();
        if (accumulated.trim()) {
          setMessages([...updatedHistory, { role: "assistant", content: accumulated, id: assistantId }]);
        }
      }
    } catch {
    } finally {
      setIsTyping(false);
      inputRef.current?.focus();
    }
  };

  const launcherClassName = "group relative flex h-16 w-16 items-center justify-center rounded-full border border-amber-300/40 bg-white text-amber-500 shadow-[0_16px_48px_rgba(245,158,11,0.2)] transition-all duration-300 hover:-translate-y-1 hover:border-amber-300/60 hover:bg-amber-50 dark:border-amber-300/30 dark:bg-[#0b1322] dark:text-amber-200 dark:shadow-[0_16px_48px_rgba(0,0,0,0.42)] dark:hover:border-amber-300/45 dark:hover:bg-[#0f182b]";

  if (isMinimized) {
    return (
      <div className="fixed bottom-20 right-4 z-50 sm:bottom-22 sm:right-6">
        <button onClick={onExpand} className={launcherClassName} aria-label="Open Myra">
          <span className="absolute inset-1 rounded-full bg-[radial-gradient(circle,rgba(245,158,11,0.24),rgba(245,158,11,0.02)_68%,transparent)] blur-md transition-opacity duration-300 group-hover:opacity-100 dark:bg-[radial-gradient(circle,rgba(251,191,36,0.22),rgba(251,191,36,0.02)_68%,transparent)]" />
          <MessageCircle className="relative z-10 h-7 w-7" />
          <span className="absolute inset-0 rounded-full border border-amber-300/18" />
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-3 right-3 z-50 w-[calc(100vw-1.5rem)] sm:bottom-6 sm:right-6 sm:w-[410px]">
      <div
        className="relative flex w-full flex-col overflow-hidden rounded-4xl border border-slate-200/80 bg-white/96 shadow-[0_24px_72px_rgba(15,23,42,0.14)] backdrop-blur-xl animate-in fade-in slide-in-from-bottom-3 duration-300 dark:border-white/10 dark:bg-[#07111f]/96 dark:shadow-[0_24px_72px_rgba(0,0,0,0.44)]"
        style={{ height: "min(640px, calc(100dvh - 3rem))" }}
      >
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.58),transparent_22%,transparent_78%,rgba(245,158,11,0.08))] dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.04),transparent_22%,transparent_78%,rgba(245,158,11,0.06))]" />

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
              <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-slate-500 dark:text-white/38">
                Online · no sign-up needed
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={onMinimize}
              className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-white/48 dark:hover:bg-white/6 dark:hover:text-white/75"
              aria-label="Minimise"
            >
              <Minus className="h-4 w-4" />
            </button>
            <button
              onClick={onClose}
              className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-white/48 dark:hover:bg-white/6 dark:hover:text-white/75"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="relative shrink-0 border-b border-amber-200/70 bg-amber-50/80 px-5 py-3 dark:border-white/8 dark:bg-amber-300/6">
          <span className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-white/56">
            Ask about early access, waitlist benefits or
            <Link href="/#join-waitlist" className="font-bold text-amber-600 transition-colors hover:text-amber-500 dark:text-amber-100 dark:hover:text-white">
              join the waitlist →
            </Link>
          </span>
        </div>

        <div className="relative flex-1 min-h-0 space-y-4 overflow-y-auto bg-transparent p-5">
          {messages.length === 0 && (
            <div className="space-y-6 pt-2">
              <div className="space-y-3 text-center">
                <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full border border-amber-300/30 bg-amber-50 text-amber-500 shadow-[0_10px_30px_rgba(245,158,11,0.12)] dark:border-amber-300/18 dark:bg-amber-300/8 dark:text-amber-200 dark:shadow-[0_10px_30px_rgba(245,158,11,0.08)]">
                  <Sparkles className="h-8 w-8" />
                </div>
                <p className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">Ask before launch.</p>
                <p className="px-4 text-sm font-medium leading-relaxed text-slate-500 dark:text-white/52">
                  I can explain how the waitlist works, what early access includes, which assets are covered and how InsightAlpha works before public launch.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-2.5">
                {QUICK_REPLIES.map((reply) => (
                  <button
                    key={reply}
                    onClick={() => sendMessage(reply)}
                    className="rounded-[1.35rem] border border-slate-200/80 bg-white/90 p-3 text-left text-sm text-slate-600 transition-all duration-300 hover:-translate-y-0.5 hover:border-amber-300/40 hover:bg-amber-50 hover:text-slate-900 dark:border-white/8 dark:bg-white/2.5 dark:text-white/72 dark:hover:border-amber-300/18 dark:hover:bg-amber-300/[0.07] dark:hover:text-white"
                  >
                    {reply}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex animate-in fade-in slide-in-from-bottom-1 duration-200 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[84%] rounded-[1.35rem] px-3.5 py-3 text-sm ${
                  msg.role === "user"
                    ? "rounded-br-sm border border-amber-300/40 bg-amber-50 text-slate-900 dark:border-amber-300/24 dark:bg-amber-300/12 dark:text-white"
                    : "rounded-bl-sm border border-slate-200/80 bg-white/92 text-slate-700 dark:border-white/8 dark:bg-white/3 dark:text-white/82"
                }`}
              >
                {msg.role === "assistant" ? (
                  <span className="mb-1 flex items-center gap-1 text-[10px] font-medium uppercase tracking-[0.22em] text-amber-600 dark:text-amber-200/70">
                    <Sparkles className="h-2.5 w-2.5" />
                    Myra
                  </span>
                ) : null}
                <p className="leading-relaxed">{renderContent(msg.content)}</p>
              </div>
            </div>
          ))}

          {isTyping ? (
            <div className="flex justify-start animate-in fade-in slide-in-from-bottom-1 duration-200">
              <div className="flex items-center gap-2 rounded-[1.35rem] rounded-bl-sm border border-slate-200/80 bg-white/92 px-3 py-2.5 dark:border-white/8 dark:bg-white/3">
                <Sparkles className="h-3 w-3 text-amber-600 dark:text-amber-200/70" />
                <span className="mr-1 text-[10px] uppercase tracking-[0.22em] text-slate-400 dark:text-white/42">Myra is typing</span>
                <span className="flex gap-1">
                  {[0, 1, 2].map((dot) => (
                    <span
                      key={dot}
                      className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/45"
                      style={{ animationDelay: `${dot * 150}ms` }}
                    />
                  ))}
                </span>
              </div>
            </div>
          ) : null}

          <div ref={messagesEndRef} />
        </div>

        <div className="relative shrink-0 border-t border-slate-200/80 bg-slate-50/90 p-3 dark:border-white/8 dark:bg-black/18">
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
              placeholder="Ask about the waitlist, free early access or coverage..."
              className="flex-1 rounded-full border border-slate-200/80 bg-white px-4 py-3 text-sm text-slate-900 transition-all placeholder:text-slate-400 focus:border-amber-300/50 focus:outline-none focus:ring-1 focus:ring-amber-300/18 dark:border-white/10 dark:bg-white/3 dark:text-white dark:placeholder:text-white/28 dark:focus:border-amber-300/28"
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || isTyping}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-amber-400 text-slate-950 shadow-[0_10px_30px_rgba(245,158,11,0.22)] transition-all hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-2 flex items-center justify-center">
            <span className="inline-flex items-center gap-1 rounded-full border border-slate-200/80 bg-white/90 px-3 py-1 text-[10px] uppercase tracking-[0.24em] text-slate-400 dark:border-white/8 dark:bg-white/3 dark:text-white/46">
              <Sparkles className="h-2.5 w-2.5 text-amber-600 dark:text-amber-200/70" />
              Waitlist users get free limited early access before launch
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
