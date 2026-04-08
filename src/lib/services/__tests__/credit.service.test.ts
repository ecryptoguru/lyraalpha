/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

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

let users = new Map<string, UserRow>();
let lots: CreditLotRow[] = [];
let transactions: CreditTransactionRow[] = [];
let lotId = 0;
let txId = 0;

type ComparisonWhereValue = {
  gt?: number | Date;
  gte?: number | Date;
  lte?: number | Date;
  in?: unknown[];
};

type WhereValue = Date | string | number | boolean | null | undefined | ComparisonWhereValue | WhereInput[];

type WhereInput = Record<string, WhereValue>;

type SelectShape<T extends Record<string, unknown>> = Partial<Record<keyof T, boolean>>;

type SetLikeNumber = number | {
  set?: number;
  increment?: number;
  decrement?: number;
};

function matchesWhere<T extends Record<string, unknown>>(row: T, where: WhereInput): boolean {
  return Object.entries(where).every(([key, value]) => {
    if (key === "OR" && Array.isArray(value)) {
      return value.every((entry) => typeof entry === "object" && entry !== null)
        && value.some((entry) => matchesWhere(row, entry as WhereInput));
    }

    const current = row[key as keyof T];
    if (value && typeof value === "object" && !(value instanceof Date) && !Array.isArray(value)) {
      const comparisonValue = value as ComparisonWhereValue;
      if (comparisonValue.gt !== undefined && !(current > comparisonValue.gt)) return false;
      if (comparisonValue.gte !== undefined && !(current >= comparisonValue.gte)) return false;
      if (comparisonValue.lte !== undefined && !(current <= comparisonValue.lte)) return false;
      if (comparisonValue.in !== undefined && !comparisonValue.in.includes(current)) return false;
      return true;
    }

    return current === value;
  });
}

function pickSelect<T extends Record<string, unknown>>(row: T | null, select?: SelectShape<T>) {
  if (!row || !select) return row;
  return Object.fromEntries(Object.keys(select).map((key) => [key, row[key]]));
}

function applySetLike(current: number, value: SetLikeNumber): number {
  if (typeof value === "number") return value;
  if (value?.set !== undefined) return value.set;
  if (value?.increment !== undefined) return current + value.increment;
  if (value?.decrement !== undefined) return current - value.decrement;
  return current;
}

