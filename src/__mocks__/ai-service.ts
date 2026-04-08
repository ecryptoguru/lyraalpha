/**
 * Lightweight mock for @/lib/ai/service.
 * Prevents the full AI service (OpenAI, Pinecone, Prisma, Redis) from loading in tests.
 */
import { vi } from "vitest";

export const generateLyraStream = vi.fn();
export const generateLyraText = vi.fn();
export const storeConversationLog = vi.fn();
export const getConversationHistory = vi.fn().mockResolvedValue([]);
export const _clearPlanCacheForTest = vi.fn();
