/**
 * @vitest-environment node
 *
 * Tests for the refactored grantCreditsInTransaction and resetMonthlyCredits paths:
 *   - C1: grantCreditsInTransaction makes 3 DB round-trips, not 6-9
 *   - I1: 'now' is pinned once — no expiry drift between lots
 *   - I7: resetMonthlyCredits no longer calls getCreditState as a side-effect-only call
 *   - O3: getUserCreditSnapshot uses a single-pass loop, not 4 chained array passes
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── In-memory DB state ──────────────────────────────────────────────────────

type UserRow = {
  id: string;
  credits: number;
  monthlyCreditsBalance: number;
  bonusCreditsBalance: number;
  purchasedCreditsBalance: number;
  totalCreditsEarned: number;
  totalCreditsSpent: number;
  plan: string;
};

type CreditLotRow = {
  id: string;
  userId: string;
  transactionId: string | null;
  bucket: "MONTHLY" | "BONUS" | "PURCHASED";
  originalAmount: number;
  remainingAmount: number;
  expiresAt: Date | null;
  createdAt: Date;
};

type CreditTransactionRow = {
  id: string;
  userId: string;
  amount: number;
  type: string;
  description?: string;
  referenceId?: string;
  expiresAt: Date | null;
  createdAt: Date;
};

type SetLike = number | { set?: number; increment?: number; decrement?: number };
type WhereInput = Record<string, unknown>;

function applySetLike(current: number, v: SetLike): number {
  if (typeof v === "number") return v;
  if (v?.set !== undefined) return v.set;
  if (v?.increment !== undefined) return current + v.increment;
  if (v?.decrement !== undefined) return current - v.decrement;
  return current;
}

function matchesWhere(row: Record<string, unknown>, where: WhereInput): boolean {
  return Object.entries(where).every(([k, v]) => {
    if (k === "OR" && Array.isArray(v)) return v.some((c) => matchesWhere(row, c as WhereInput));
    const cur = row[k] as number | string | Date | boolean | null | undefined;
    if (v && typeof v === "object" && !(v instanceof Date) && !Array.isArray(v)) {
      const cmp = v as { gt?: number | Date; gte?: number | Date; lte?: number | Date; not?: unknown };
      const n = cur as number | Date;
      if (cmp.gt !== undefined && !(n > cmp.gt)) return false;
      if (cmp.gte !== undefined && !(n >= cmp.gte)) return false;
      if (cmp.lte !== undefined && !(n <= cmp.lte)) return false;
      if (cmp.not !== undefined && cur === cmp.not) return false;
      return true;
    }
    return cur === v;
  });
}

let users: Map<string, UserRow>;
let lots: CreditLotRow[];
let transactions: CreditTransactionRow[];
let lotCounter: number;
let txCounter: number;
let findUniqueCalls: number;

const mockPrisma = {
  $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(mockPrisma)),
  user: {
    findUnique: vi.fn(async ({ where, select }: { where: { id: string }; select?: Record<string, boolean> }) => {
      findUniqueCalls++;
      const row = users.get(where.id) ?? null;
      if (!row || !select) return row;
      return Object.fromEntries(Object.keys(select).map((k) => [k, (row as Record<string, unknown>)[k]]));
    }),
    update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, SetLike> }) => {
      const existing = users.get(where.id);
      if (!existing) throw Object.assign(new Error("Not found"), { code: "P2025" });
      users.set(where.id, {
        ...existing,
        credits: applySetLike(existing.credits, data.credits),
        monthlyCreditsBalance: applySetLike(existing.monthlyCreditsBalance, data.monthlyCreditsBalance),
        bonusCreditsBalance: applySetLike(existing.bonusCreditsBalance, data.bonusCreditsBalance),
        purchasedCreditsBalance: applySetLike(existing.purchasedCreditsBalance, data.purchasedCreditsBalance),
        totalCreditsEarned: applySetLike(existing.totalCreditsEarned, data.totalCreditsEarned ?? existing.totalCreditsEarned),
        totalCreditsSpent: applySetLike(existing.totalCreditsSpent, data.totalCreditsSpent ?? existing.totalCreditsSpent),
      });
      return users.get(where.id);
    }),
  },
  creditLot: {
    count: vi.fn(async ({ where }: { where: WhereInput }) =>
      lots.filter((r) => matchesWhere(r as Record<string, unknown>, where)).length,
    ),
    findMany: vi.fn(async ({ where, orderBy }: { where: WhereInput; orderBy?: Array<{ createdAt?: "asc" | "desc" }> }) => {
      let result = lots.filter((r) => matchesWhere(r as Record<string, unknown>, where));
      if (orderBy?.[0]?.createdAt === "asc") result = result.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      return result;
    }),
    create: vi.fn(async ({ data }: { data: Omit<CreditLotRow, "id"> }) => {
      const row: CreditLotRow = { id: `lot_${++lotCounter}`, ...data };
      lots.push(row);
      return row;
    }),
    update: vi.fn(async ({ where, data }: { where: { id: string }; data: { remainingAmount: SetLike } }) => {
      const row = lots.find((r) => r.id === where.id);
      if (!row) throw new Error("Not found");
      row.remainingAmount = applySetLike(row.remainingAmount, data.remainingAmount);
      return row;
    }),
    updateMany: vi.fn(async ({ where, data }: { where: WhereInput; data: { remainingAmount: SetLike } }) => {
      let count = 0;
      lots = lots.map((r) => {
        if (!matchesWhere(r as Record<string, unknown>, where)) return r;
        count++;
        return { ...r, remainingAmount: applySetLike(r.remainingAmount, data.remainingAmount) };
      });
      return { count };
    }),
  },
  creditTransaction: {
    create: vi.fn(async ({ data }: { data: Omit<CreditTransactionRow, "id"> }) => {
      const row: CreditTransactionRow = { id: `txn_${++txCounter}`, ...data };
      transactions.push(row);
      return row;
    }),
  },
};

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/redis", () => ({
  getCache: vi.fn().mockResolvedValue(null),
  setCache: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/plans/facts", () => ({
  getMonthlyPlanCredits: vi.fn((plan: string) => (plan === "ELITE" ? 1500 : plan === "PRO" ? 500 : 100)),
  getQueryCreditCost: vi.fn((tier: string) => (tier === "COMPLEX" ? 10 : tier === "MODERATE" ? 5 : 2)),
}));

function seedUser(overrides: Partial<UserRow> = {}): UserRow {
  const row: UserRow = {
    id: "user_abc",
    credits: 0,
    monthlyCreditsBalance: 0,
    bonusCreditsBalance: 0,
    purchasedCreditsBalance: 0,
    totalCreditsEarned: 0,
    totalCreditsSpent: 0,
    plan: "PRO",
    ...overrides,
  };
  users.set(row.id, row);
  return row;
}

function seedLot(overrides: Partial<CreditLotRow> & { bucket: CreditLotRow["bucket"]; remainingAmount: number }): CreditLotRow {
  const row: CreditLotRow = {
    id: `lot_${++lotCounter}`,
    userId: "user_abc",
    transactionId: null,
    originalAmount: overrides.remainingAmount,
    expiresAt: new Date("2099-12-31"),
    createdAt: new Date("2026-01-01"),
    ...overrides,
  };
  lots.push(row);
  return row;
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  users = new Map();
  lots = [];
  transactions = [];
  lotCounter = 0;
  txCounter = 0;
  findUniqueCalls = 0;
});

// ─── C1: grantCreditsInTransaction — DB round-trip reduction ─────────────────

describe("grantCreditsInTransaction — DB efficiency (C1)", () => {
  it("makes exactly one user.findUnique when user has no lots (bootstrap path)", async () => {
    seedUser();
    const { grantCreditsInTransaction } = await import("../credit.service");
    await mockPrisma.$transaction(async (tx) =>
      grantCreditsInTransaction(tx as never, "user_abc", 100, "SUBSCRIPTION_MONTHLY" as never),
    );
    // Only one findUnique — inside bootstrapCreditLotsIfNeeded
    expect(findUniqueCalls).toBe(1);
  });

  it("does NOT call user.findUnique when lots already exist (no bootstrap)", async () => {
    seedUser({ credits: 50 });
    seedLot({ bucket: "MONTHLY", remainingAmount: 50 });
    const { grantCreditsInTransaction } = await import("../credit.service");
    await mockPrisma.$transaction(async (tx) =>
      grantCreditsInTransaction(tx as never, "user_abc", 100, "SUBSCRIPTION_MONTHLY" as never),
    );
    // creditLot.count fires but user.findUnique should NOT fire again
    expect(findUniqueCalls).toBe(0);
  });

  it("returns the new running total after grant", async () => {
    seedUser({ credits: 50 });
    seedLot({ bucket: "MONTHLY", remainingAmount: 50 });
    const { grantCreditsInTransaction } = await import("../credit.service");
    const total = await mockPrisma.$transaction((tx) =>
      grantCreditsInTransaction(tx as never, "user_abc", 200, "SUBSCRIPTION_MONTHLY" as never),
    );
    expect(total).toBe(250);
  });

  it("increments totalCreditsEarned by the granted amount", async () => {
    seedUser();
    const { grantCreditsInTransaction } = await import("../credit.service");
    await mockPrisma.$transaction((tx) =>
      grantCreditsInTransaction(tx as never, "user_abc", 75, "BONUS" as never, "Test grant"),
    );
    expect(users.get("user_abc")!.totalCreditsEarned).toBe(75);
  });

  it("does NOT increment totalCreditsEarned when countTowardEarned=false", async () => {
    seedUser();
    const { grantCreditsInTransaction } = await import("../credit.service");
    await mockPrisma.$transaction((tx) =>
      grantCreditsInTransaction(tx as never, "user_abc", 100, "ADJUSTMENT" as never, undefined, undefined, { countTowardEarned: false }),
    );
    expect(users.get("user_abc")!.totalCreditsEarned).toBe(0);
  });

  it("creates a credit lot with the correct bucket for each transaction type", async () => {
    seedUser();
    const { grantCreditsInTransaction } = await import("../credit.service");

    await mockPrisma.$transaction((tx) =>
      grantCreditsInTransaction(tx as never, "user_abc", 50, "SUBSCRIPTION_MONTHLY" as never),
    );
    expect(lots.find((l) => l.bucket === "MONTHLY")).toBeDefined();

    await mockPrisma.$transaction((tx) =>
      grantCreditsInTransaction(tx as never, "user_abc", 30, "PURCHASE" as never),
    );
    expect(lots.find((l) => l.bucket === "PURCHASED")).toBeDefined();

    await mockPrisma.$transaction((tx) =>
      grantCreditsInTransaction(tx as never, "user_abc", 20, "BONUS" as never),
    );
    expect(lots.find((l) => l.bucket === "BONUS")).toBeDefined();
  });
});

// ─── I1: now pinned once — expiry consistency ─────────────────────────────────

describe("grantCreditsInTransaction — 'now' is pinned once (I1)", () => {
  it("lot expiresAt matches the grantedAt passed in options (no drift)", async () => {
    seedUser();
    const fixedDate = new Date("2026-06-15T10:00:00.000Z");
    const { grantCreditsInTransaction } = await import("../credit.service");
    await mockPrisma.$transaction((tx) =>
      grantCreditsInTransaction(
        tx as never, "user_abc", 100, "SUBSCRIPTION_MONTHLY" as never,
        undefined, undefined, { grantedAt: fixedDate },
      ),
    );
    // Monthly credits expire at next month boundary from grantedAt
    const monthlyLot = lots.find((l) => l.bucket === "MONTHLY");
    expect(monthlyLot).toBeDefined();
    // Should be 2026-07-01T00:00:00Z (next month UTC boundary from June 15)
    expect(monthlyLot!.expiresAt?.toISOString()).toBe("2026-07-01T00:00:00.000Z");
  });

  it("transaction and lot share the same createdAt timestamp", async () => {
    seedUser();
    const fixedDate = new Date("2026-03-20T08:30:00.000Z");
    const { grantCreditsInTransaction } = await import("../credit.service");
    await mockPrisma.$transaction((tx) =>
      grantCreditsInTransaction(
        tx as never, "user_abc", 50, "BONUS" as never,
        undefined, undefined, { grantedAt: fixedDate },
      ),
    );
    const lot = lots[0];
    const txn = transactions[0];
    expect(lot.createdAt.getTime()).toBe(fixedDate.getTime());
    expect(txn.createdAt.getTime()).toBe(fixedDate.getTime());
  });
});

// ─── I7: resetMonthlyCredits — no side-effect-only getCreditState ─────────────

describe("resetMonthlyCredits (I7)", () => {
  it("zeroes all active MONTHLY lots before granting new ones", async () => {
    seedUser({ credits: 100, monthlyCreditsBalance: 100, plan: "PRO" });
    seedLot({ bucket: "MONTHLY", remainingAmount: 100 });

    const { resetMonthlyCredits } = await import("../credit.service");
    await resetMonthlyCredits("user_abc");

    // The old lot should be zeroed
    expect(lots[0].remainingAmount).toBe(0);
    // A new monthly lot should have been created
    const newMonthly = lots.find((l) => l.remainingAmount === 500);
    expect(newMonthly).toBeDefined();
  });

  it("preserves bonus and purchased lots untouched during monthly reset", async () => {
    seedUser({ credits: 170, monthlyCreditsBalance: 100, bonusCreditsBalance: 40, purchasedCreditsBalance: 30, plan: "PRO" });
    seedLot({ id: "monthly_old", bucket: "MONTHLY", remainingAmount: 100 });
    seedLot({ id: "bonus_keep", bucket: "BONUS", remainingAmount: 40 });
    seedLot({ id: "purchased_keep", bucket: "PURCHASED", remainingAmount: 30 });

    const { resetMonthlyCredits } = await import("../credit.service");
    await resetMonthlyCredits("user_abc");

    const bonus = lots.find((l) => l.id === "bonus_keep")!;
    const purchased = lots.find((l) => l.id === "purchased_keep")!;
    expect(bonus.remainingAmount).toBe(40);
    expect(purchased.remainingAmount).toBe(30);
  });

  it("updates user balance snapshot after reset — credits = monthly + bonus + purchased", async () => {
    seedUser({ credits: 0, monthlyCreditsBalance: 0, bonusCreditsBalance: 25, purchasedCreditsBalance: 0, plan: "PRO" });
    seedLot({ bucket: "BONUS", remainingAmount: 25 });

    const { resetMonthlyCredits } = await import("../credit.service");
    await resetMonthlyCredits("user_abc");

    const u = users.get("user_abc")!;
    expect(u.monthlyCreditsBalance).toBe(500); // PRO plan
    expect(u.bonusCreditsBalance).toBe(25);
    expect(u.credits).toBe(525);
  });

  it("handles user with no existing lots (bootstrap + reset)", async () => {
    seedUser({ credits: 0, plan: "ELITE" });
    // No lots pre-existing
    const { resetMonthlyCredits } = await import("../credit.service");
    await resetMonthlyCredits("user_abc");

    const u = users.get("user_abc")!;
    expect(u.monthlyCreditsBalance).toBe(1500); // ELITE plan
    expect(u.credits).toBe(1500);
  });

  it("is a no-op for unknown userId", async () => {
    // No user seeded
    const { resetMonthlyCredits } = await import("../credit.service");
    await expect(resetMonthlyCredits("nonexistent_user")).resolves.toBeUndefined();
    expect(lots).toHaveLength(0);
  });
});

// ─── O3: getUserCreditSnapshot — single-pass expiry lookup ───────────────────

describe("getUserCreditSnapshot (O3)", () => {
  it("returns null expiries when no bonus or purchased lots exist", async () => {
    seedUser({ credits: 100 });
    seedLot({ bucket: "MONTHLY", remainingAmount: 100, expiresAt: new Date("2026-04-01") });

    const { getUserCreditSnapshot } = await import("../credit.service");
    const snap = await getUserCreditSnapshot("user_abc");
    expect(snap.nextBonusExpiry).toBeNull();
    expect(snap.nextPurchasedExpiry).toBeNull();
  });

  it("returns the earliest bonus lot expiry (not the latest)", async () => {
    seedUser({ credits: 60, bonusCreditsBalance: 60 });
    seedLot({ bucket: "BONUS", remainingAmount: 30, expiresAt: new Date("2026-06-01"), createdAt: new Date("2026-01-01") });
    seedLot({ bucket: "BONUS", remainingAmount: 30, expiresAt: new Date("2026-09-01"), createdAt: new Date("2026-02-01") });

    const { getUserCreditSnapshot } = await import("../credit.service");
    const snap = await getUserCreditSnapshot("user_abc");
    expect(snap.nextBonusExpiry?.toISOString()).toBe(new Date("2026-06-01").toISOString());
  });

  it("returns the earliest purchased lot expiry", async () => {
    seedUser({ credits: 90, purchasedCreditsBalance: 90 });
    seedLot({ bucket: "PURCHASED", remainingAmount: 45, expiresAt: new Date("2027-03-01"), createdAt: new Date("2026-01-01") });
    seedLot({ bucket: "PURCHASED", remainingAmount: 45, expiresAt: new Date("2026-12-01"), createdAt: new Date("2026-02-01") });

    const { getUserCreditSnapshot } = await import("../credit.service");
    const snap = await getUserCreditSnapshot("user_abc");
    expect(snap.nextPurchasedExpiry?.toISOString()).toBe(new Date("2026-12-01").toISOString());
  });

  it("reports total credits = sum of all bucket balances", async () => {
    seedUser({ credits: 0 });
    seedLot({ bucket: "MONTHLY", remainingAmount: 100, expiresAt: new Date("2026-05-01") });
    seedLot({ bucket: "BONUS", remainingAmount: 30, expiresAt: new Date("2026-06-01") });
    seedLot({ bucket: "PURCHASED", remainingAmount: 45, expiresAt: new Date("2027-01-01") });

    const { getUserCreditSnapshot } = await import("../credit.service");
    const snap = await getUserCreditSnapshot("user_abc");

    expect(snap.credits).toBe(175);
    expect(snap.credits).toBe(snap.monthlyCreditsBalance + snap.bonusCreditsBalance + snap.purchasedCreditsBalance);
  });

  it("lots without expiresAt are excluded from expiry calculation but included in balance", async () => {
    seedUser({ credits: 0 });
    seedLot({ bucket: "BONUS", remainingAmount: 50, expiresAt: null });

    const { getUserCreditSnapshot } = await import("../credit.service");
    const snap = await getUserCreditSnapshot("user_abc");
    expect(snap.bonusCreditsBalance).toBe(50);
    expect(snap.nextBonusExpiry).toBeNull();
  });
});
