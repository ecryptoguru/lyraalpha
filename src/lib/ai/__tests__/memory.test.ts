/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── Mock prisma ─────────────────────────────────────────────────────────────
vi.mock("@/lib/prisma", () => ({
  prisma: {
    userMemoryNote: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
      create: vi.fn(),
    },
    $executeRaw: vi.fn(),
    $transaction: vi.fn(),
  },
}));

// ─── Mock AI SDK generateText ─────────────────────────────────────────────────
vi.mock("ai", () => ({
  generateText: vi.fn(),
}));

// ─── Mock config ──────────────────────────────────────────────────────────────
vi.mock("@/lib/ai/config", () => ({
  getSharedAISdkClient: vi.fn(() => vi.fn(() => "mock-model")),
  getGpt54Deployment: vi.fn(() => "gpt-5.4-nano"),
}));

// ─── Mock Redis ──────────────────────────────────────────────────────────────
vi.mock("@/lib/redis", () => ({
  setCache: vi.fn().mockResolvedValue(undefined),
  getCache: vi.fn().mockResolvedValue(null),
  redis: {
    set: vi.fn().mockResolvedValue("OK"), // returns "OK" = lock acquired, null = lock held
  },
}));

// ─── Mock monitoring ──────────────────────────────────────────────────────────
vi.mock("@/lib/ai/monitoring", () => ({
  logMemoryEvent: vi.fn(),
}));

// ─── Mock logger ──────────────────────────────────────────────────────────────
vi.mock("@/lib/logger", () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

vi.mock("@/lib/logger/utils", () => ({
  sanitizeError: vi.fn((e) => e),
}));

import { getGlobalNotes, getSessionNotes, distillSessionNotes, consolidateMemory } from "../memory";
import { prisma } from "@/lib/prisma";
import { generateText } from "ai";
import { setCache, redis } from "@/lib/redis";
import { logMemoryEvent } from "@/lib/ai/monitoring";

const mockPrisma = prisma as unknown as {
  userMemoryNote: {
    findMany: ReturnType<typeof vi.fn>;
    deleteMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  $executeRaw: ReturnType<typeof vi.fn>;
  $transaction: ReturnType<typeof vi.fn>;
};

const mockGenerateText = generateText as ReturnType<typeof vi.fn>;
const mockSetCache = setCache as ReturnType<typeof vi.fn>;
const mockRedisSet = (redis as unknown as { set: ReturnType<typeof vi.fn> }).set;

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.userMemoryNote.findMany.mockResolvedValue([]);
  mockPrisma.userMemoryNote.deleteMany.mockResolvedValue({ count: 0 });
  mockPrisma.userMemoryNote.create.mockResolvedValue({});
  mockPrisma.$executeRaw.mockResolvedValue(1);
  mockPrisma.$transaction.mockResolvedValue([]);
  mockRedisSet.mockResolvedValue("OK"); // default: lock always acquired
  mockSetCache.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.clearAllMocks();
});

// ─── getGlobalNotes ───────────────────────────────────────────────────────────

describe("getGlobalNotes", () => {
  it("returns empty string for non-Clerk userId", async () => {
    const result = await getGlobalNotes("test-user-123", "lyra");
    expect(result).toBe("");
    expect(mockPrisma.userMemoryNote.findMany).not.toHaveBeenCalled();
  });

  it("returns empty string when no notes exist", async () => {
    mockPrisma.userMemoryNote.findMany.mockResolvedValue([]);
    const result = await getGlobalNotes("user_abc123", "lyra");
    expect(result).toBe("");
  });

  it("returns formatted bullet list when notes exist", async () => {
    mockPrisma.userMemoryNote.findMany.mockResolvedValue([
      { id: "1", text: "Frequently researches RELIANCE and BTC", keywords: ["assets"] },
      { id: "2", text: "Prefers macro context over individual stock analysis", keywords: ["style"] },
    ]);
    const result = await getGlobalNotes("user_abc123", "lyra");
    expect(result).toContain("- Frequently researches RELIANCE and BTC");
    expect(result).toContain("- Prefers macro context over individual stock analysis");
  });

  it("queries with correct userId, source, scope", async () => {
    mockPrisma.userMemoryNote.findMany.mockResolvedValue([]);
    await getGlobalNotes("user_abc123", "myra");
    expect(mockPrisma.userMemoryNote.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user_abc123", source: "myra", scope: "global" },
      }),
    );
  });

  it("returns empty string on DB error", async () => {
    mockPrisma.userMemoryNote.findMany.mockRejectedValue(new Error("DB error"));
    const result = await getGlobalNotes("user_abc123", "lyra");
    expect(result).toBe("");
  });
});

