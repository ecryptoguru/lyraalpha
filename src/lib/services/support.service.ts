import type { PlanTier } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getUserCredits } from "@/lib/services/credit.service";

export interface SupportConversationPayload {
  subject?: string;
  userContext?: Record<string, unknown>;
}

export async function getUserOpenSupportConversation(userId: string) {
  return prisma.supportConversation.findFirst({
    where: {
      userId,
      status: { in: ["OPEN", "PENDING"] },
    },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        take: 50,
      },
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function listAdminSupportConversations(opts: {
  limit?: number;
  cursor?: { updatedAt: Date; id: string };
} = {}) {
  const { limit = 50, cursor } = opts;

  const items = await prisma.supportConversation.findMany({
    where: cursor
      ? {
          OR: [
            { updatedAt: { lt: cursor.updatedAt } },
            {
              updatedAt: cursor.updatedAt,
              id: { lt: cursor.id },
            },
          ],
        }
      : undefined,
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: limit + 1,
  });

  const hasNext = items.length > limit;
  const page = hasNext ? items.slice(0, limit) : items;
  const nextCursor = hasNext
    ? { id: page[page.length - 1].id, updatedAt: page[page.length - 1].updatedAt }
    : null;

  return { items: page, nextCursor };
}

export async function createSupportConversation(
  userId: string,
  plan: PlanTier,
  payload: SupportConversationPayload,
) {
  const existingConversation = await getUserOpenSupportConversation(userId);
  if (existingConversation) {
    return existingConversation;
  }

  const [user, credits] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        plan: true,
        createdAt: true,
        preferences: { select: { preferredRegion: true } },
        _count: { select: { watchlistItems: true } },
      },
    }),
    getUserCredits(userId),
  ]);

  return prisma.supportConversation.create({
    data: {
      userId,
      subject: payload.subject || "General Inquiry",
      plan,
      userContext: {
        email: user?.email,
        credits,
        plan: user?.plan,
        region: user?.preferences?.preferredRegion ?? null,
        watchlistCount: user?._count?.watchlistItems ?? 0,
        memberSince: user?.createdAt ?? null,
        ...payload.userContext,
      },
    },
    include: {
      messages: true,
    },
  });
}

export async function createSupportMessage(input: {
  conversationId: string;
  content: string;
  senderId: string;
  senderRole: "USER" | "AGENT";
  allowedUserId?: string;
  nextStatus?: "OPEN" | "PENDING" | "RESOLVED" | "CLOSED";
}) {
  return prisma.$transaction(async (tx) => {
    const conversation = await tx.supportConversation.findFirst({
      where: input.allowedUserId
        ? { id: input.conversationId, userId: input.allowedUserId }
        : { id: input.conversationId },
      select: { id: true },
    });

    if (!conversation) {
      return null;
    }

    const message = await tx.supportMessage.create({
      data: {
        conversationId: input.conversationId,
        senderId: input.senderId,
        senderRole: input.senderRole,
        content: input.content,
      },
    });

    await tx.supportConversation.update({
      where: { id: input.conversationId },
      data: {
        updatedAt: new Date(),
        ...(input.nextStatus ? { status: input.nextStatus } : {}),
      },
    });

    return message;
  });
}

export async function resolveSupportConversation(id: string, allowedUserId?: string) {
  const conversation = await prisma.supportConversation.findFirst({
    where: allowedUserId ? { id, userId: allowedUserId } : { id },
    select: { id: true },
  });

  if (!conversation) {
    return null;
  }

  return prisma.supportConversation.update({
    where: { id },
    data: {
      status: "RESOLVED",
      closedAt: new Date(),
      updatedAt: new Date(),
    },
  });
}
