"use client";

import { useState, useEffect } from "react";
import { Circle, Send, CheckCircle, MessageCircle, Sparkles } from "lucide-react";
import { supabaseRealtime } from "@/lib/supabase-realtime";
import { createClientLogger } from "@/lib/logger/client";

interface Message {
  id: string;
  senderId: string;
  senderRole: "USER" | "AGENT";
  content: string;
  createdAt: string;
}

interface Conversation {
  id: string;
  userId: string;
  status: "OPEN" | "PENDING" | "RESOLVED" | "CLOSED";
  subject: string;
  plan: string;
  userContext: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  messages: Message[];
}

interface SupportConversationResponse {
  items: Conversation[];
  nextCursor: {
    id: string;
    updatedAt: string;
  } | null;
}

export default function AdminSupportPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"OPEN" | "PENDING" | "RESOLVED">("OPEN");
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<SupportConversationResponse["nextCursor"]>(null);

  useEffect(() => {
    fetchConversations();
    const realtime = supabaseRealtime;
    if (!realtime) return;

    let channel: ReturnType<typeof realtime.channel> | null = null;

    try {
      channel = realtime
        .channel("admin-support")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "SupportConversation",
          },
          () => fetchConversations()
        );
      channel.subscribe();
    } catch {
      channel = null;
    }

    return () => {
      if (channel) {
        realtime.removeChannel(channel);
      }
    };
  }, []);

  useEffect(() => {
    const realtime = supabaseRealtime;
    if (!selectedId || !realtime) return;

    let channel: ReturnType<typeof realtime.channel> | null = null;

    try {
      channel = realtime
        .channel(`admin-conv:${selectedId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "SupportMessage",
            filter: `conversationId=eq.${selectedId}`,
          },
          () => fetchConversations()
        );
      channel.subscribe();
    } catch {
      channel = null;
    }

    return () => {
      if (channel) {
        realtime.removeChannel(channel);
      }
    };
  }, [selectedId]);

  const fetchConversations = async (cursor?: SupportConversationResponse["nextCursor"]) => {
    const searchParams = new URLSearchParams();
    searchParams.set("limit", "50");
    if (cursor?.id && cursor?.updatedAt) {
      searchParams.set("cursor", cursor.id);
      searchParams.set("cursorUpdatedAt", cursor.updatedAt);
    }

    if (cursor) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    try {
      const res = await fetch(`/api/admin/support/conversations?${searchParams.toString()}`);
      if (res.ok) {
        const data: SupportConversationResponse = await res.json();
        setConversations((current) => {
          if (!cursor) return data.items || [];

          const merged = [...current];
          for (const item of data.items || []) {
            if (!merged.some((existing) => existing.id === item.id)) {
              merged.push(item);
            }
          }
          return merged;
        });
        setNextCursor(data.nextCursor ?? null);
      }
    } catch (err) {
      createClientLogger("admin-support").error("Failed to fetch conversations", { err: String(err) });
    } finally {
      if (cursor) {
        setLoadingMore(false);
      } else {
        setLoading(false);
      }
    }
  };

  const selected = conversations.find((c) => c.id === selectedId);

  const sendReply = async () => {
    if (!selectedId || !reply.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetch("/api/admin/support/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: selectedId,
          content: reply.trim(),
          senderRole: "AGENT",
        }),
      });
      if (res.ok) {
        setReply("");
        fetchConversations();
      }
    } catch (err) {
      createClientLogger("admin-support").error("Failed to send reply", { err: String(err) });
    } finally {
      setSending(false);
    }
  };

  const resolveConversation = async () => {
    if (!selectedId) return;
    try {
      const res = await fetch(`/api/admin/support/conversations/${selectedId}`, {
        method: "PATCH",
      });
      if (res.ok) {
        fetchConversations();
      }
    } catch (err) {
      createClientLogger("admin-support").error("Failed to resolve conversation", { err: String(err) });
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const filtered = conversations.filter((c) => c.status === filter);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "OPEN":
        return <Circle className="w-3 h-3 fill-warning text-warning" />;
      case "PENDING":
        return <Circle className="w-3 h-3 fill-warning text-warning" />;
      case "RESOLVED":
      case "CLOSED":
        return <CheckCircle className="w-3 h-3 text-success" />;
      default:
        return null;
    }
  };

  return (
    <div className="flex h-[calc(100vh-6rem)] gap-6">
      <div className="w-80 shrink-0 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold">Support Inbox</h1>
          <div className="flex gap-1">
            {(["OPEN", "PENDING", "RESOLVED"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 text-xs font-medium rounded-xl transition-colors ${
                  filter === f
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {f}: {conversations.filter((c) => c.status === f).length}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2">
          {loading && (
            <div className="text-center text-muted-foreground py-8 text-sm">
              Loading conversations...
            </div>
          )}
          {!loading && filtered.length === 0 && (
            <div className="text-center text-muted-foreground py-8 text-sm">
              No conversations
            </div>
          )}
          {filtered.map((conv) => (
            <button
              key={conv.id}
              onClick={() => setSelectedId(conv.id)}
              className={`w-full text-left p-3 rounded-2xl border transition-colors ${
                selectedId === conv.id
                  ? "bg-primary/10 border-primary/30"
                  : "bg-card border-border hover:bg-muted/50"
              }`}
            >
              <div className="flex items-center gap-2">
                {getStatusIcon(conv.status)}
                <span className="font-medium text-sm truncate">{conv.subject}</span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-muted-foreground">{conv.plan}</span>
                <span className="text-[10px] text-muted-foreground">{formatTime(conv.updatedAt)}</span>
              </div>
            </button>
          ))}
          {!loading && nextCursor && (
            <button
              type="button"
              onClick={() => fetchConversations(nextCursor)}
              disabled={loadingMore}
              className="w-full rounded-2xl border border-white/5 bg-card px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/50 disabled:opacity-50 transition-colors"
            >
              {loadingMore ? "Loading..." : "Load more"}
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col bg-card/60 backdrop-blur-2xl shadow-xl border border-white/5 rounded-2xl overflow-hidden">
        {selected ? (
          <>
            <div className="px-4 py-3 border-b border-white/5 bg-muted/30">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold">{selected.subject}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full">
                      {selected.plan}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {selected.userContext?.email as string}
                    </span>
                  </div>
                </div>
                {selected.status !== "RESOLVED" && selected.status !== "CLOSED" && (
                  <button
                    onClick={resolveConversation}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm bg-success/10 text-success rounded-xl hover:bg-success/20 transition-colors"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Mark Resolved
                  </button>
                )}
              </div>
            </div>

            <div className="px-4 py-2 bg-muted/20 border-b border-border/30">
              <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5">
                <span><span className="font-medium">Credits:</span> {selected.userContext?.credits != null ? String(selected.userContext.credits) : "—"}</span>
                <span><span className="font-medium">Page:</span> {selected.userContext?.currentPage ? String(selected.userContext.currentPage) : "—"}</span>
                {selected.userContext?.region != null && (
                  <span><span className="font-medium">Region:</span> {`${selected.userContext.region}`}</span>
                )}
                {selected.userContext?.watchlistCount != null && (
                  <span><span className="font-medium">Watchlist:</span> {String(selected.userContext.watchlistCount)} assets</span>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {selected.messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.senderRole === "USER" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[70%] px-3 py-2 rounded-2xl text-sm ${
                      msg.senderRole === "USER"
                        ? "bg-primary/15 border border-primary/20"
                        : "bg-muted/60 border border-border/30"
                    }`}
                  >
                    {msg.senderRole === "AGENT" && msg.senderId === "AI_ASSISTANT" && (
                      <span className="flex items-center gap-1 text-[10px] text-primary/70 mb-1 font-medium">
                        <Sparkles className="w-2.5 h-2.5" />
                        AI Auto-Reply
                      </span>
                    )}
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                    <span className="text-[10px] text-muted-foreground mt-1 block">
                      {msg.senderRole === "USER" ? "User" : msg.senderId === "AI_ASSISTANT" ? "AI" : "Agent"} • {formatTime(msg.createdAt)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {selected.status !== "RESOLVED" && selected.status !== "CLOSED" && (
              <div className="p-3 border-t border-white/5 bg-muted/20">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendReply()}
                    placeholder="Reply to user..."
                    className="flex-1 bg-background border border-white/5 rounded-2xl px-3 py-2 text-sm focus:outline-none focus:border-primary/50"
                  />
                  <button
                    onClick={sendReply}
                    disabled={!reply.trim() || sending}
                    className="p-2 bg-primary text-primary-foreground rounded-2xl hover:bg-primary/90 disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Select a conversation</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
