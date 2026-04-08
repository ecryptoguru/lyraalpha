/**
 * @vitest-environment node
 *
 * Unit tests for POST /api/prelaunch/validate-coupon
 * Covers: hardcoded valid, DB valid, DB expired, DB maxUses exhausted,
 * unknown code, rate-limited, malformed body.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));
vi.mock("@/lib/logger/utils", () => ({
  sanitizeError: (e: unknown) => e,
}));

vi.mock("@/lib/config/prelaunch", () => ({
  normalizePrelaunchCoupon: (code?: string | null) => {
    if (!code) return null;
    return code.trim().toUpperCase().replace(/\s+/g, "") || null;
  },
  isAllowedPrelaunchCoupon: (code?: string | null) =>
    code === "ELITE15" || code === "ELITE30",
}));

vi.mock("@/lib/rate-limit/utils", () => ({
  getClientIp: () => "127.0.0.1",
}));

const mockRateLimitGeneral = vi.fn();
vi.mock("@/lib/rate-limit", () => ({
  rateLimitGeneral: mockRateLimitGeneral,
}));

const mockPromoFindUnique = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    promoCode: { findUnique: mockPromoFindUnique },
  },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/prelaunch/validate-coupon", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeDbPromo(overrides: Record<string, unknown> = {}) {
  return {
    isActive: true,
    expiresAt: null,
    maxUses: null,
    usedCount: 0,
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/prelaunch/validate-coupon", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockRateLimitGeneral.mockResolvedValue(null); // not rate-limited
    mockPromoFindUnique.mockResolvedValue(null);
  });

  it("returns { valid: true } for a hardcoded prelaunch coupon (ELITE15)", async () => {
    const { POST } = await import("../route");
    const res = await POST(makeRequest({ code: "ELITE15" }));
    const body = await res.json() as { valid: boolean };
    expect(body.valid).toBe(true);
    expect(mockPromoFindUnique).not.toHaveBeenCalled();
  });

  it("returns { valid: true } for a hardcoded prelaunch coupon (ELITE30)", async () => {
    const { POST } = await import("../route");
    const res = await POST(makeRequest({ code: "ELITE30" }));
    const body = await res.json() as { valid: boolean };
    expect(body.valid).toBe(true);
  });

  it("normalizes lowercase input — 'elite15' is valid", async () => {
    const { POST } = await import("../route");
    const res = await POST(makeRequest({ code: "elite15" }));
    const body = await res.json() as { valid: boolean };
    expect(body.valid).toBe(true);
  });

  it("returns { valid: true } for an active DB promo with no limits", async () => {
    mockPromoFindUnique.mockResolvedValue(makeDbPromo());
    const { POST } = await import("../route");
    const res = await POST(makeRequest({ code: "DBPROMO1" }));
    const body = await res.json() as { valid: boolean };
    expect(body.valid).toBe(true);
  });

  it("returns { valid: true } for DB promo with usedCount below maxUses", async () => {
    mockPromoFindUnique.mockResolvedValue(makeDbPromo({ maxUses: 10, usedCount: 9 }));
    const { POST } = await import("../route");
    const res = await POST(makeRequest({ code: "LIMITEDPROMO" }));
    const body = await res.json() as { valid: boolean };
    expect(body.valid).toBe(true);
  });

  it("returns { valid: false } when DB promo maxUses is exhausted", async () => {
    mockPromoFindUnique.mockResolvedValue(makeDbPromo({ maxUses: 5, usedCount: 5 }));
    const { POST } = await import("../route");
    const res = await POST(makeRequest({ code: "EXHAUSTED" }));
    const body = await res.json() as { valid: boolean };
    expect(body.valid).toBe(false);
  });

  it("returns { valid: false } when DB promo is expired", async () => {
    const past = new Date(Date.now() - 1000 * 60 * 60 * 24);
    mockPromoFindUnique.mockResolvedValue(makeDbPromo({ expiresAt: past }));
    const { POST } = await import("../route");
    const res = await POST(makeRequest({ code: "EXPIREDCODE" }));
    const body = await res.json() as { valid: boolean };
    expect(body.valid).toBe(false);
  });

  it("returns { valid: false } when DB promo is inactive", async () => {
    mockPromoFindUnique.mockResolvedValue(makeDbPromo({ isActive: false }));
    const { POST } = await import("../route");
    const res = await POST(makeRequest({ code: "INACTIVE" }));
    const body = await res.json() as { valid: boolean };
    expect(body.valid).toBe(false);
  });

  it("returns { valid: false } for an unknown coupon code", async () => {
    mockPromoFindUnique.mockResolvedValue(null);
    const { POST } = await import("../route");
    const res = await POST(makeRequest({ code: "TOTALLYUNKNOWN" }));
    const body = await res.json() as { valid: boolean };
    expect(body.valid).toBe(false);
  });

  it("returns { valid: false } for an empty code string", async () => {
    const { POST } = await import("../route");
    const res = await POST(makeRequest({ code: "" }));
    const body = await res.json() as { valid: boolean };
    expect(body.valid).toBe(false);
  });

  it("returns { valid: false } when code field is missing", async () => {
    const { POST } = await import("../route");
    const res = await POST(makeRequest({}));
    const body = await res.json() as { valid: boolean };
    expect(body.valid).toBe(false);
  });

  it("returns { valid: false } when code exceeds max length (32 chars)", async () => {
    const { POST } = await import("../route");
    const res = await POST(makeRequest({ code: "A".repeat(33) }));
    const body = await res.json() as { valid: boolean };
    expect(body.valid).toBe(false);
  });

  it("returns the rate-limit response when rate limited", async () => {
    const limitRes = new Response(JSON.stringify({ error: "Too Many Requests" }), { status: 429 });
    mockRateLimitGeneral.mockResolvedValue(limitRes);
    const { POST } = await import("../route");
    const res = await POST(makeRequest({ code: "ELITE15" }));
    expect(res.status).toBe(429);
  });

  it("returns { valid: false } and does not throw when prisma throws", async () => {
    mockPromoFindUnique.mockRejectedValue(new Error("db connection failed"));
    const { POST } = await import("../route");
    const res = await POST(makeRequest({ code: "DBPROMO1" }));
    const body = await res.json() as { valid: boolean };
    expect(body.valid).toBe(false);
  });

  it("returns { valid: false } for a DB promo expiring exactly now (boundary)", async () => {
    // expiresAt set to 1ms in the past — should be invalid
    const justExpired = new Date(Date.now() - 1);
    mockPromoFindUnique.mockResolvedValue(makeDbPromo({ expiresAt: justExpired }));
    const { POST } = await import("../route");
    const res = await POST(makeRequest({ code: "BOUNDARY" }));
    const body = await res.json() as { valid: boolean };
    expect(body.valid).toBe(false);
  });

  it("returns { valid: true } for a DB promo expiring in the future", async () => {
    const future = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
    mockPromoFindUnique.mockResolvedValue(makeDbPromo({ expiresAt: future }));
    const { POST } = await import("../route");
    const res = await POST(makeRequest({ code: "FUTUREPROMO" }));
    const body = await res.json() as { valid: boolean };
    expect(body.valid).toBe(true);
  });
});
