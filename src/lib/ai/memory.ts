import { generateText } from "ai";
import { prisma } from "@/lib/prisma";
import { getSharedAISdkClient, getGpt54Deployment } from "./config";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { redis, setCache } from "@/lib/redis";
import { logMemoryEvent } from "./monitoring";

const logger = createLogger({ service: "lyra-memory" });

// ─── Constants ────────────────────────────────────────────────────────────────

const MEMORY_TIMEOUT_MS = 15_000;  // 15s — non-blocking so generous; abort guard prevents hangs
const MAX_GLOBAL_NOTES = 12;       // Hard cap per user per source — prevents unbounded growth
const MAX_SESSION_NOTES = 6;       // Staging area cap per session
const MAX_NOTE_LENGTH = 150;       // chars — enforced before DB write

export type MemorySource = "lyra" | "myra";
export type MemoryScope = "global" | "session";

type MemoryNote = {
  text: string;
  keywords: string[];
};

// Resolve client + deployment once at module load — avoids re-instantiation on every nano call.
// Both distillation and consolidation share the same nano deployment.
const _getNanoModel = (() => {
  let cached: ReturnType<ReturnType<typeof getSharedAISdkClient>> | null = null;
  return () => {
    if (!cached) {
      const client = getSharedAISdkClient();
      cached = client(getGpt54Deployment("lyra-nano"));
    }
    return cached;
  };
})();

// ─── Combined distill + consolidate prompt ────────────────────────────────────
// Single nano call: extracts new durable notes AND merges with existing global notes.
// Eliminates the previous 2-call sequential pattern — saves one round-trip per session.

function buildCombinedPrompt(
  conversationText: string,
  globalNotes: MemoryNote[],
  source: MemorySource,
): string {
  const maxNew = source === "lyra" ? 5 : 5;
  const sourceLabel = source === "lyra" ? "financial analysis" : "platform support";
  return `You are updating a user's long-term memory from a ${sourceLabel} conversation.

STEP 1 — Extract 0–${maxNew} NEW durable memory notes from the conversation below.
STEP 2 — Merge the new notes with the existing GLOBAL_NOTES, producing a final updated list.

EXTRACTION RULES (Step 1):
- Only extract DURABLE signals that would help personalize FUTURE sessions.
- EXCLUDE anything session-specific ("this time", "right now", "today", "currently").
${source === "lyra" ? `- Include: asset preferences, risk signals, expertise level, analysis style preferences.
- Exclude: price predictions or financial advice.` : `- Include: feature/plan friction, workflow preferences, recurring support topics.
- Exclude: one-off resolved issues, sensitive personal information.`}

MERGE RULES (Step 2):
- Deduplicate: merge near-identical notes into one canonical note.
- Conflict resolution: if notes conflict, keep the more recent signal.
- Drop session-only / ephemeral content even if it appears in GLOBAL_NOTES.
- Keep each note SHORT (1 sentence, max 150 chars), specific, and durable.
- HARD CAP: return at most ${MAX_GLOBAL_NOTES} notes total.
- Do NOT invent facts — only use what appears in the conversation or GLOBAL_NOTES.

EXISTING GLOBAL_NOTES:
${JSON.stringify(globalNotes)}

CONVERSATION (last turns):
${conversationText}

OUTPUT FORMAT (STRICT): Return ONLY a valid JSON array. No markdown, no code fences, no commentary.
Each element MUST have exactly these keys: {"text": string, "keywords": [string]}
If no durable notes exist (new or old), return: []`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function safeParseNotes(raw: string): MemoryNote[] {
  try {
    const cleaned = raw.trim().replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((n): n is MemoryNote =>
        n && typeof n.text === "string" && Array.isArray(n.keywords),
      )
      .map((n) => ({
        text: n.text.slice(0, MAX_NOTE_LENGTH),
        keywords: n.keywords.filter((k: unknown) => typeof k === "string").slice(0, 8),
      }));
  } catch {
    return [];
  }
}

// Source-aware assistant label — Myra sessions must not be labeled "Lyra"
function messagesToText(
  messages: Array<{ role: string; content: unknown }>,
  source: MemorySource,
): string {
  const assistantLabel = source === "lyra" ? "Lyra" : "Myra";
  return messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => {
      const content = typeof m.content === "string" ? m.content : JSON.stringify(m.content);
      return `${m.role === "user" ? "User" : assistantLabel}: ${content.slice(0, 400)}`;
    })
    .join("\n");
}

async function callNano(prompt: string): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), MEMORY_TIMEOUT_MS);
  try {
    const result = await generateText({
      model: _getNanoModel(),
      prompt,
      maxOutputTokens: 500,
      abortSignal: controller.signal,
    });
    return result.text ?? "";
  } finally {
    clearTimeout(timeoutId);
  }
}

// ─── Distillation + Consolidation (single nano call) ─────────────────────────

/**
 * Extract durable notes from session messages and merge them into global memory.
 * Single nano call (combined distill + consolidate) — previously two sequential calls.
 * Fires async, non-blocking — call with .catch(() => {}).
 * Gated: real Clerk IDs only, ≥4 user messages.
 * R5: Caller is responsible for debouncing (multiples-of-4 gate in service.ts).
 * R8: Distributed Redis lock prevents concurrent write races.
 */
