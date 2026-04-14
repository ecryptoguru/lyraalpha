import { prisma } from "../prisma";
import { Prisma } from "@/generated/prisma/client";
import { CreditTransactionType } from "@/generated/prisma/enums";
import { getCache, setCache } from "@/lib/redis";
import { calculateMultiAssetAnalysisCredits } from "@/lib/credits/cost";
import { getMonthlyPlanCredits, getQueryCreditCost } from "@/lib/plans/facts";

const CreditLotBucket = {
  MONTHLY: "MONTHLY",
  BONUS: "BONUS",
  PURCHASED: "PURCHASED",
} as const;

type CreditLotBucket = (typeof CreditLotBucket)[keyof typeof CreditLotBucket];

const PACKAGE_CACHE_KEY = "credit:packages";
const PACKAGE_CACHE_TTL_SECONDS = 60 * 60;

type CreditBuckets = {
  credits: number;
  monthlyCreditsBalance: number;
  bonusCreditsBalance: number;
  purchasedCreditsBalance: number;
};

type ActiveCreditLot = {
  id: string;
  bucket: CreditLotBucket;
  remainingAmount: number;
  expiresAt: Date | null;
  createdAt: Date;
};

type CreditState = {
  balances: CreditBuckets;
  lots: ActiveCreditLot[];
};

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

function getNextMonthBoundary(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1, 0, 0, 0, 0));
}

function getCreditExpiry(type: CreditTransactionType, grantedAt: Date): Date | null {
  if (type === CreditTransactionType.SUBSCRIPTION_MONTHLY) {
    return getNextMonthBoundary(grantedAt);
  }

  if (type === CreditTransactionType.PURCHASE) {
    const expiry = new Date(grantedAt);
    expiry.setUTCFullYear(expiry.getUTCFullYear() + 1);
    return expiry;
  }

  if (
    type === CreditTransactionType.BONUS ||
    type === CreditTransactionType.REFERRAL_BONUS ||
    type === CreditTransactionType.REFERRAL_REDEEMED ||
    type === CreditTransactionType.ADJUSTMENT
  ) {
    const expiry = new Date(grantedAt);
    expiry.setUTCMonth(expiry.getUTCMonth() + 3);
    return expiry;
  }

  return null;
}

function getCreditBucket(type: CreditTransactionType): CreditLotBucket {
  if (type === CreditTransactionType.SUBSCRIPTION_MONTHLY) {
    return CreditLotBucket.MONTHLY;
  }

  if (type === CreditTransactionType.PURCHASE) {
    return CreditLotBucket.PURCHASED;
  }

  return CreditLotBucket.BONUS;
}

function summarizeCreditLots(lots: ActiveCreditLot[]): CreditBuckets {
  const balances: CreditBuckets = {
    credits: 0,
    monthlyCreditsBalance: 0,
    bonusCreditsBalance: 0,
    purchasedCreditsBalance: 0,
  };

  for (const lot of lots) {
    balances.credits += lot.remainingAmount;
    if (lot.bucket === CreditLotBucket.MONTHLY) {
      balances.monthlyCreditsBalance += lot.remainingAmount;
      continue;
    }
    if (lot.bucket === CreditLotBucket.BONUS) {
      balances.bonusCreditsBalance += lot.remainingAmount;
      continue;
    }
    balances.purchasedCreditsBalance += lot.remainingAmount;
  }

  return balances;
}

function sortCreditLots(lots: ActiveCreditLot[]): ActiveCreditLot[] {
  const bucketPriority: Record<CreditLotBucket, number> = {
    [CreditLotBucket.MONTHLY]: 0,
    [CreditLotBucket.BONUS]: 1,
    [CreditLotBucket.PURCHASED]: 2,
  };

  return [...lots].sort((left, right) => {
    const priorityDiff = bucketPriority[left.bucket] - bucketPriority[right.bucket];
    if (priorityDiff !== 0) return priorityDiff;

    const leftExpiry = left.expiresAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const rightExpiry = right.expiresAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
    if (leftExpiry !== rightExpiry) return leftExpiry - rightExpiry;

    return left.createdAt.getTime() - right.createdAt.getTime();
  });
}

