"use client";

import { revalidateCreditViews, setAuthoritativeCreditBalance } from "@/lib/credits/client";
import { parseLyraMessage, type Source } from "@/lib/lyra-utils";

function uid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export interface LyraChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  relatedQuestions?: string[];
  contextTruncated?: boolean;
}

interface PersistedLyraChatState {
  input: string;
  messages: LyraChatMessage[];
  cacheScope: string;
}

export interface LyraChatSnapshot extends PersistedLyraChatState {
  isLoading: boolean;
  loadingStartTime: number | null;
  error: string | null;
  rateLimitRemaining: number | null;
}

interface SendLyraMessageParams {
  content: string;
  symbol: string;
  contextData: Record<string, unknown>;
}

interface HistorySessionItem {
  inputQuery: string;
  outputResponse: string;
}

type Listener = (snapshot: LyraChatSnapshot) => void;

const controllerRegistry = new Map<string, LyraChatSessionController>();
const SESSION_KEY_PREFIX = "lyra-chat-session:";

function createCacheScope() {
  return `session-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function getStorageKey(userId: string) {
  return `${SESSION_KEY_PREFIX}${userId}`;
}

function isValidMessage(value: unknown): value is LyraChatMessage {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<LyraChatMessage>;
  return (
    typeof candidate.id === "string" &&
    (candidate.role === "user" || candidate.role === "assistant") &&
    typeof candidate.content === "string"
  );
}

function normalizeMessages(messages: unknown): LyraChatMessage[] {
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages.filter(isValidMessage).map((message) => ({
    ...message,
    sources: Array.isArray(message.sources) ? message.sources : [],
    relatedQuestions: Array.isArray(message.relatedQuestions) ? message.relatedQuestions : [],
  }));
}

function readPersistedState(userId: string): PersistedLyraChatState | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(getStorageKey(userId));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<PersistedLyraChatState>;
    return {
      input: typeof parsed.input === "string" ? parsed.input : "",
      messages: normalizeMessages(parsed.messages),
      cacheScope: typeof parsed.cacheScope === "string" && parsed.cacheScope.length > 0 ? parsed.cacheScope : createCacheScope(),
    };
  } catch {
    // Corrupted or outdated session data — discard silently
    return null;
  }
}

function writePersistedState(userId: string, state: PersistedLyraChatState) {
  if (typeof window === "undefined") {
    return;
  }

  if (!state.input.trim() && state.messages.length === 0) {
    window.sessionStorage.removeItem(getStorageKey(userId));
    return;
  }

  window.sessionStorage.setItem(getStorageKey(userId), JSON.stringify(state));
}

export function clearPersistedLyraChat(userId: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(getStorageKey(userId));
}

export function clearAllPersistedLyraChats() {
  if (typeof window === "undefined") {
    return;
  }

  const keysToRemove: string[] = [];
  for (let index = 0; index < window.sessionStorage.length; index += 1) {
    const key = window.sessionStorage.key(index);
    if (key?.startsWith(SESSION_KEY_PREFIX)) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach((key) => window.sessionStorage.removeItem(key));
}

class LyraChatSessionController {
  private snapshot: LyraChatSnapshot = {
    input: "",
    messages: [],
    cacheScope: createCacheScope(),
    isLoading: false,
    loadingStartTime: null,
    error: null,
    rateLimitRemaining: null,
  };

  private readonly listeners = new Set<Listener>();
  private hydrated = false;

  constructor(private readonly userId: string) {}

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getSnapshot() {
    return this.snapshot;
  }

  setInput(input: string) {
    this.snapshot = {
      ...this.snapshot,
      input,
    };
    this.persist();
    this.emit();
  }

  clearSession() {
    this.snapshot = {
      input: "",
      messages: [],
      cacheScope: createCacheScope(),
      isLoading: false,
      loadingStartTime: null,
      error: null,
      rateLimitRemaining: null,
    };
    this.persist();
    this.emit();
  }

  loadHistorySession(item: HistorySessionItem) {
    this.snapshot = {
      ...this.snapshot,
      input: "",
      cacheScope: createCacheScope(),
      error: null,
      messages: [
        { id: uid(), role: "user", content: item.inputQuery },
        {
          id: uid(),
          role: "assistant",
          content: item.outputResponse,
          sources: [],
          relatedQuestions: [],
        },
      ],
    };
    this.persist();
    this.emit();
  }

  async sendMessage({ content, symbol, contextData }: SendLyraMessageParams) {
    const trimmedContent = content.trim();
    if (!trimmedContent || this.snapshot.isLoading) {
      return;
    }

    const userMessage: LyraChatMessage = {
      id: uid(),
      role: "user",
      content: trimmedContent,
    };

    const requestMessages = [...this.snapshot.messages, userMessage];

    this.snapshot = {
      ...this.snapshot,
      input: "",
      messages: requestMessages,
      isLoading: true,
      loadingStartTime: Date.now(),
      error: null,
    };
    this.persist();
    this.emit();

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: requestMessages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
          contextData,
          symbol,
          cacheScope: this.snapshot.cacheScope,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      const remaining = response.headers.get("X-RateLimit-Remaining");
      if (remaining !== null) {
        this.snapshot = {
          ...this.snapshot,
          rateLimitRemaining: Number(remaining),
        };
      }

      const creditsRemaining = response.headers.get("X-Credits-Remaining");
      if (creditsRemaining !== null) {
        const nextCredits = Number(creditsRemaining);
        if (Number.isFinite(nextCredits)) {
          void setAuthoritativeCreditBalance(nextCredits);
          void revalidateCreditViews();
        }
      }

      let headerSources: Source[] = [];
      const sourcesHeader = response.headers.get("X-Lyra-Sources");
      if (sourcesHeader) {
        try {
          headerSources = JSON.parse(decodeURIComponent(sourcesHeader));
        } catch {
          // Malformed sources header — fall back to empty
          headerSources = [];
        }
      }

      const contextTruncated = response.headers.get("X-Context-Truncated") === "true";

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No response body");
      }

      const decoder = new TextDecoder();
      let assistantMessage = "";
      const assistantMessageId = uid();

      this.snapshot = {
        ...this.snapshot,
        messages: [
          ...this.snapshot.messages,
          {
            id: assistantMessageId,
            role: "assistant",
            content: "",
            sources: [],
            relatedQuestions: [],
          },
        ],
      };
      this.persist();
      this.emit();

      let lastUpdateTime = 0;
      const throttleMs = 48;

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        assistantMessage += decoder.decode(value, { stream: true });
        const now = Date.now();
        if (now - lastUpdateTime > throttleMs) {
          this.snapshot = {
            ...this.snapshot,
            messages: this.snapshot.messages.map((message) =>
              message.id === assistantMessageId
                ? { ...message, content: assistantMessage }
                : message,
            ),
          };
          this.emit();
          lastUpdateTime = now;
        }
      }

      assistantMessage += decoder.decode();
      const parsed = parseLyraMessage(assistantMessage);
      this.snapshot = {
        ...this.snapshot,
        messages: this.snapshot.messages.map((message) =>
          message.id === assistantMessageId
            ? {
                ...message,
                content: parsed.text,
                sources: headerSources.length > 0 ? headerSources : parsed.sources,
                relatedQuestions: parsed.relatedQuestions,
                contextTruncated,
              }
            : message,
        ),
      };
    } catch {
      this.snapshot = {
        ...this.snapshot,
        error: "An error occurred. Please try again.",
      };
    } finally {
      this.snapshot = {
        ...this.snapshot,
        isLoading: false,
        loadingStartTime: null,
      };
      this.persist();
      this.emit();
    }
  }

  private hydrate() {
    if (this.hydrated) {
      return;
    }

    const persisted = readPersistedState(this.userId);
    if (persisted) {
      this.snapshot = {
        ...this.snapshot,
        ...persisted,
      };
    }
    this.hydrated = true;
  }

  private persist() {
    writePersistedState(this.userId, {
      input: this.snapshot.input,
      messages: this.snapshot.messages,
      cacheScope: this.snapshot.cacheScope,
    });
  }

  private emit() {
    for (const listener of this.listeners) {
      listener(this.snapshot);
    }
  }
}

export function getLyraChatSessionController(userId: string) {
  const existing = controllerRegistry.get(userId);
  if (existing) {
    return existing;
  }

  const controller = new LyraChatSessionController(userId);
  controller["hydrate"]();
  controllerRegistry.set(userId, controller);
  return controller;
}
