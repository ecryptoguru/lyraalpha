/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

vi.mock("@/lib/services/daily-briefing.service", () => ({
  DailyBriefingService: {
    generateBriefings: vi.fn(),
  },
}));

vi.mock("@/lib/logger", () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

import { DailyBriefingService } from "@/lib/services/daily-briefing.service";

describe("POST /api/cron/daily-briefing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-secret";
  });

  it("returns 401 when cron secret does not match", async () => {
    const req = new Request("http://localhost/api/cron/daily-briefing", {
      method: "POST",
      headers: { authorization: "Bearer wrong" },
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns generic 500 error without leaking internal message", async () => {
    vi.mocked(DailyBriefingService.generateBriefings).mockRejectedValue(
      new Error("sensitive internal failure") as never,
    );

    const req = new Request("http://localhost/api/cron/daily-briefing", {
      method: "POST",
      headers: { authorization: "Bearer test-secret" },
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toEqual({ success: false, error: "Generation failed" });
  });
});