async function getActiveCreditLots(tx: Tx, userId: string, now: Date): Promise<ActiveCreditLot[]> {
  return tx.creditLot.findMany({
    where: {
      userId,
      remainingAmount: { gt: 0 },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    select: {
      id: true,
      bucket: true,
      remainingAmount: true,
      expiresAt: true,
      createdAt: true,
    },
    orderBy: [{ createdAt: "asc" }],
  });
}

async function persistCreditBalances(
  tx: Tx,
  userId: string,
  balances: CreditBuckets,
  extra?: {
    totalCreditsEarnedIncrement?: number;
    totalCreditsSpentIncrement?: number;
  },
): Promise<void> {
  await (tx.user.update as (args: object) => Promise<unknown>)({
    where: { id: userId },
    data: {
      credits: { set: balances.credits },
      monthlyCreditsBalance: { set: balances.monthlyCreditsBalance },
      bonusCreditsBalance: { set: balances.bonusCreditsBalance },
      purchasedCreditsBalance: { set: balances.purchasedCreditsBalance },
      ...(extra?.totalCreditsEarnedIncrement
        ? { totalCreditsEarned: { increment: extra.totalCreditsEarnedIncrement } }
        : {}),
      ...(extra?.totalCreditsSpentIncrement
        ? { totalCreditsSpent: { increment: extra.totalCreditsSpentIncrement } }
        : {}),
    },
  });
}

async function createCreditGrant(
  tx: Tx,
  userId: string,
  amount: number,
  type: CreditTransactionType,
  description?: string,
  referenceId?: string,
  grantedAt = new Date(),
): Promise<void> {
  const expiresAt = getCreditExpiry(type, grantedAt);
  const transaction = await tx.creditTransaction.create({
    data: {
      userId,
      amount,
      type,
      description,
      referenceId,
      expiresAt,
      createdAt: grantedAt,
    },
  });

  await tx.creditLot.create({
    data: {
      userId,
      transactionId: transaction.id,
      bucket: getCreditBucket(type),
      originalAmount: amount,
      remainingAmount: amount,
      expiresAt,
      createdAt: grantedAt,
    },
  });
}

async function bootstrapCreditLotsIfNeeded(tx: Tx, userId: string, now: Date): Promise<void> {
  const existingLotCount = await tx.creditLot.count({ where: { userId } });
  if (existingLotCount > 0) return;

  const user = await tx.user.findUnique({
    where: { id: userId },
    select: {
      credits: true,
      monthlyCreditsBalance: true,
      bonusCreditsBalance: true,
      purchasedCreditsBalance: true,
    },
  });

  if (!user) return;

  let monthlyCredits = user.monthlyCreditsBalance;
  const bonusCredits = user.bonusCreditsBalance;
  const purchasedCredits = user.purchasedCreditsBalance;

  if (monthlyCredits === 0 && bonusCredits === 0 && purchasedCredits === 0 && user.credits > 0) {
    monthlyCredits = user.credits;
  }

  if (monthlyCredits > 0) {
    await createCreditGrant(tx, userId, monthlyCredits, CreditTransactionType.SUBSCRIPTION_MONTHLY, "Bootstrap monthly credits", undefined, now);
  }

  if (bonusCredits > 0) {
    await createCreditGrant(tx, userId, bonusCredits, CreditTransactionType.BONUS, "Bootstrap bonus credits", undefined, now);
  }

  if (purchasedCredits > 0) {
    await createCreditGrant(tx, userId, purchasedCredits, CreditTransactionType.PURCHASE, "Bootstrap purchased credits", undefined, now);
  }
}

async function getCreditState(tx: Tx, userId: string, now = new Date()): Promise<CreditState> {
  const user = await tx.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) {
    return {
      lots: [],
      balances: {
        credits: 0,
        monthlyCreditsBalance: 0,
        bonusCreditsBalance: 0,
        purchasedCreditsBalance: 0,
      },
    };
  }

  await bootstrapCreditLotsIfNeeded(tx, userId, now);
  const lots = await getActiveCreditLots(tx, userId, now);
  const balances = summarizeCreditLots(lots);
  await persistCreditBalances(tx, userId, balances);
  return { lots, balances };
}

export async function grantCreditsInTransaction(
  tx: Tx,
  userId: string,
  amount: number,
  type: CreditTransactionType,
  description?: string,
  referenceId?: string,
  options?: {
    countTowardEarned?: boolean;
    grantedAt?: Date;
  },
): Promise<number> {
  const now = options?.grantedAt ?? new Date();
  await bootstrapCreditLotsIfNeeded(tx, userId, now);
  await createCreditGrant(tx, userId, amount, type, description, referenceId, now);
  const lots = await getActiveCreditLots(tx, userId, now);
  const balances = summarizeCreditLots(lots);
  await persistCreditBalances(tx, userId, balances, {
    totalCreditsEarnedIncrement: options?.countTowardEarned === false ? 0 : amount,
  });
  return balances.credits;
}

export async function getUserCredits(userId: string): Promise<number> {
  const balances = await prisma.$transaction(async (tx) => {
    const state = await getCreditState(tx, userId);
    return state.balances;
  });

  return balances.credits;
}

/**
 * Read-only credit balance check — skips persistCreditBalances and bootstrap.
 * Use this for hot-path checks (e.g. credit-gate) where write amplification is undesirable.
 * Falls back to the User row's denormalized balances which are kept in sync by write paths.
 */
export async function getUserCreditsReadOnly(userId: string): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { credits: true },
  });
  return user?.credits ?? 0;
}