export async function distillSessionNotes(
  userId: string,
  messages: Array<{ role: string; content: unknown }>,
  source: MemorySource,
): Promise<void> {
  if (!userId.startsWith("user_")) return;
  const userMessages = messages.filter((m) => m.role === "user");
  if (userMessages.length < 4) return;

  // R8: Distributed lock — prevents concurrent distillation races when two rapid responses
  // both qualify. Uses SET NX (set-if-not-exists) for true mutual exclusion.
  // Plain setCache always overwrites and cannot detect a pre-existing key.
  // TTL=90s covers worst-case: DB read + nano call (15s timeout) + transaction write.
  const lockKey = `memory:distill:${userId}:${source}`;
  let lockAcquired = false;
  try {
    const nx = await (redis as unknown as { set(k: string, v: string, opts: { nx: boolean; ex: number }): Promise<string | null> })
      .set(lockKey, "1", { nx: true, ex: 90 });
    lockAcquired = nx === "OK";
  } catch {
    lockAcquired = true; // Redis unavailable — allow through, worst case is a duplicate write
  }
  if (!lockAcquired) {
    logger.debug({ userId, source }, "Memory distillation skipped — lock held by concurrent call");
    logMemoryEvent({ userId, source, outcome: "locked" });
    return;
  }

  const distillStart = Date.now();
  try {
    // Fetch existing global notes to include in the combined prompt
    const globalRows = await prisma.userMemoryNote.findMany({
      where: { userId, source, scope: "global" },
      orderBy: { updatedAt: "desc" },
      take: MAX_GLOBAL_NOTES,
    });
    const globalNotes: MemoryNote[] = globalRows.map((r) => ({ text: r.text, keywords: r.keywords }));

    const conversationText = messagesToText(messages.slice(-16), source);
    const prompt = buildCombinedPrompt(conversationText, globalNotes, source);
    const raw = await callNano(prompt);
    const updatedNotes = safeParseNotes(raw);

    if (updatedNotes.length === 0 && globalNotes.length === 0) {
      logger.debug({ userId, source }, "Memory: no durable notes extracted or retained");
      logMemoryEvent({ userId, source, outcome: "skipped_empty", latencyMs: Date.now() - distillStart });
      return;
    }

    // If parse failed entirely (empty result) but we had global notes, retain existing
    if (updatedNotes.length === 0 && globalNotes.length > 0) {
      logger.warn({ userId, source }, "Memory: nano returned empty — retaining existing global notes");
      logMemoryEvent({ userId, source, outcome: "retained_existing", noteCount: globalNotes.length, latencyMs: Date.now() - distillStart });
      return;
    }

    // Replace global notes atomically — single transaction, no intermediate session rows needed
    await prisma.$transaction([
      prisma.userMemoryNote.deleteMany({ where: { userId, source, scope: "global" } }),
      prisma.userMemoryNote.deleteMany({ where: { userId, source, scope: "session" } }),
      ...updatedNotes.map((note) =>
        prisma.userMemoryNote.create({
          data: { userId, source, scope: "global", text: note.text, keywords: note.keywords },
        }),
      ),
    ]);

    logMemoryEvent({ userId, source, outcome: "updated", noteCount: updatedNotes.length, latencyMs: Date.now() - distillStart });
    logger.info({ userId, source, notes: updatedNotes.length }, "Memory: global notes updated");
  } catch (err) {
    logMemoryEvent({ userId, source, outcome: "failed", latencyMs: Date.now() - distillStart });
    logger.warn({ err: sanitizeError(err), userId, source }, "Memory distillation failed — skipping");
  } finally {
    // Release lock after work completes (TTL=60s is the safety net if this never fires)
    setCache(lockKey, "", 1).catch(() => {});
  }
}

// ─── Retrieval ────────────────────────────────────────────────────────────────

/**
 * Returns global notes as a compact bullet string for [USER_PROFILE] injection.
 * Fast DB read, no LLM call. Returns "" if none exist or userId is invalid.
 */
export async function getGlobalNotes(userId: string, source: MemorySource): Promise<string> {
  if (!userId.startsWith("user_")) return "";
  try {
    const rows = await prisma.userMemoryNote.findMany({
      where: { userId, source, scope: "global" },
      orderBy: { updatedAt: "desc" },
      take: MAX_GLOBAL_NOTES,
    });
    if (rows.length === 0) return "";
    return rows.map((r) => `- ${r.text}`).join("\n");
  } catch (err) {
    logger.warn({ err: sanitizeError(err), userId, source }, "getGlobalNotes failed");
    return "";
  }
}

/**
 * Returns session notes as a compact bullet string for [SESSION_CONTEXT] injection.
 * Fast DB read, no LLM call. Returns "" if none exist or userId is invalid.
 * NOTE: With the combined distill+consolidate flow, session rows are cleared after each
 * distillation. Kept for backward compatibility and manually staged session notes.
 */
export async function getSessionNotes(userId: string, source: MemorySource): Promise<string> {
  if (!userId.startsWith("user_")) return "";
  try {
    const rows = await prisma.userMemoryNote.findMany({
      where: { userId, source, scope: "session" },
      orderBy: { updatedAt: "desc" },
      take: MAX_SESSION_NOTES,
    });
    if (rows.length === 0) return "";
    return rows.map((r) => `- ${r.text}`).join("\n");
  } catch (err) {
    logger.warn({ err: sanitizeError(err), userId, source }, "getSessionNotes failed");
    return "";
  }
}

// consolidateMemory is kept as a no-op export for any external callers — logic is now
// inlined into distillSessionNotes as the combined single-call pattern.
export async function consolidateMemory(_userId: string, _source: MemorySource): Promise<void> {
  void _userId;
  void _source;
  // No-op: consolidation is now part of distillSessionNotes (single nano call).
}