const mockPrisma = {
  $transaction: vi.fn(async (input: ((tx: unknown) => unknown) | Promise<unknown>[], options?: unknown) => {
    void options;
    if (typeof input === "function") {
      return input(mockPrisma);
    }
    return Promise.all(input);
  }),
  user: {
    findUnique: vi.fn(async ({ where, select }: { where: { id: string }; select?: SelectShape<UserRow> }) => pickSelect(users.get(where.id) ?? null, select)),
    update: vi.fn(async ({ where, data, select }: { where: { id: string }; data: Record<string, SetLikeNumber>; select?: SelectShape<UserRow> }) => {
      const existing = users.get(where.id);
      if (!existing) throw Object.assign(new Error("Record not found"), { code: "P2025" });
      const next: UserRow = {
        ...existing,
        credits: applySetLike(existing.credits, data.credits),
        monthlyCreditsBalance: applySetLike(existing.monthlyCreditsBalance, data.monthlyCreditsBalance),
        bonusCreditsBalance: applySetLike(existing.bonusCreditsBalance, data.bonusCreditsBalance),
        purchasedCreditsBalance: applySetLike(existing.purchasedCreditsBalance, data.purchasedCreditsBalance),
        totalCreditsEarned: applySetLike(existing.totalCreditsEarned, data.totalCreditsEarned),
        totalCreditsSpent: applySetLike(existing.totalCreditsSpent, data.totalCreditsSpent),
      };
      users.set(where.id, next);
      return pickSelect(next, select);
    }),
  },
  creditLot: {
    count: vi.fn(async ({ where }: { where: WhereInput }) => lots.filter((row) => matchesWhere(row, where)).length),
    findMany: vi.fn(async ({ where, select, orderBy }: { where: WhereInput; select?: SelectShape<CreditLotRow>; orderBy?: Array<{ createdAt?: "asc" | "desc" }> }) => {
      let result = lots.filter((row) => matchesWhere(row, where));
      if (orderBy?.[0]?.createdAt === "asc") {
        result = result.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      }
      return result.map((row) => pickSelect(row, select));
    }),
    create: vi.fn(async ({ data }: { data: Omit<CreditLotRow, "id"> & Partial<Pick<CreditLotRow, "transactionId" | "expiresAt" | "createdAt">> }) => {
      const row: CreditLotRow = {
        id: `lot_${++lotId}`,
        userId: data.userId,
        transactionId: data.transactionId ?? null,
        bucket: data.bucket,
        originalAmount: data.originalAmount,
        remainingAmount: data.remainingAmount,
        expiresAt: data.expiresAt ?? null,
        createdAt: data.createdAt ?? new Date(),
      };
      lots.push(row);
      return row;
    }),
    update: vi.fn(async ({ where, data }: { where: { id: string }; data: { remainingAmount: SetLikeNumber } }) => {
      const row = lots.find((entry) => entry.id === where.id);
      if (!row) throw Object.assign(new Error("Record not found"), { code: "P2025" });
      row.remainingAmount = applySetLike(row.remainingAmount, data.remainingAmount);
      return row;
    }),
    updateMany: vi.fn(async ({ where, data }: { where: WhereInput; data: { remainingAmount: SetLikeNumber } }) => {
      let count = 0;
      lots = lots.map((row) => {
        if (!matchesWhere(row, where)) return row;
        count += 1;
        return { ...row, remainingAmount: applySetLike(row.remainingAmount, data.remainingAmount) };
      });
      return { count };
    }),
  },
  creditTransaction: {
    create: vi.fn(async ({ data }: { data: Omit<CreditTransactionRow, "id" | "createdAt"> & Partial<Pick<CreditTransactionRow, "description" | "referenceId" | "expiresAt" | "createdAt">> }) => {
      const row: CreditTransactionRow = {
        id: `txn_${++txId}`,
        userId: data.userId,
        amount: data.amount,
        type: data.type,
        description: data.description,
        referenceId: data.referenceId,
        expiresAt: data.expiresAt ?? null,
        createdAt: data.createdAt ?? new Date(),
      };
      transactions.push(row);
      return row;
    }),
  },
  creditPackage: {
    findMany: vi.fn(async () => []),
  },
};