export async function getUserCreditSnapshot(userId: string): Promise<CreditBuckets & { nextBonusExpiry: Date | null; nextPurchasedExpiry: Date | null }> {
  return prisma.$transaction(async (tx) => {
    const state = await getCreditState(tx, userId);

    let nextBonusExpiry: Date | null = null;
    let nextPurchasedExpiry: Date | null = null;
    for (const lot of state.lots) {
      if (!lot.expiresAt) continue;
      if (lot.bucket === CreditLotBucket.BONUS) {
        if (!nextBonusExpiry || lot.expiresAt < nextBonusExpiry) nextBonusExpiry = lot.expiresAt;
      } else if (lot.bucket === CreditLotBucket.PURCHASED) {
        if (!nextPurchasedExpiry || lot.expiresAt < nextPurchasedExpiry) nextPurchasedExpiry = lot.expiresAt;
      }
    }

    return {
      ...state.balances,
      nextBonusExpiry,
      nextPurchasedExpiry,
    };
  });
}

export { calculateMultiAssetAnalysisCredits };

export async function consumeCredits(
  userId: string,
  amount: number,
  description?: string,
): Promise<{ success: boolean; remaining: number }> {
  return prisma.$transaction(async (tx) => {
    const currentState = await getCreditState(tx, userId);
    if (currentState.balances.credits < amount) {
      return { success: false, remaining: currentState.balances.credits };
    }

    let remainingToSpend = amount;
    const sortedLots = sortCreditLots(currentState.lots);

    // Track per-bucket deductions to compute new balances without a second getCreditState call
    let monthlyDeduction = 0;
    let bonusDeduction = 0;
    let purchasedDeduction = 0;

    for (const lot of sortedLots) {
      if (remainingToSpend <= 0) break;
      const spendAmount = Math.min(lot.remainingAmount, remainingToSpend);
      if (spendAmount <= 0) continue;
      await tx.creditLot.update({
        where: { id: lot.id },
        data: { remainingAmount: { decrement: spendAmount } },
      });
      remainingToSpend -= spendAmount;

      if (lot.bucket === CreditLotBucket.MONTHLY) monthlyDeduction += spendAmount;
      else if (lot.bucket === CreditLotBucket.BONUS) bonusDeduction += spendAmount;
      else purchasedDeduction += spendAmount;
    }

    await tx.creditTransaction.create({
      data: {
        userId,
        amount: -amount,
        type: CreditTransactionType.SPENT,
        description: description ?? "AI query",
      },
    });

    // Compute new balances from the first getCreditState result — avoids 6+ extra DB queries
    const newBalances: CreditBuckets = {
      credits: currentState.balances.credits - amount,
      monthlyCreditsBalance: currentState.balances.monthlyCreditsBalance - monthlyDeduction,
      bonusCreditsBalance: currentState.balances.bonusCreditsBalance - bonusDeduction,
      purchasedCreditsBalance: currentState.balances.purchasedCreditsBalance - purchasedDeduction,
    };
    await persistCreditBalances(tx, userId, newBalances, { totalCreditsSpentIncrement: amount });
    return { success: true, remaining: newBalances.credits };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}

export async function addCredits(
  userId: string,
  amount: number,
  type: CreditTransactionType,
  description?: string,
  referenceId?: string,
): Promise<number> {
  return prisma.$transaction(async (tx) => {
    return grantCreditsInTransaction(tx, userId, amount, type, description, referenceId);
  });
}

export async function resetMonthlyCredits(userId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { plan: true },
    });
    if (!user) return;

    const now = new Date();
    await bootstrapCreditLotsIfNeeded(tx, userId, now);
    await tx.creditLot.updateMany({
      where: {
        userId,
        bucket: CreditLotBucket.MONTHLY,
        remainingAmount: { gt: 0 },
      },
      data: { remainingAmount: 0 },
    });

    await createCreditGrant(
      tx,
      userId,
      getMonthlyPlanCredits(user.plan),
      CreditTransactionType.SUBSCRIPTION_MONTHLY,
      `Monthly ${user.plan} credits reset`,
      undefined,
      now,
    );

    const lots = await getActiveCreditLots(tx, userId, now);
    await persistCreditBalances(tx, userId, summarizeCreditLots(lots));
  });
}

/**
 * Returns the credit cost for a given query complexity.
 * Note: Currently identical across all plan tiers. If per-plan pricing is
 * introduced in the future, update the costs map below.
 */
export function getCreditCost(
  queryComplexity: "SIMPLE" | "MODERATE" | "COMPLEX",
): number {
  return getQueryCreditCost(queryComplexity);
}

export async function getCreditPackages() {
  const cached = await getCache<Awaited<ReturnType<typeof prisma.creditPackage.findMany>>>(PACKAGE_CACHE_KEY);
  if (cached) return cached;

  const packages = await prisma.creditPackage.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });
  await setCache(PACKAGE_CACHE_KEY, packages, PACKAGE_CACHE_TTL_SECONDS);
  return packages;
}
