/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { PUT } from "./route";

const loggerMock = vi.hoisted(() => ({
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/email/brevo", () => ({
  subscribeToBrevoBlogList: vi.fn(),
  unsubscribeFromBrevoBlogList: vi.fn(),
}));

vi.mock("@/lib/utils/ensure-user", () => ({
  ensureUserExists: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/services/user-preferences.service", () => ({
  updateBlogSubscriptionPreference: vi.fn().mockResolvedValue({ blogSubscribed: true }),
}));

vi.mock("@/lib/logger", () => ({
  createLogger: vi.fn(() => loggerMock),
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { subscribeToBrevoBlogList, unsubscribeFromBrevoBlogList } from "@/lib/email/brevo";
import { updateBlogSubscriptionPreference } from "@/lib/services/user-preferences.service";

describe("PUT /api/user/preferences/blog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({ userId: "user_123" } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ email: "user@example.com" } as never);
    vi.mocked(updateBlogSubscriptionPreference).mockResolvedValue({ blogSubscribed: true } as never);
  });

  it("subscribes on opt-in", async () => {
    vi.mocked(subscribeToBrevoBlogList).mockResolvedValue(true as never);

    const req = new Request("http://localhost/api/user/preferences/blog", {
      method: "PUT",
      body: JSON.stringify({ blogSubscribed: true }),
    });

    const res = await PUT(req as NextRequest);
    expect(res.status).toBe(200);
    expect(subscribeToBrevoBlogList).toHaveBeenCalledWith("user@example.com");
    expect(unsubscribeFromBrevoBlogList).not.toHaveBeenCalled();
  });

  it("saves preference even when unsubscribe provider sync fails", async () => {
    vi.mocked(unsubscribeFromBrevoBlogList).mockResolvedValue(false as never);

    const req = new Request("http://localhost/api/user/preferences/blog", {
      method: "PUT",
      body: JSON.stringify({ blogSubscribed: false }),
    });

    const res = await PUT(req as NextRequest);
    expect(res.status).toBe(200);

    expect(updateBlogSubscriptionPreference).toHaveBeenCalledWith("user_123", false);
    expect(unsubscribeFromBrevoBlogList).toHaveBeenCalledWith("user@example.com");
    expect(loggerMock.warn).toHaveBeenCalledOnce();
  });
});
