import { z } from "zod";

// ─── Sanitization Helpers ────────────────────────────────────────────────────

const SafeString = z.string().max(500).trim();
const SafeSymbol = z.string().min(1).max(20).regex(/^[A-Za-z0-9._\-:^=]+$/, "Invalid symbol format");
const SafeSlug = z.string().min(1).max(100).regex(/^[a-z0-9\-]+$/, "Invalid slug format");
const SafeRegion = z.enum(["US", "IN"]).default("US");
export const DashboardModeSchema = z.enum(["simple", "advanced"]);
const SafeAssetType = z.enum(["STOCK", "ETF", "CRYPTO", "COMMODITY", "MUTUAL_FUND"]);
const SafeLimit = (max: number, def: number) => z.coerce.number().int().min(1).max(max).default(def);
const SafeOffset = z.coerce.number().int().min(0).max(10000).default(0);

// ─── Chat API ────────────────────────────────────────────────────────────────

const ChatCompareItemSchema = z.object({
  symbol: SafeSymbol,
  name: z.string().max(200).optional(),
  assetType: z.string().max(30).optional(),
  region: z.string().max(10).optional(),
  price: z.number().finite().nullable().optional(),
  changePercent: z.number().finite().nullable().optional(),
  summary: z.string().max(2000).optional(),
  priceData: z.record(z.string(), z.unknown()).optional(),
});

export const ChatContextDataSchema = z.object({
  symbol: SafeSymbol.optional(),
  assetName: z.string().max(200).optional(),
  assetType: z.string().max(30).optional(),
  region: z.enum(["US", "IN"]).optional(),
  regime: z.string().max(100).optional(),
  chatMode: z.string().max(50).optional(),
  scores: z.record(z.string().max(50), z.number().finite()).optional(),
  compareContext: z.array(ChatCompareItemSchema).max(10).optional(),
}).catchall(z.unknown());

export const ChatMessageSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant", "system", "tool"]),
        content: z.string().max(50000),
        name: z.string().max(100).optional(),
        tool_call_id: z.string().max(100).optional(),
      }),
    )
    .min(1, "At least one message is required")
    .max(50, "Too many messages"),
  symbol: SafeSymbol.optional(),
  contextData: ChatContextDataSchema.optional(),
  sourcesLimit: z.number().int().min(1).max(10).optional(),
  skipAssetLinks: z.boolean().optional(),
  cacheScope: z.string().regex(/^[a-z0-9-]+$/i).max(80).optional(),
});

// ─── Stock History API ───────────────────────────────────────────────────────

export const StockHistorySchema = z.object({
  symbol: SafeSymbol,
  range: z
    .enum(["1d", "5d", "1mo", "3mo", "6mo", "1y", "2y", "5y", "10y", "ytd", "max"])
    .optional()
    .default("1y"),
  interval: z
    .enum(["1m", "2m", "5m", "15m", "30m", "60m", "90m", "1h", "1d", "5d", "1wk", "1mo", "3mo"])
    .optional(),
});

// ─── Trending Analytics ──────────────────────────────────────────────────────

export const TrendingTrackSchema = z.object({
  questionId: z.string().min(1).max(100),
});

// ─── Discovery Feed API ──────────────────────────────────────────────────────

export const DiscoveryFeedSchema = z.object({
  type: z.enum(["all", "stock", "etf", "crypto", "commodity", "mf"]).default("all"),
  region: SafeRegion,
  limit: SafeLimit(50, 20),
  offset: SafeOffset,
});

// ─── Discovery Search API ────────────────────────────────────────────────────

export const DiscoverySearchSchema = z.object({
  q: z.string().min(2, "Query too short").max(100).trim(),
});

// ─── Discovery Explain API ───────────────────────────────────────────────────

export const DiscoveryExplainSchema = z.object({
  symbol: SafeSymbol,
  question: z.string().min(1).max(2000).optional(),
});

// ─── Intelligence Feed API ───────────────────────────────────────────────────

export const IntelligenceFeedSchema = z.object({
  limit: SafeLimit(100, 30),
  type: z.string().max(200).regex(/^[A-Z_,]+$/).optional(),
  severity: z.enum(["HIGH", "MEDIUM", "LOW"]).optional(),
  provider: SafeString.optional(),
  region: SafeRegion,
  assetType: SafeAssetType.optional(),
});

