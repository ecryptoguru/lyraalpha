/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

vi.mock("@/lib/middleware/cron-auth", () => ({
  withCronAuthAndLogging: vi.fn(async (_request, _args, handler) => handler({ requestId: "test-request-id" })),
}));

vi.mock("@/lib/ai/rag", () => ({
  processPendingConversationEmbeddings: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

import { processPendingConversationEmbeddings } from "@/lib/ai/rag";

describe("POST /api/cron/embed-memory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns success payload on completed embedding run", async () => {
    vi.mocked(processPendingConversationEmbeddings).mockResolvedValue({
      claimed: 20,
      done: 14,
      failed: 2,
      skipped: 4,
    });

    const req = new Request("http://localhost/api/cron/embed-memory", {
      method: "POST",
      headers: { authorization: "Bearer test-secret" },
    });

    const res = await POST(req as unknown as import("next/server").NextRequest);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.results).toEqual({ claimed: 20, done: 14, failed: 2, skipped: 4 });
  });

  it("returns generic 500 error on failure", async () => {
    vi.mocked(processPendingConversationEmbeddings).mockRejectedValue(
      new Error("sensitive embedding error") as never,
    );

    const req = new Request("http://localhost/api/cron/embed-memory", {
      method: "POST",
      headers: { authorization: "Bearer test-secret" },
    });

    const res = await POST(req as unknown as import("next/server").NextRequest);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toEqual({ success: false, error: "Embedding run failed" });
  });
});
