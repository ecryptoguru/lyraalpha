"use client";

import { applyOptimisticCreditDelta, revalidateCreditViews, setAuthoritativeCreditBalance } from "@/lib/credits/client";
import { parseLyraMessage, type Source } from "@/lib/lyra-utils";
import { createClientLogger } from "@/lib/logger/client";
import { sanitizeError } from "@/lib/logger/utils";

const logger = createClientLogger("lyra-chat");

// ─── Error surface ───────────────────────────────────────────────────────────
// The previous `catch {}` silently replaced every failure with a generic
// "An error occurred" string, hiding rate limits, credit exhaustion, guardrail
// rejections, auth failures, and network issues behind the same message. We now
// parse the server response body (when structured) and categorise errors so the
// UI can render a meaningful reason and, where relevant, a recovery CTA.

export type ChatErrorKind =
  | "auth"
  | "rate_limit"
  | "credits"
  | "guardrail"
  | "server"
  | "network"
  | "unknown";

class ChatApiError extends Error {
  readonly kind: ChatErrorKind;
  readonly status: number;
  readonly retryAfterSec?: number;

  constructor(
    message: string,
    kind: ChatErrorKind,
    status: number,
    retryAfterSec?: number,
  ) {
    super(message);
    this.name = "ChatApiError";
    this.kind = kind;
    this.status = status;
    this.retryAfterSec = retryAfterSec;
  }
}

interface ApiErrorBody {
  error?: string;
  reason?: string;
  kind?: string;
  resetAt?: string | null;
}

async function parseApiError(response: Response): Promise<ChatApiError> {
  // Best-effort body parse — some error paths (e.g. network proxies) return no JSON.
  let body: ApiErrorBody | null = null;
  try {
    const text = await response.text();
    body = text ? (JSON.parse(text) as ApiErrorBody) : null;
  } catch {
    body = null;
  }

  const retryHeader = response.headers.get("Retry-After");
  const retryFromHeader = retryHeader ? Number(retryHeader) : NaN;
  const retryFromBody = body?.resetAt
    ? Math.max(1, Math.ceil((new Date(body.resetAt).getTime() - Date.now()) / 1000))
    : NaN;
  const retryAfterSec = Number.isFinite(retryFromHeader)
    ? retryFromHeader
    : Number.isFinite(retryFromBody)
    ? retryFromBody
    : undefined;

  const serverMessage = body?.reason || body?.error;

  if (response.status === 401) {
    return new ChatApiError(
      "You need to sign in to chat with Lyra. Please refresh and sign in again.",
      "auth",
      401,
    );
  }
  if (response.status === 429) {
    // Server distinguishes rate-limit (no body.kind) vs credit/token exhaustion (kind set).
    const kind: ChatErrorKind = body?.kind === "credits" || body?.kind === "daily-tokens"
      ? "credits"
      : "rate_limit";
    const defaultMsg = kind === "credits"
      ? "You're out of credits for this period. Top up or upgrade to keep chatting."
      : "You're sending messages faster than Lyra can answer. Give it a moment.";
    return new ChatApiError(serverMessage || defaultMsg, kind, 429, retryAfterSec);
  }
  if (response.status === 400) {
    return new ChatApiError(
      serverMessage || "Lyra couldn't handle that request. Try rephrasing.",
      "guardrail",
      400,
    );
  }
  return new ChatApiError(
    serverMessage || "Lyra ran into a problem answering that. Please try again.",
    "server",
    response.status,
    retryAfterSec,
  );
}

function formatRetry(sec?: number): string {
  if (!sec || sec <= 0) return "";
  if (sec < 60) return ` Try again in ${sec}s.`;
  const mins = Math.ceil(sec / 60);
  return ` Try again in ~${mins} min.`;
}

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

    // Optimistically deduct 1 credit (minimum query cost) so the UI updates instantly.
    // The server response will correct this via X-Credits-Remaining header.
    void applyOptimisticCreditDelta(-1);

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
        throw await parseApiError(response);
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
      const throttleMs = 16; // Reduced from 48ms to 16ms (~60fps) for smoother streaming

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
    } catch (error) {
      // Refund the optimistic deduction since the request failed.
      // NOTE: for `credits` errors the server rejected before deducting, so
      // the refund is correct. For server errors after partial processing the
      // authoritative X-Credits-Remaining header would have corrected anyway.
      void applyOptimisticCreditDelta(1);
      void revalidateCreditViews();

      // Classify and surface the actual failure reason instead of a generic string.
      let message: string;
      if (error instanceof ChatApiError) {
        message = error.message + formatRetry(error.retryAfterSec);
      } else if (
        error instanceof TypeError
        && /fetch|network|load failed/i.test(error.message)
      ) {
        message = "Can't reach Lyra — check your connection and try again.";
      } else {
        message = "Lyra ran into a problem answering that. Please try again.";
      }

      // Log the underlying error for debugging. The user sees the human-readable message above.
      logger.error("Chat request failed", { error: sanitizeError(error) });

      // Drop the empty assistant placeholder if one was added before the failure.
      const cleanedMessages = this.snapshot.messages.filter(
        (m) => !(m.role === "assistant" && m.content === ""),
      );

      this.snapshot = {
        ...this.snapshot,
        messages: cleanedMessages,
        error: message,
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