// ─── Intelligence Calendars API ──────────────────────────────────────────────

export const IntelligenceCalendarsSchema = z.object({
  type: z.enum(["earnings", "economic", "ipo", "market_news"]).default("earnings"),
});

// ─── Learning XP API ─────────────────────────────────────────────────────────

export const LearningXPSchema = z.object({
  action: z.enum(["explain_score", "complete_module", "discovery_explore", "lyra_question", "weekly_streak"]),
  context: z.string().max(500).optional(),
});

// ─── Learning Module API ─────────────────────────────────────────────────────

export const LearningModuleSlugSchema = z.object({
  slug: SafeSlug,
});

// ─── Stocks Quotes API ───────────────────────────────────────────────────────

export const StocksQuotesSchema = z.object({
  symbols: z.string().min(1).max(500).transform((val) =>
    val.split(",").map((s) => s.trim()).filter((s) => s.length > 0)
  ).pipe(z.array(SafeSymbol).min(1).max(20)),
});

// ─── Stress Test API ─────────────────────────────────────────────────────────

export const StressTestSchema = z.object({
  symbols: z.array(SafeSymbol).min(1, "At least 1 symbol required").max(3, "Max 3 symbols"),
  scenarioId: z.enum(["gfc-2008", "covid-2020", "rate-shock-2022", "recession", "interest-rate-shock", "tech-bubble-crash", "oil-spike"]),
  region: SafeRegion,
});

// ─── Stocks Movers API ───────────────────────────────────────────────────────

export const StocksMoversSchema = z.object({
  region: SafeRegion,
  type: SafeAssetType.optional(),
  limit: SafeLimit(20, 5),
});

// ─── Stocks Analytics API ────────────────────────────────────────────────────

export const StocksAnalyticsSchema = z.object({
  symbol: SafeSymbol,
});

// ─── Lyra Related API ────────────────────────────────────────────────────────

export const LyraRelatedSchema = z.object({
  symbol: SafeSymbol,
  question: z.string().min(1).max(2000).optional(),
});

// ─── Sector Regime API ───────────────────────────────────────────────────────

export const SectorRegimeSchema = z.object({
  slug: SafeSlug,
});

// ─── Market Regime Multi-Horizon API ─────────────────────────────────────────

export const MarketRegimeSchema = z.object({
  region: SafeRegion,
});

// ─── User Preferences / Onboarding API ───────────────────────────────────────

export const UserPreferencesSchema = z.object({
  preferredRegion: z.enum(["US", "IN", "BOTH"]),
  experienceLevel: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]),
  dashboardMode: DashboardModeSchema.optional(),
  interests: z
    .array(z.enum(["STOCKS", "ETF", "CRYPTO", "MUTUAL_FUNDS", "COMMODITIES"]))
    .min(1)
    .max(5),
  tourCompleted: z.boolean().default(true),
  onboardingCompleted: z.boolean().default(true),
});

export const BlogSubscriptionSchema = z.object({
  blogSubscribed: z.boolean(),
});

export const NotificationPreferencesSchema = z.object({
  emailNotifications: z.boolean(),
  pushNotifications: z.boolean(),
  newsAlerts: z.boolean(),
  morningIntelligence: z.boolean(),
  portfolioAlerts: z.boolean(),
  opportunityAlerts: z.boolean(),
  narrativeAlerts: z.boolean(),
  shockWarnings: z.boolean(),
  weeklyReports: z.boolean(),
});

export const ProfileUpdateSchema = z.object({
  firstName: z.string().max(100).trim(),
  lastName: z.string().max(100).trim(),
  phone: z.string().max(30).trim().optional(),
});

// ─── Portfolio API ────────────────────────────────────────────────────────────

export const CreatePortfolioSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  description: z.string().max(500).trim().optional(),
  currency: z.enum(["USD", "INR"]).default("USD"),
  region: z.enum(["US", "IN"]).default("US"),
});

export const UpdatePortfolioSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  description: z.string().max(500).trim().optional(),
});