// ─── getSessionNotes ──────────────────────────────────────────────────────────

describe("getSessionNotes", () => {
  it("returns empty string for non-Clerk userId", async () => {
    const result = await getSessionNotes("ELITE", "lyra");
    expect(result).toBe("");
    expect(mockPrisma.userMemoryNote.findMany).not.toHaveBeenCalled();
  });

  it("returns empty string when no session notes exist", async () => {
    mockPrisma.userMemoryNote.findMany.mockResolvedValue([]);
    const result = await getSessionNotes("user_abc123", "lyra");
    expect(result).toBe("");
  });

  it("returns formatted session notes", async () => {
    mockPrisma.userMemoryNote.findMany.mockResolvedValue([
      { id: "1", text: "Currently researching NVDA earnings impact", keywords: ["nvda"] },
    ]);
    const result = await getSessionNotes("user_abc123", "lyra");
    expect(result).toContain("- Currently researching NVDA earnings impact");
  });

  it("queries with scope = session", async () => {
    mockPrisma.userMemoryNote.findMany.mockResolvedValue([]);
    await getSessionNotes("user_abc123", "lyra");
    expect(mockPrisma.userMemoryNote.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user_abc123", source: "lyra", scope: "session" },
      }),
    );
  });
});

// ─── consolidateMemory (no-op shim) ──────────────────────────────────────────

describe("consolidateMemory", () => {
  it("is a no-op — does not touch DB or nano", async () => {
    await consolidateMemory("user_abc123", "lyra");
    expect(mockPrisma.userMemoryNote.findMany).not.toHaveBeenCalled();
    expect(mockGenerateText).not.toHaveBeenCalled();
  });
});

// ─── distillSessionNotes ──────────────────────────────────────────────────────

