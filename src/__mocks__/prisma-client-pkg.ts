import { vi } from "vitest";

export class PrismaClient {
  $connect = vi.fn();
  $disconnect = vi.fn();
  $transaction = vi.fn();
  $executeRaw = vi.fn();
  $queryRaw = vi.fn();
}

export const Prisma = {
  PrismaClientKnownRequestError: class extends Error { code = "P0000"; },
  PrismaClientValidationError: class extends Error {},
  sql: vi.fn(),
  join: vi.fn(),
  raw: vi.fn(),
  empty: vi.fn(),
  DbNull: "DbNull",
  JsonNull: "JsonNull",
  AnyNull: "AnyNull",
};

export const AssetType = {
  STOCK: "STOCK",
  ETF: "ETF",
  CRYPTO: "CRYPTO",
  COMMODITY: "COMMODITY",
  MUTUAL_FUND: "MUTUAL_FUND",
} as const;

export const ScoreType = {
  TREND: "TREND",
  MOMENTUM: "MOMENTUM",
  VOLATILITY: "VOLATILITY",
  SENTIMENT: "SENTIMENT",
  LIQUIDITY: "LIQUIDITY",
  TRUST: "TRUST",
  SIGNAL_STRENGTH: "SIGNAL_STRENGTH",
  PORTFOLIO_HEALTH: "PORTFOLIO_HEALTH",
} as const;

export const PlanTier = {
  STARTER: "STARTER",
  PRO: "PRO",
  ELITE: "ELITE",
  ENTERPRISE: "ENTERPRISE",
} as const;

export const CreditTransactionType = {
  PURCHASE: "PURCHASE",
  REFERRAL_BONUS: "REFERRAL_BONUS",
  REFERRAL_REDEEMED: "REFERRAL_REDEEMED",
  SUBSCRIPTION_MONTHLY: "SUBSCRIPTION_MONTHLY",
  BONUS: "BONUS",
  SPENT: "SPENT",
  ADJUSTMENT: "ADJUSTMENT",
} as const;

export const EvidenceSourceType = {
  ANNUAL_REPORT: "ANNUAL_REPORT",
  INVESTOR_PRESENTATION: "INVESTOR_PRESENTATION",
  PRESS_RELEASE: "PRESS_RELEASE",
  EXCHANGE_FILING: "EXCHANGE_FILING",
  NEWS_ARTICLE: "NEWS_ARTICLE",
  MANAGEMENT_COMMENTARY: "MANAGEMENT_COMMENTARY",
} as const;

export const InclusionType = {
  CORE_BUSINESS: "CORE_BUSINESS",
  EVENT_DRIVEN: "EVENT_DRIVEN",
  STRUCTURAL_STRENGTH: "STRUCTURAL_STRENGTH",
  STRATEGIC_ALIGNMENT: "STRATEGIC_ALIGNMENT",
  NARRATIVE_SIGNAL: "NARRATIVE_SIGNAL",
} as const;

export const PointSource = {
  DAILY_LOGIN: "DAILY_LOGIN",
  LYRA_QUERY: "LYRA_QUERY",
  LEARNING_COMPLETE: "LEARNING_COMPLETE",
  QUIZ_PASS: "QUIZ_PASS",
  WATCHLIST_ADD: "WATCHLIST_ADD",
  DISCOVERY_CLICK: "DISCOVERY_CLICK",
  SHARE_ANALYSIS: "SHARE_ANALYSIS",
  REFERRAL: "REFERRAL",
  FIRST_PURCHASE: "FIRST_PURCHASE",
} as const;

export const PointRedemptionType = {
  CREDITS_10: "CREDITS_10",
  CREDITS_25: "CREDITS_25",
  PRO_TRIAL_7D: "PRO_TRIAL_7D",
  ELITE_TRIAL_7D: "ELITE_TRIAL_7D",
} as const;

export type Asset = {
  id: string;
  symbol: string;
  name: string;
  type: string;
  price: number | null;
  marketCap: number | null;
  volume24h: number | null;
  high52w: number | null;
  low52w: number | null;
};