vi.mock("@/generated/prisma/client", () => ({
  Prisma: {
    TransactionIsolationLevel: {
      ReadUncommitted: "ReadUncommitted",
      ReadCommitted: "ReadCommitted",
      RepeatableRead: "RepeatableRead",
      Serializable: "Serializable",
    },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

vi.mock("@/lib/redis", () => ({
  getCache: vi.fn().mockResolvedValue(null),
  setCache: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/plans/facts", () => ({
  getMonthlyPlanCredits: vi.fn((plan: string) => (plan === "ELITE" ? 1500 : 100)),
  getQueryCreditCost: vi.fn((tier: string) => (tier === "COMPLEX" ? 10 : tier === "MODERATE" ? 5 : 2)),
}));

function seedUser(overrides: Partial<UserRow> = {}) {
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

describe("credit.service lot model", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    users = new Map();
    lots = [];
    transactions = [];
    lotId = 0;
    txId = 0;
  });

  it("bootstraps existing cached credits into a monthly lot instead of zeroing the user", async () => {
    seedUser({ credits: 50, monthlyCreditsBalance: 0, bonusCreditsBalance: 0, purchasedCreditsBalance: 0 });

    const { getUserCredits } = await import("../credit.service");
    const credits = await getUserCredits("user_abc");

    expect(credits).toBe(50);
    expect(lots).toHaveLength(1);
    expect(lots[0].bucket).toBe("MONTHLY");
    expect(lots[0].remainingAmount).toBe(50);
  });

  it("adds purchased credits into an explicit purchased lot with expiry", async () => {
    seedUser();

    const { addCredits } = await import("../credit.service");
    const balance = await addCredits("user_abc", 25, "PURCHASE" as never, "Purchased Starter Pack");

    expect(balance).toBe(25);
    expect(users.get("user_abc")?.purchasedCreditsBalance).toBe(25);
    expect(lots).toHaveLength(1);
    expect(lots[0].bucket).toBe("PURCHASED");
    expect(lots[0].expiresAt).toBeInstanceOf(Date);
  });

  it("spends monthly first, bonus second, purchased last", async () => {
    seedUser({ credits: 12, monthlyCreditsBalance: 5, bonusCreditsBalance: 4, purchasedCreditsBalance: 3 });
    lots.push(
      { id: "lot_1", userId: "user_abc", transactionId: null, bucket: "MONTHLY", originalAmount: 5, remainingAmount: 5, expiresAt: new Date("2099-04-01T00:00:00.000Z"), createdAt: new Date("2099-03-01T00:00:00.000Z") },
      { id: "lot_2", userId: "user_abc", transactionId: null, bucket: "BONUS", originalAmount: 4, remainingAmount: 4, expiresAt: new Date("2099-06-01T00:00:00.000Z"), createdAt: new Date("2099-03-02T00:00:00.000Z") },
      { id: "lot_3", userId: "user_abc", transactionId: null, bucket: "PURCHASED", originalAmount: 3, remainingAmount: 3, expiresAt: new Date("2100-03-02T00:00:00.000Z"), createdAt: new Date("2099-03-03T00:00:00.000Z") },
    );

    const { consumeCredits } = await import("../credit.service");
    const result = await consumeCredits("user_abc", 12, "SIMPLE query");

    expect(result).toEqual({ success: true, remaining: 0 });
    expect(lots.map((lot) => lot.remainingAmount)).toEqual([0, 0, 0]);
    expect(users.get("user_abc")?.credits).toBe(0);
    expect(users.get("user_abc")?.totalCreditsSpent).toBe(12);
  });

  it("resets monthly credits while preserving active bonus and purchased lots", async () => {
    seedUser({ credits: 70, monthlyCreditsBalance: 0, bonusCreditsBalance: 30, purchasedCreditsBalance: 40, plan: "PRO" });
    lots.push(
      { id: "lot_bonus", userId: "user_abc", transactionId: null, bucket: "BONUS", originalAmount: 30, remainingAmount: 30, expiresAt: new Date("2099-06-01T00:00:00.000Z"), createdAt: new Date("2099-03-02T00:00:00.000Z") },
      { id: "lot_purchased", userId: "user_abc", transactionId: null, bucket: "PURCHASED", originalAmount: 40, remainingAmount: 40, expiresAt: new Date("2100-03-02T00:00:00.000Z"), createdAt: new Date("2099-03-03T00:00:00.000Z") },
    );

    const { resetMonthlyCredits } = await import("../credit.service");
    await resetMonthlyCredits("user_abc");

    expect(users.get("user_abc")?.credits).toBe(170);
    expect(users.get("user_abc")?.monthlyCreditsBalance).toBe(100);
    expect(users.get("user_abc")?.bonusCreditsBalance).toBe(30);
    expect(users.get("user_abc")?.purchasedCreditsBalance).toBe(40);
    expect(lots.some((lot) => lot.bucket === "MONTHLY" && lot.remainingAmount === 100)).toBe(true);
  });

  it("ignores expired lots when computing live credits", async () => {
    seedUser({ credits: 25, monthlyCreditsBalance: 0, bonusCreditsBalance: 0, purchasedCreditsBalance: 25 });
    lots.push(
      { id: "lot_expired", userId: "user_abc", transactionId: null, bucket: "PURCHASED", originalAmount: 20, remainingAmount: 20, expiresAt: new Date("2000-01-01T00:00:00.000Z"), createdAt: new Date("1999-12-01T00:00:00.000Z") },
      { id: "lot_active", userId: "user_abc", transactionId: null, bucket: "PURCHASED", originalAmount: 5, remainingAmount: 5, expiresAt: new Date("2099-01-01T00:00:00.000Z"), createdAt: new Date("2098-12-01T00:00:00.000Z") },
    );

    const { getUserCredits } = await import("../credit.service");
    const credits = await getUserCredits("user_abc");

    expect(credits).toBe(5);
    expect(users.get("user_abc")?.credits).toBe(5);
    expect(users.get("user_abc")?.purchasedCreditsBalance).toBe(5);
  });

  it("preserves invariants across spend, grant, and reset in sequence", async () => {
    seedUser({ credits: 50, monthlyCreditsBalance: 20, bonusCreditsBalance: 10, purchasedCreditsBalance: 20, plan: "PRO" });
    lots.push(
      { id: "lot_monthly", userId: "user_abc", transactionId: null, bucket: "MONTHLY", originalAmount: 20, remainingAmount: 20, expiresAt: new Date("2099-04-01T00:00:00.000Z"), createdAt: new Date("2099-03-01T00:00:00.000Z") },
      { id: "lot_bonus", userId: "user_abc", transactionId: null, bucket: "BONUS", originalAmount: 10, remainingAmount: 10, expiresAt: new Date("2099-06-01T00:00:00.000Z"), createdAt: new Date("2099-03-02T00:00:00.000Z") },
      { id: "lot_purchased", userId: "user_abc", transactionId: null, bucket: "PURCHASED", originalAmount: 20, remainingAmount: 20, expiresAt: new Date("2100-03-02T00:00:00.000Z"), createdAt: new Date("2099-03-03T00:00:00.000Z") },
    );

    const { consumeCredits, addCredits, resetMonthlyCredits, getUserCreditSnapshot } = await import("../credit.service");

    await consumeCredits("user_abc", 15, "Scenario test spend");
    await addCredits("user_abc", 25, "BONUS" as never, "Scenario test grant");
    await resetMonthlyCredits("user_abc");
    const snapshot = await getUserCreditSnapshot("user_abc");

    expect(snapshot.monthlyCreditsBalance).toBe(100);
    expect(snapshot.bonusCreditsBalance).toBe(35);
    expect(snapshot.purchasedCreditsBalance).toBe(20);
    expect(snapshot.credits).toBe(155);
    expect(snapshot.credits).toBe(snapshot.monthlyCreditsBalance + snapshot.bonusCreditsBalance + snapshot.purchasedCreditsBalance);
  });
});

describe("getCreditCost", () => {
  it("returns correct costs per tier", async () => {
    const { getCreditCost } = await import("../credit.service");
    expect(getCreditCost("SIMPLE")).toBe(2);
    expect(getCreditCost("MODERATE")).toBe(5);
    expect(getCreditCost("COMPLEX")).toBe(10);
  });
});

describe("calculateMultiAssetAnalysisCredits", () => {
  it("uses 5 credits for the first asset and 3 for each additional asset", async () => {
    const { calculateMultiAssetAnalysisCredits } = await import("../credit.service");
    expect(calculateMultiAssetAnalysisCredits(0)).toBe(0);
    expect(calculateMultiAssetAnalysisCredits(1)).toBe(5);
    expect(calculateMultiAssetAnalysisCredits(2)).toBe(8);
    expect(calculateMultiAssetAnalysisCredits(3)).toBe(11);
    expect(calculateMultiAssetAnalysisCredits(4)).toBe(14);
    expect(calculateMultiAssetAnalysisCredits(5)).toBe(17);
  });
});
