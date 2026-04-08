/**
 * Lightweight Prisma client mock for test environments.
 * Prevents the native query engine binary from loading in vitest fork processes.
 * Individual tests override specific methods via vi.mock("@/lib/prisma").
 */
import { vi } from "vitest";

export const PrismaClient = vi.fn().mockImplementation(() => ({}));
export const Prisma = {
  PrismaClientKnownRequestError: class extends Error {},
  PrismaClientUnknownRequestError: class extends Error {},
  PrismaClientValidationError: class extends Error {},
  sql: vi.fn(),
  join: vi.fn(),
  raw: vi.fn(),
  empty: vi.fn(),
  InputJsonValue: {},
  DbNull: "DbNull",
  JsonNull: "JsonNull",
  AnyNull: "AnyNull",
};

// Re-export all enums as empty objects (tests mock specific values)
export const ScoreType = {} as Record<string, string>;
export const AssetType = {} as Record<string, string>;
export const PlanTier = {} as Record<string, string>;