export const AddHoldingSchema = z.object({
  symbol: z.string().min(1).max(20).regex(/^[A-Za-z0-9._\-:^=]+$/, "Invalid symbol format"),
  quantity: z.number().positive("Quantity must be positive"),
  avgPrice: z.number().positive("Average price must be positive"),
});

export const UpdateHoldingSchema = z.object({
  quantity: z.number().positive("Quantity must be positive").optional(),
  avgPrice: z.number().positive("Average price must be positive").optional(),
});

export const SimulatePortfolioSchema = z.object({
  mode: z.enum(["A", "B", "C", "D"]).default("B"),
  horizon: z.enum(["20", "60"]).default("20").transform(Number),
  paths: z.coerce.number().int().min(100).max(2000).default(1000),
});

export const PortfolioQuerySchema = z.object({
  region: z.enum(["US", "IN"]).optional(),
});

// ─── Broker Integration / Normalization Schema ──────────────────────────────

const BrokerProviderSchema = z.enum([
  "zerodha",
  "upstox",
  "angel_one",
  "dhan",
  "fyers",
  "groww",
  "icici_direct",
  "kotak_neo",
  "five_paisa",
  "motilal_oswal",
  "shoonya",
  "alice_blue",
  "hdfc_securities",
  "axis_direct",
  "plaid",
  "alpaca",
]);

const BrokerRegionSchema = z.enum(["IN", "US", "GLOBAL"]);
const BrokerAccessModelSchema = z.enum(["public_api", "partner_api", "oauth", "sdk", "statement", "email", "manual"]);
const BrokerAssetClassSchema = z.enum(["STOCK", "ETF", "MUTUAL_FUND", "CRYPTO", "COMMODITY", "BOND", "CASH_EQUIVALENT", "DERIVATIVE", "OTHER"]);
const BrokerTransactionTypeSchema = z.enum(["buy", "sell", "dividend", "switch", "transfer", "fee", "interest", "deposit", "withdrawal", "split", "merger", "corporate_action"]);
const BrokerSyncScopeSchema = z.enum(["holdings", "positions", "transactions", "balances", "orders"]);

export const BrokerIntegrationMatrixEntrySchema = z.object({
  rank: z.coerce.number().int().min(1),
  provider: BrokerProviderSchema,
  label: z.string().min(1).max(100),
  region: BrokerRegionSchema,
  accessModel: BrokerAccessModelSchema,
  scope: z.array(BrokerSyncScopeSchema).min(1),
  authNotes: z.string().min(1).max(500),
  productionNotes: z.string().min(1).max(500),
  phase: z.enum(["phase_1", "phase_2", "phase_3", "fallback"]),
});

export const BrokerSourceReferenceSchema = z.object({
  provider: BrokerProviderSchema,
  region: BrokerRegionSchema,
  accountId: z.string().min(1).max(120),
  externalAccountId: z.string().max(120).nullable().optional(),
  accessModel: BrokerAccessModelSchema,
  providerVersion: z.string().max(40).nullable().optional(),
  fetchedAt: z.string().datetime(),
  cursor: z.string().max(500).nullable().optional(),
  rawRef: z.string().max(500).nullable().optional(),
});

export const BrokerInstrumentIdentitySchema = z.object({
  symbol: z.string().min(1).max(24),
  name: z.string().min(1).max(200),
  isin: z.string().max(32).nullable().optional(),
  exchange: z.string().max(20).nullable().optional(),
  currency: z.enum(["USD", "INR"]),
  assetClass: BrokerAssetClassSchema,
  region: BrokerRegionSchema,
  sector: z.string().max(120).nullable().optional(),
  industry: z.string().max(120).nullable().optional(),
});

export const BrokerLotSchema = z.object({
  lotId: z.string().max(120).nullable().optional(),
  acquiredAt: z.string().datetime().nullable().optional(),
  quantity: z.number(),
  costBasis: z.number().nullable().optional(),
  averagePrice: z.number().nullable().optional(),
});

export const BrokerCashBalanceSchema = z.object({
  currency: z.enum(["USD", "INR"]),
  available: z.number(),
  settled: z.number().nullable().optional(),
  marginUsed: z.number().nullable().optional(),
  collateral: z.number().nullable().optional(),
  blocked: z.number().nullable().optional(),
  asOf: z.string().datetime(),
});

