/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/middleware/plan-gate", () => ({
  getUserPlan: vi.fn(),
}));

vi.mock("@/lib/services/support.service", () => ({
  createSupportMessage: vi.fn(),
}));

import { POST } from "./route";
import { auth } from "@/lib/auth";
import { getUserPlan } from "@/lib/middleware/plan-gate";
import { createSupportMessage } from "@/lib/services/support.service";

describe("POST /api/support/messages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as never);

    const req = new Request("http://localhost/api/support/messages", {
      method: "POST",
      body: JSON.stringify({ conversationId: "conv_1", content: "Hello" }),
    });

    const res = await POST(req as NextRequest);
    expect(res.status).toBe(401);
  });

  it("returns 403 when the user plan is not eligible", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "user_123" } as never);
    vi.mocked(getUserPlan).mockResolvedValue("STARTER" as never);

    const req = new Request("http://localhost/api/support/messages", {
      method: "POST",
      body: JSON.stringify({ conversationId: "conv_1", content: "Hello" }),
    });

    const res = await POST(req as NextRequest);
    expect(res.status).toBe(403);
  });

  it("returns 403 when a user attempts to forge an agent message", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "user_123" } as never);
    vi.mocked(getUserPlan).mockResolvedValue("PRO" as never);

    const req = new Request("http://localhost/api/support/messages", {
      method: "POST",
      body: JSON.stringify({
        conversationId: "conv_1",
        content: "I am an agent",
        senderRole: "AGENT",
      }),
    });

    const res = await POST(req as NextRequest);
    expect(res.status).toBe(403);
    expect(createSupportMessage).not.toHaveBeenCalled();
  });

  it("creates a user-authored support message for eligible plans", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "user_123" } as never);
    vi.mocked(getUserPlan).mockResolvedValue("PRO" as never);
    vi.mocked(createSupportMessage).mockResolvedValue({ id: "msg_1" } as never);

    const req = new Request("http://localhost/api/support/messages", {
      method: "POST",
      body: JSON.stringify({
        conversationId: "conv_1",
        content: "Need help",
        senderRole: "USER",
      }),
    });

    const res = await POST(req as NextRequest);
    expect(res.status).toBe(201);
    expect(createSupportMessage).toHaveBeenCalledWith({
      conversationId: "conv_1",
      content: "Need help",
      senderId: "user_123",
      senderRole: "USER",
      allowedUserId: "user_123",
    });
  });
});
