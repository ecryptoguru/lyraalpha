/**
 * Mock for @/lib/prisma — used in vitest via alias.
 * Returns a no-op Prisma client stub so tests that import @/lib/prisma
 * get mocks rather than the real PrismaClient (which loads a 80MB native binary).
 * Per-test mocks override specific methods via vi.mock("@/lib/prisma").
 */
import { vi } from "vitest";

const makeModelMock = () => ({
  findUnique: vi.fn(),
  findFirst: vi.fn(),
  findMany: vi.fn(),
  create: vi.fn(),
  createMany: vi.fn(),
  update: vi.fn(),
  updateMany: vi.fn(),
  upsert: vi.fn(),
  delete: vi.fn(),
  deleteMany: vi.fn(),
  count: vi.fn(),
  aggregate: vi.fn(),
  groupBy: vi.fn(),
});

export const prisma = new Proxy(
  {
    $connect: vi.fn(),
    $disconnect: vi.fn(),
    $transaction: vi.fn(),
    $executeRaw: vi.fn(),
    $executeRawUnsafe: vi.fn(),
    $queryRaw: vi.fn(),
    $queryRawUnsafe: vi.fn(),
  } as Record<string, unknown>,
  {
    get(target, prop: string) {
      if (prop in target) return target[prop];
      // Return a model mock for any unknown property (table name)
      target[prop] = makeModelMock();
      return target[prop];
    },
  },
);

export const directPrisma = prisma;