export const BrokerHoldingSchema = z.object({
  source: BrokerSourceReferenceSchema,
  instrument: BrokerInstrumentIdentitySchema,
  quantity: z.number(),
  averagePrice: z.number(),
  marketPrice: z.number().nullable().optional(),
  marketValue: z.number().nullable().optional(),
  costBasis: z.number().nullable().optional(),
  unrealizedPnl: z.number().nullable().optional(),
  unrealizedPnlPercent: z.number().nullable().optional(),
  dayChange: z.number().nullable().optional(),
  dayChangePercent: z.number().nullable().optional(),
  weight: z.number().nullable().optional(),
  lotCount: z.number().int().nullable().optional(),
  confidence: z.number().min(0).max(1),
  lots: z.array(BrokerLotSchema).optional(),
  raw: z.record(z.string(), z.unknown()).optional(),
});

export const BrokerPositionSchema = z.object({
  source: BrokerSourceReferenceSchema,
  instrument: BrokerInstrumentIdentitySchema,
  side: z.enum(["long", "short", "flat"]),
  quantity: z.number(),
  overnightQuantity: z.number().nullable().optional(),
  averagePrice: z.number(),
  marketPrice: z.number().nullable().optional(),
  marketValue: z.number().nullable().optional(),
  costBasis: z.number().nullable().optional(),
  unrealizedPnl: z.number().nullable().optional(),
  unrealizedPnlPercent: z.number().nullable().optional(),
  margin: z.number().nullable().optional(),
  leverage: z.number().nullable().optional(),
  dayChange: z.number().nullable().optional(),
  dayChangePercent: z.number().nullable().optional(),
  confidence: z.number().min(0).max(1),
  raw: z.record(z.string(), z.unknown()).optional(),
});

export const BrokerTransactionSchema = z.object({
  source: BrokerSourceReferenceSchema,
  instrument: BrokerInstrumentIdentitySchema,
  transactionType: BrokerTransactionTypeSchema,
  quantity: z.number(),
  price: z.number(),
  amount: z.number(),
  tradeDate: z.string().datetime(),
  settlementDate: z.string().datetime().nullable().optional(),
  orderId: z.string().max(120).nullable().optional(),
  tradeId: z.string().max(120).nullable().optional(),
  status: z.string().max(50).nullable().optional(),
  fees: z.number().nullable().optional(),
  taxes: z.number().nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
  raw: z.record(z.string(), z.unknown()).optional(),
});

export const BrokerAccountSchema = z.object({
  source: BrokerSourceReferenceSchema,
  displayName: z.string().min(1).max(150),
  brokerAccountId: z.string().max(120).nullable().optional(),
  accountType: z.string().max(80).nullable().optional(),
  status: z.string().max(50).nullable().optional(),
  currency: z.enum(["USD", "INR"]),
  portfolioValue: z.number().nullable().optional(),
  cashBalance: BrokerCashBalanceSchema.nullable().optional(),
  buyingPower: z.number().nullable().optional(),
  marginAvailable: z.number().nullable().optional(),
  netLiquidation: z.number().nullable().optional(),
  raw: z.record(z.string(), z.unknown()).optional(),
});

export const BrokerPortfolioSnapshotSchema = z.object({
  provider: BrokerProviderSchema,
  region: BrokerRegionSchema,
  capturedAt: z.string().datetime(),
  accounts: z.array(BrokerAccountSchema),
  holdings: z.array(BrokerHoldingSchema),
  positions: z.array(BrokerPositionSchema),
  transactions: z.array(BrokerTransactionSchema),
  cashBalances: z.array(BrokerCashBalanceSchema),
  sourcePayloads: z.array(z.record(z.string(), z.unknown())),
  warnings: z.array(z.string().max(500)),
  confidence: z.number().min(0).max(1),
});

