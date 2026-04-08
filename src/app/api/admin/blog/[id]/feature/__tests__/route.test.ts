/**
 * @vitest-environment node
 *
 * Tests for the admin blog feature endpoint:
 * - POST /api/admin/blog/[id]/feature  → feature a post (unfeatures any current via $transaction)
 * - DELETE /api/admin/blog/[id]/feature → unfeature a post + ISR revalidation
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

// ─── vi.hoisted — all mocks must be declared here before factory hoisting ─────

const {
  mockFindUnique,
  mockUpdate,
  mockUpdateMany,
  mockTransaction,
  mockRequireAdmin,
  mockRevalidatePath,
} = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
  mockUpdate: vi.fn(),
  mockUpdateMany: vi.fn(),
  mockTransaction: vi.fn(),
  mockRequireAdmin: vi.fn(),
  mockRevalidatePath: vi.fn(),
}));

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    blogPost: {
      findUnique: mockFindUnique,
      update: mockUpdate,
      updateMany: mockUpdateMany,
    },
    $transaction: mockTransaction,
  },
}));

vi.mock("@/lib/middleware/admin-guard", () => ({
  requireAdmin: mockRequireAdmin,
}));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() }),
}));

vi.mock("@/lib/api-response", () => ({
  apiError: (msg: string, status: number) =>
    new Response(JSON.stringify({ error: msg }), { status }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: mockRevalidatePath,
}));

// ─── Import after mocks ───────────────────────────────────────────────────────

import { POST, DELETE } from "../route";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeReq(): NextRequest {
  return new Request("https://lyraalpha.ai/api/admin/blog/post-id-1/feature", {
    method: "POST",
  }) as unknown as NextRequest;
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

const PUBLISHED_POST = { id: "post-id-1", slug: "test-post-slug", status: "published" };

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue({ authorized: true });
  mockFindUnique.mockResolvedValue(PUBLISHED_POST);
  // $transaction receives an array of prisma operation promises — simulate execution
  mockTransaction.mockImplementation(async (ops: unknown[]) => {
    for (const op of ops) {
      if (op && typeof (op as Promise<unknown>).then === "function") await op;
    }
  });
  mockUpdate.mockResolvedValue({ id: "post-id-1", slug: "test-post-slug" });
  mockUpdateMany.mockResolvedValue({ count: 0 });
});

// ─── Auth guard — POST ────────────────────────────────────────────────────────

describe("auth guard — POST", () => {
  it("returns 403 when not authorized", async () => {
    mockRequireAdmin.mockResolvedValueOnce({
      authorized: false,
      response: new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 }),
    });

    const res = await POST(makeReq(), makeParams("post-id-1"));
    expect(res.status).toBe(403);
    expect(mockTransaction).not.toHaveBeenCalled();
  });
});

// ─── Auth guard — DELETE ──────────────────────────────────────────────────────

describe("auth guard — DELETE", () => {
  it("returns 403 when not authorized", async () => {
    mockRequireAdmin.mockResolvedValueOnce({
      authorized: false,
      response: new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 }),
    });

    const res = await DELETE(makeReq(), makeParams("post-id-1"));
    expect(res.status).toBe(403);
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

// ─── POST (feature) ───────────────────────────────────────────────────────────

describe("POST — feature a post", () => {
  it("returns 404 when post does not exist", async () => {
    mockFindUnique.mockResolvedValueOnce(null);

    const res = await POST(makeReq(), makeParams("ghost-id"));
    expect(res.status).toBe(404);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("returns 400 when post is not published (archived)", async () => {
    mockFindUnique.mockResolvedValueOnce({
      id: "post-id-1",
      slug: "archived-post",
      status: "archived",
    });

    const res = await POST(makeReq(), makeParams("post-id-1"));
    expect(res.status).toBe(400);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("executes $transaction with 2 operations", async () => {
    await POST(makeReq(), makeParams("post-id-1"));

    expect(mockTransaction).toHaveBeenCalledTimes(1);
    const ops = mockTransaction.mock.calls[0][0];
    expect(Array.isArray(ops)).toBe(true);
    expect(ops).toHaveLength(2);
  });

  it("revalidates /blog, /blog/[slug], and /", async () => {
    await POST(makeReq(), makeParams("post-id-1"));

    expect(mockRevalidatePath).toHaveBeenCalledWith("/blog");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/blog/test-post-slug");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/");
  });

  it("returns 200 with success:true, id, and slug", async () => {
    const res = await POST(makeReq(), makeParams("post-id-1"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.slug).toBe("test-post-slug");
    expect(body.id).toBe("post-id-1");
  });
});

// ─── DELETE (unfeature) ───────────────────────────────────────────────────────

describe("DELETE — unfeature a post", () => {
  it("returns 404 when post does not exist", async () => {
    mockFindUnique.mockResolvedValueOnce(null);

    const res = await DELETE(makeReq(), makeParams("ghost-id"));
    expect(res.status).toBe(404);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("sets featured:false on the target post", async () => {
    await DELETE(makeReq(), makeParams("post-id-1"));

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "post-id-1" },
      data: { featured: false },
    });
  });

  it("revalidates /blog, /blog/[slug], and / after unfeaturing", async () => {
    await DELETE(makeReq(), makeParams("post-id-1"));

    expect(mockRevalidatePath).toHaveBeenCalledWith("/blog");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/blog/test-post-slug");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/");
  });

  it("returns 200 with success:true and the slug", async () => {
    const res = await DELETE(makeReq(), makeParams("post-id-1"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.slug).toBe("test-post-slug");
  });
});
