import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    supportConversation: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

import { createSupportConversation, listAdminSupportConversations } from "../support.service";

describe("support.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reuses an existing open support conversation before creating a new one", async () => {
    const existingConversation = { id: "conv_existing", messages: [] };
    prismaMock.supportConversation.findFirst.mockResolvedValueOnce(existingConversation);

    const result = await createSupportConversation("user_123", "PRO", {
      subject: "General Inquiry",
      userContext: { currentPage: "/dashboard" },
    });

    expect(result).toBe(existingConversation);
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.supportConversation.create).not.toHaveBeenCalled();
  });

  it("returns cursor-paginated admin conversations with nextCursor when more results exist", async () => {
    const conversations = [
      { id: "conv_3", updatedAt: new Date("2026-03-10T10:00:00.000Z"), messages: [] },
      { id: "conv_2", updatedAt: new Date("2026-03-10T09:00:00.000Z"), messages: [] },
      { id: "conv_1", updatedAt: new Date("2026-03-10T08:00:00.000Z"), messages: [] },
    ];
    prismaMock.supportConversation.findMany.mockResolvedValueOnce(conversations);

    const result = await listAdminSupportConversations({ limit: 2 });

    expect(prismaMock.supportConversation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 3,
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      }),
    );
    expect(result.items).toEqual(conversations.slice(0, 2));
    expect(result.nextCursor).toEqual({
      id: "conv_2",
      updatedAt: new Date("2026-03-10T09:00:00.000Z"),
    });
  });

  it("passes cursor and returns null nextCursor on the last admin support page", async () => {
    const cursor = { id: "conv_5", updatedAt: new Date("2026-03-10T11:00:00.000Z") };
    const conversations = [
      { id: "conv_4", updatedAt: new Date("2026-03-10T10:00:00.000Z"), messages: [] },
    ];
    prismaMock.supportConversation.findMany.mockResolvedValueOnce(conversations);

    const result = await listAdminSupportConversations({ limit: 2, cursor });

    expect(prismaMock.supportConversation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 3,
        where: {
          OR: [
            { updatedAt: { lt: cursor.updatedAt } },
            { updatedAt: cursor.updatedAt, id: { lt: cursor.id } },
          ],
        },
      }),
    );
    expect(result.items).toEqual(conversations);
    expect(result.nextCursor).toBeNull();
  });
});