export const BrokerNormalizationResultSchema = z.object({
  snapshot: BrokerPortfolioSnapshotSchema,
  provider: BrokerProviderSchema,
  region: BrokerRegionSchema,
  connectorVersion: z.string().min(1).max(40),
  normalizedAt: z.string().datetime(),
  sourceCount: z.number().int().min(0),
  accountCount: z.number().int().min(0),
  holdingCount: z.number().int().min(0),
  positionCount: z.number().int().min(0),
  transactionCount: z.number().int().min(0),
  warnings: z.array(z.string().max(500)),
});

// ─── Broker Connector / Auth / Dedup Schemas ─────────────────────────────────

export const BrokerCredentialsSchema = z.record(z.string(), z.string());

export const BrokerAuthHandleSchema = z.object({
  provider: BrokerProviderSchema,
  accessToken: z.string().min(1).max(2048),
  refreshToken: z.string().max(2048).nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
});

export const BrokerInstrumentKeySchema = z.object({
  isin: z.string().max(32).nullable(),
  symbol: z.string().min(1).max(24),
  exchange: z.string().max(20).nullable(),
  region: BrokerRegionSchema,
});

export const BrokerMergedHoldingSchema = z.object({
  key: BrokerInstrumentKeySchema,
  instrument: BrokerInstrumentIdentitySchema,
  totalQuantity: z.number(),
  weightedAveragePrice: z.number(),
  totalMarketValue: z.number().nullable(),
  totalCostBasis: z.number().nullable(),
  totalUnrealizedPnl: z.number().nullable(),
  sources: z.array(BrokerSourceReferenceSchema),
  contributions: z.array(BrokerHoldingSchema),
  confidence: z.number().min(0).max(1),
});

export const BrokerDeduplicationResultSchema = z.object({
  mergedHoldings: z.array(BrokerMergedHoldingSchema),
  mergedPositions: z.array(BrokerPositionSchema),
  totalHoldingsBefore: z.number().int().min(0),
  totalHoldingsAfter: z.number().int().min(0),
  duplicatesRemoved: z.number().int().min(0),
  warnings: z.array(z.string().max(500)),
});

const BrokerHoldingFieldSchema = z.union([
  z.literal("source"),
  z.literal("instrument"),
  z.literal("quantity"),
  z.literal("averagePrice"),
  z.literal("marketPrice"),
  z.literal("marketValue"),
  z.literal("costBasis"),
  z.literal("unrealizedPnl"),
  z.literal("unrealizedPnlPercent"),
  z.literal("dayChange"),
  z.literal("dayChangePercent"),
  z.literal("weight"),
  z.literal("lotCount"),
  z.literal("confidence"),
  z.literal("lots"),
  z.literal("raw"),
  z.literal("symbol"),
  z.literal("name"),
  z.literal("isin"),
  z.literal("exchange"),
  z.literal("currency"),
  z.literal("assetClass"),
  z.literal("region"),
  z.literal("sector"),
  z.literal("industry"),
  z.literal("provider"),
  z.literal("accountId"),
  z.literal("externalAccountId"),
  z.literal("accessModel"),
  z.literal("providerVersion"),
  z.literal("fetchedAt"),
  z.literal("cursor"),
  z.literal("rawRef"),
]);

export const BrokerFieldMapSchema = z.object({
  sourceField: z.string().min(1).max(120),
  targetField: BrokerHoldingFieldSchema,
  required: z.boolean().optional(),
});

export const BrokerNormalizerConfigSchema = z.object({
  provider: BrokerProviderSchema,
  holdingFieldMap: z.array(BrokerFieldMapSchema),
  positionFieldMap: z.array(BrokerFieldMapSchema),
  transactionFieldMap: z.array(BrokerFieldMapSchema),
  assetClassMap: z.record(
    z.string(),
    z.enum(["STOCK", "ETF", "MUTUAL_FUND", "CRYPTO", "COMMODITY", "BOND", "CASH_EQUIVALENT", "DERIVATIVE", "OTHER"]),
  ),
  exchangeMap: z.record(z.string(), z.string()),
});

// ─── Utility: Parse search params with a Zod schema ──────────────────────────

export function parseSearchParams<T extends z.ZodType>(
  searchParams: URLSearchParams,
  schema: T,
) {
  const raw: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    raw[key] = value;
  });
  return schema.safeParse(raw) as ReturnType<T["safeParse"]>;
}
