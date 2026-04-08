/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

vi.mock("@/lib/middleware/admin-guard", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("@/lib/services/support.service", () => ({
  listAdminSupportConversations: vi.fn(),
}));

import { GET } from "./route";
import { requireAdmin } from "@/lib/middleware/admin-guard";
import { listAdminSupportConversations } from "@/lib/services/support.service";

describe("GET /api/admin/support/conversations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the admin guard response when unauthorized", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({
      authorized: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    } as never);

    const req = new NextRequest("http://localhost/api/admin/support/conversations");
    const res = await GET(req);

    expect(res.status).toBe(403);
    expect(listAdminSupportConversations).not.toHaveBeenCalled();
  });

  it("returns paginated conversations with default limit", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ authorized: true } as never);
    vi.mocked(listAdminSupportConversations).mockResolvedValue({
      items: [{ id: "conv_1" }],
      nextCursor: null,
    } as never);

    const req = new NextRequest("http://localhost/api/admin/support/conversations");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(listAdminSupportConversations).toHaveBeenCalledWith({ limit: 50, cursor: undefined });
    expect(body).toEqual({ items: [{ id: "conv_1" }], nextCursor: null });
  });

  it("parses limit and cursor query params", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ authorized: true } as never);
    vi.mocked(listAdminSupportConversations).mockResolvedValue({
      items: [],
      nextCursor: { id: "conv_2", updatedAt: "2026-03-10T09:00:00.000Z" },
    } as never);

    const req = new NextRequest(
      "http://localhost/api/admin/support/conversations?limit=25&cursor=conv_3&cursorUpdatedAt=2026-03-10T10:00:00.000Z",
    );
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(listAdminSupportConversations).toHaveBeenCalledWith({
      limit: 25,
      cursor: {
        id: "conv_3",
        updatedAt: new Date("2026-03-10T10:00:00.000Z"),
      },
    });
  });

  it("clamps invalid limits into the supported range", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ authorized: true } as never);
    vi.mocked(listAdminSupportConversations).mockResolvedValue({
      items: [],
      nextCursor: null,
    } as never);

    const req = new NextRequest("http://localhost/api/admin/support/conversations?limit=999");
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(listAdminSupportConversations).toHaveBeenCalledWith({ limit: 100, cursor: undefined });
  });
});