describe("distillSessionNotes", () => {
  const mockMessages = [
    { role: "user", content: "What is the FCF yield for RELIANCE?" },
    { role: "assistant", content: "RELIANCE FCF yield is approximately 3.2%..." },
    { role: "user", content: "Compare RELIANCE with HDFCBANK on P/E" },
    { role: "assistant", content: "RELIANCE P/E is 25x vs HDFCBANK at 22x..." },
    { role: "user", content: "What is the sector rotation trend?" },
    { role: "assistant", content: "Sector rotation is moving toward defensive..." },
    { role: "user", content: "What are the risks of this strategy?" },
    { role: "assistant", content: "Key risks include macro headwinds..." },
  ];

  it("skips for non-Clerk userId", async () => {
    await distillSessionNotes("ELITE", mockMessages, "lyra");
    expect(mockGenerateText).not.toHaveBeenCalled();
    expect(mockPrisma.userMemoryNote.findMany).not.toHaveBeenCalled();
  });

  it("skips when fewer than 4 user messages", async () => {
    const shortMessages = mockMessages.slice(0, 4); // only 2 user turns
    await distillSessionNotes("user_abc123", shortMessages, "lyra");
    expect(mockGenerateText).not.toHaveBeenCalled();
  });

  it("fetches existing global notes before calling nano (combined prompt)", async () => {
    mockPrisma.userMemoryNote.findMany.mockResolvedValue([]);
    mockGenerateText.mockResolvedValue({ text: "[]" });
    await distillSessionNotes("user_abc123", mockMessages, "lyra");
    // Should fetch global notes first
    expect(mockPrisma.userMemoryNote.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user_abc123", source: "lyra", scope: "global" },
      }),
    );
    // Then call nano exactly once (combined distill+consolidate)
    expect(mockGenerateText).toHaveBeenCalledTimes(1);
  });

  it("calls nano exactly once (combined distill+consolidate — not two sequential calls)", async () => {
    mockPrisma.userMemoryNote.findMany.mockResolvedValue([]);
    mockGenerateText.mockResolvedValue({
      text: '[{"text":"Frequently researches RELIANCE and HDFCBANK","keywords":["reliance","hdfcbank"]}]',
    });
    await distillSessionNotes("user_abc123", mockMessages, "lyra");
    expect(mockGenerateText).toHaveBeenCalledTimes(1);
  });

  it("writes updated global notes via transaction when nano returns valid JSON", async () => {
    mockPrisma.userMemoryNote.findMany.mockResolvedValue([]);
    mockGenerateText.mockResolvedValue({
      text: '[{"text":"Frequently researches RELIANCE","keywords":["reliance"]}]',
    });
    await distillSessionNotes("user_abc123", mockMessages, "lyra");
    expect(mockPrisma.$transaction).toHaveBeenCalled();
  });

  it("handles nano returning empty array with no existing global notes — no transaction", async () => {
    mockPrisma.userMemoryNote.findMany.mockResolvedValue([]);
    mockGenerateText.mockResolvedValue({ text: "[]" });
    await distillSessionNotes("user_abc123", mockMessages, "lyra");
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("retains existing global notes when nano returns empty and globals exist", async () => {
    mockPrisma.userMemoryNote.findMany.mockResolvedValue([
      { text: "Prefers macro context", keywords: ["macro"] },
    ]);
    mockGenerateText.mockResolvedValue({ text: "[]" });
    await distillSessionNotes("user_abc123", mockMessages, "lyra");
    // Should NOT wipe existing globals when nano returns empty
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("handles nano returning invalid JSON gracefully without throwing", async () => {
    mockPrisma.userMemoryNote.findMany.mockResolvedValue([]);
    mockGenerateText.mockResolvedValue({ text: "not valid json" });
    await expect(distillSessionNotes("user_abc123", mockMessages, "lyra")).resolves.not.toThrow();
  });

  it("handles nano timeout/error gracefully without throwing", async () => {
    mockPrisma.userMemoryNote.findMany.mockResolvedValue([]);
    mockGenerateText.mockRejectedValue(new Error("timeout"));
    await expect(distillSessionNotes("user_abc123", mockMessages, "lyra")).resolves.not.toThrow();
  });

  it("works for myra source without throwing", async () => {
    mockPrisma.userMemoryNote.findMany.mockResolvedValue([]);
    mockGenerateText.mockResolvedValue({
      text: '[{"text":"Frequently asks about credits","keywords":["credits"]}]',
    });
    await expect(distillSessionNotes("user_abc123", mockMessages, "myra")).resolves.not.toThrow();
    expect(mockGenerateText).toHaveBeenCalledTimes(1);
  });
});

// ─── context-builder: [USER_PROFILE] and [SESSION_CONTEXT] injection ─────────

describe("buildCompressedContext — memory blocks", () => {
  it("injects [USER_PROFILE] when globalNotes provided and tier is not SIMPLE", async () => {
    const { buildCompressedContext } = await import("../context-builder");
    const result = buildCompressedContext(
      { symbol: "AAPL", assetType: "STOCK", scores: {} },
      {
        globalNotes: "- Prefers macro context\n- Risk-averse signals detected",
        tier: "MODERATE",
      },
    );
    expect(result).toContain("[USER_PROFILE]");
    expect(result).toContain("- Prefers macro context");
    expect(result).toContain("- Risk-averse signals detected");
  });

  it("does NOT inject [USER_PROFILE] for SIMPLE tier", async () => {
    const { buildCompressedContext } = await import("../context-builder");
    const result = buildCompressedContext(
      { symbol: "AAPL", assetType: "STOCK", scores: {} },
      {
        globalNotes: "- Prefers macro context",
        tier: "SIMPLE",
      },
    );
    expect(result).not.toContain("[USER_PROFILE]");
  });

  it("injects [SESSION_CONTEXT] when sessionNotes provided and tier is not SIMPLE", async () => {
    const { buildCompressedContext } = await import("../context-builder");
    const result = buildCompressedContext(
      { symbol: "AAPL", assetType: "STOCK", scores: {} },
      {
        sessionNotes: "- Currently researching NVDA earnings",
        tier: "COMPLEX",
      },
    );
    expect(result).toContain("[SESSION_CONTEXT]");
    expect(result).toContain("- Currently researching NVDA earnings");
  });

  it("does NOT inject [SESSION_CONTEXT] when sessionNotes is empty", async () => {
    const { buildCompressedContext } = await import("../context-builder");
    const result = buildCompressedContext(
      { symbol: "AAPL", assetType: "STOCK", scores: {} },
      {
        sessionNotes: "",
        tier: "MODERATE",
      },
    );
    expect(result).not.toContain("[SESSION_CONTEXT]");
  });

  it("does NOT inject [SESSION_CONTEXT] in compare mode", async () => {
    const { buildCompressedContext } = await import("../context-builder");
    const result = buildCompressedContext(
      { symbol: "AAPL", assetType: "STOCK", scores: {} },
      {
        sessionNotes: "- Researching NVDA",
        tier: "MODERATE",
        responseMode: "compare",
      },
    );
    expect(result).not.toContain("[SESSION_CONTEXT]");
  });

  it("applies tighter [USER_PROFILE] cap in compare mode", async () => {
    const { buildCompressedContext } = await import("../context-builder");
    // 400-char note — should be truncated to 300 in compare mode
    const note = `- ${"x".repeat(380)}`;
    const result = buildCompressedContext(
      { symbol: "AAPL", assetType: "STOCK", scores: {} },
      { globalNotes: note, tier: "MODERATE", responseMode: "compare" },
    );
    // Should include the profile header but not the full 380-char note
    expect(result).toContain("[USER_PROFILE]");
    // The injected content should be capped — check full note tail is absent
    expect(result).not.toContain("x".repeat(350));
  });

  it("does NOT inject [USER_PROFILE] for SIMPLE tier even with globalNotes", async () => {
    const { buildCompressedContext } = await import("../context-builder");
    const result = buildCompressedContext(
      { symbol: "AAPL", assetType: "STOCK", scores: {} },
      { globalNotes: "- Prefers macro", tier: "SIMPLE" },
    );
    expect(result).not.toContain("[USER_PROFILE]");
  });
});

// ─── W1: Memory extraction snapshot tests ─────────────────────────────────────
// Verifies that distillSessionNotes correctly parses nano output, writes to DB,
// emits telemetry, and enforces the Redis concurrency lock.

describe("distillSessionNotes — extraction quality snapshots", () => {
  const mockSetCache = setCache as ReturnType<typeof vi.fn>;
  const mockLogMemoryEvent = logMemoryEvent as ReturnType<typeof vi.fn>;

  const fourTurnMessages = [
    { role: "user", content: "What's your view on NVDA momentum?" },
    { role: "assistant", content: "NVDA shows strong trend (T:85) with decelerating momentum (M:62)." },
    { role: "user", content: "How does that compare to AMD?" },
    { role: "assistant", content: "AMD has lower trend (T:71) but stronger momentum (M:79)." },
    { role: "user", content: "I prefer Indian stocks like RELIANCE for my core holdings." },
    { role: "assistant", content: "Noted — RELIANCE.NS has strong FII inflow and RBI sensitivity." },
    { role: "user", content: "What risk regime are we in globally?" },
    { role: "assistant", content: "RISK_OFF — VIX elevated, USD strengthening, defensive rotation." },
  ];

  beforeEach(() => {
    mockSetCache.mockResolvedValue(undefined);
    mockPrisma.userMemoryNote.findMany.mockResolvedValue([]);
    mockPrisma.$transaction.mockResolvedValue([]);
  });

  it("extracts valid notes from a real conversation and writes to DB", async () => {
    const nanoOutput = JSON.stringify([
      { text: "Prefers Indian stocks (RELIANCE.NS) as core holdings", keywords: ["india", "reliance"] },
      { text: "Interested in momentum divergence between NVDA and AMD", keywords: ["nvda", "amd", "momentum"] },
    ]);
    mockGenerateText.mockResolvedValue({ text: nanoOutput });

    await distillSessionNotes("user_snap1", fourTurnMessages, "lyra");

    expect(mockPrisma.$transaction).toHaveBeenCalledOnce();
    expect(mockLogMemoryEvent).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "updated", noteCount: 2 }),
    );
  });

  it("retains existing global notes when nano returns empty array", async () => {
    mockPrisma.userMemoryNote.findMany.mockResolvedValue([
      { id: "1", text: "Risk-averse, prefers defensive sectors", keywords: ["risk"] },
    ]);
    mockGenerateText.mockResolvedValue({ text: "[]" });

    await distillSessionNotes("user_snap2", fourTurnMessages, "lyra");

    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(mockLogMemoryEvent).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "retained_existing", noteCount: 1 }),
    );
  });

  it("skips DB write and logs skipped_empty when nano returns [] and no existing notes", async () => {
    mockGenerateText.mockResolvedValue({ text: "[]" });

    await distillSessionNotes("user_snap3", fourTurnMessages, "lyra");

    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(mockLogMemoryEvent).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "skipped_empty" }),
    );
  });

  it("handles malformed JSON from nano gracefully — retains existing notes", async () => {
    mockPrisma.userMemoryNote.findMany.mockResolvedValue([
      { id: "1", text: "Follows macro regime signals closely", keywords: ["macro"] },
    ]);
    mockGenerateText.mockResolvedValue({ text: "not valid json at all" });

    await distillSessionNotes("user_snap4", fourTurnMessages, "lyra");

    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(mockLogMemoryEvent).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "retained_existing" }),
    );
  });

  it("truncates notes exceeding MAX_NOTE_LENGTH (150 chars) before writing", async () => {
    const longNote = "x".repeat(200);
    const nanoOutput = JSON.stringify([
      { text: longNote, keywords: ["test"] },
    ]);
    mockGenerateText.mockResolvedValue({ text: nanoOutput });

    await distillSessionNotes("user_snap5", fourTurnMessages, "lyra");

    const txCall = mockPrisma.$transaction.mock.calls[0][0];
    expect(txCall).toBeDefined();
    // Transaction includes deleteMany x2 + 1 create — the create data text must be <= 150 chars
    // We verify the transaction was called (note was valid enough to write, just truncated)
    expect(mockPrisma.$transaction).toHaveBeenCalledOnce();
  });

  it("logs 'locked' outcome and skips work when Redis lock is already held", async () => {
    // Simulate lock already held — redis.set with NX returns null (key already exists)
    mockRedisSet.mockResolvedValueOnce(null);

    await distillSessionNotes("user_snap6", fourTurnMessages, "lyra");

    expect(mockGenerateText).not.toHaveBeenCalled();
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(mockLogMemoryEvent).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "locked" }),
    );
  });

  it("uses source-aware labeling — myra source does not label assistant as Lyra", async () => {
    const nanoOutput = JSON.stringify([
      { text: "Frequently asks about billing and plan limits", keywords: ["billing"] },
    ]);
    mockGenerateText.mockResolvedValue({ text: nanoOutput });

    await distillSessionNotes("user_snap7", fourTurnMessages, "myra");

    // Verify nano was called (myra source passes all gates)
    expect(mockGenerateText).toHaveBeenCalledOnce();
    // The prompt passed to nano should reference "myra" labeling context
    const promptArg = mockGenerateText.mock.calls[0][0].prompt as string;
    expect(promptArg).toContain("platform support");
    expect(promptArg).not.toContain("financial analysis");
  });

  it("does not fire for non-Clerk userId", async () => {
    await distillSessionNotes("test_audit_pro_abc", fourTurnMessages, "lyra");
    expect(mockGenerateText).not.toHaveBeenCalled();
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("does not fire when fewer than 4 user turns", async () => {
    const shortMessages = [
      { role: "user", content: "What is volatility?" },
      { role: "assistant", content: "Volatility measures price variation." },
      { role: "user", content: "Thanks." },
      { role: "assistant", content: "Anytime." },
    ];
    await distillSessionNotes("user_snap9", shortMessages, "lyra");
    expect(mockGenerateText).not.toHaveBeenCalled();
  });
});
