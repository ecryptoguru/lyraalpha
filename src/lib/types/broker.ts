// ─── Primitive enumerations ───────────────────────────────────────────────────

export type BrokerRegion = "IN" | "US" | "GLOBAL";

export type BrokerProvider =
  | "zerodha"
  | "upstox"
  | "angel_one"
  | "dhan"
  | "fyers"
  | "groww"
  | "icici_direct"
  | "kotak_neo"
  | "five_paisa"
  | "motilal_oswal"
  | "shoonya"
  | "alice_blue"
  | "hdfc_securities"
  | "axis_direct"
  | "plaid"
  | "alpaca";

export type BrokerAccessModel =
  | "public_api"
  | "partner_api"
  | "oauth"
  | "sdk"
  | "statement"
  | "email"
  | "manual";

export type BrokerAssetClass =
  | "STOCK"
  | "ETF"
  | "MUTUAL_FUND"
  | "CRYPTO"
  | "COMMODITY"
  | "BOND"
  | "CASH_EQUIVALENT"
  | "DERIVATIVE"
  | "OTHER";

export type BrokerTransactionType =
  | "buy"
  | "sell"
  | "dividend"
  | "switch"
  | "transfer"
  | "fee"
  | "interest"
  | "deposit"
  | "withdrawal"
  | "split"
  | "merger"
  | "corporate_action";

export type BrokerPositionSide = "long" | "short" | "flat";
export type BrokerSyncScope = "holdings" | "positions" | "transactions" | "balances" | "orders";
export type BrokerConnectorPhase = "phase_1" | "phase_2" | "phase_3" | "fallback";

// ─── Integration matrix ───────────────────────────────────────────────────────

export interface BrokerIntegrationMatrixEntry {
  rank: number;
  provider: BrokerProvider;
  label: string;
  region: BrokerRegion;
  accessModel: BrokerAccessModel;
  scope: BrokerSyncScope[];
  authNotes: string;
  productionNotes: string;
  phase: BrokerConnectorPhase;
}

// ─── Normalized payload entities ─────────────────────────────────────────────

export interface BrokerSourceReference {
  provider: BrokerProvider;
  region: BrokerRegion;
  accountId: string;
  externalAccountId?: string | null;
  accessModel: BrokerAccessModel;
  providerVersion?: string | null;
  fetchedAt: string;
  cursor?: string | null;
  rawRef?: string | null;
}

export interface BrokerInstrumentIdentity {
  symbol: string;
  name: string;
  isin?: string | null;
  exchange?: string | null;
  currency: "USD" | "INR";
  assetClass: BrokerAssetClass;
  region: BrokerRegion;
  sector?: string | null;
  industry?: string | null;
}

export interface BrokerLot {
  lotId?: string | null;
  acquiredAt?: string | null;
  quantity: number;
  costBasis?: number | null;
  averagePrice?: number | null;
}

export interface BrokerCashBalance {
  currency: "USD" | "INR";
  available: number;
  settled?: number | null;
  marginUsed?: number | null;
  collateral?: number | null;
  blocked?: number | null;
  asOf: string;
}

export interface BrokerHolding {
  source: BrokerSourceReference;
  instrument: BrokerInstrumentIdentity;
  quantity: number;
  averagePrice: number;
  marketPrice?: number | null;
  marketValue?: number | null;
  costBasis?: number | null;
  unrealizedPnl?: number | null;
  unrealizedPnlPercent?: number | null;
  dayChange?: number | null;
  dayChangePercent?: number | null;
  weight?: number | null;
  lotCount?: number | null;
  confidence: number;
  lots?: BrokerLot[];
  raw?: Record<string, unknown>;
}

export interface BrokerPosition {
  source: BrokerSourceReference;
  instrument: BrokerInstrumentIdentity;
  side: BrokerPositionSide;
  quantity: number;
  overnightQuantity?: number | null;
  averagePrice: number;
  marketPrice?: number | null;
  marketValue?: number | null;
  costBasis?: number | null;
  unrealizedPnl?: number | null;
  unrealizedPnlPercent?: number | null;
  margin?: number | null;
  leverage?: number | null;
  dayChange?: number | null;
  dayChangePercent?: number | null;
  confidence: number;
  raw?: Record<string, unknown>;
}

export interface BrokerTransaction {
  source: BrokerSourceReference;
  instrument: BrokerInstrumentIdentity;
  transactionType: BrokerTransactionType;
  quantity: number;
  price: number;
  amount: number;
  tradeDate: string;
  settlementDate?: string | null;
  orderId?: string | null;
  tradeId?: string | null;
  status?: string | null;
  fees?: number | null;
  taxes?: number | null;
  notes?: string | null;
  raw?: Record<string, unknown>;
}

export interface BrokerAccount {
  source: BrokerSourceReference;
  displayName: string;
  brokerAccountId?: string | null;
  accountType?: string | null;
  status?: string | null;
  currency: "USD" | "INR";
  portfolioValue?: number | null;
  cashBalance?: BrokerCashBalance | null;
  buyingPower?: number | null;
  marginAvailable?: number | null;
  netLiquidation?: number | null;
  raw?: Record<string, unknown>;
}

export interface BrokerPortfolioSnapshot {
  provider: BrokerProvider;
  region: BrokerRegion;
  capturedAt: string;
  accounts: BrokerAccount[];
  holdings: BrokerHolding[];
  positions: BrokerPosition[];
  transactions: BrokerTransaction[];
  cashBalances: BrokerCashBalance[];
  sourcePayloads: Record<string, unknown>[];
  warnings: string[];
  confidence: number;
}

export interface BrokerNormalizationResult {
  snapshot: BrokerPortfolioSnapshot;
  provider: BrokerProvider;
  region: BrokerRegion;
  connectorVersion: string;
  normalizedAt: string;
  sourceCount: number;
  accountCount: number;
  holdingCount: number;
  positionCount: number;
  transactionCount: number;
  warnings: string[];
}

// ─── Connector interface (abstract adapter contract) ──────────────────────────

/**
 * Every broker connector must implement this interface.
 * The intelligence layer only ever sees `BrokerNormalizationResult` —
 * raw provider payloads must never escape the adapter boundary.
 */
export interface BrokerConnector {
  readonly provider: BrokerProvider;
  readonly region: BrokerRegion;
  readonly version: string;
  readonly supportedScopes: BrokerSyncScope[];

  /**
   * Authenticate and return an opaque auth handle valid for the current session.
   * The connector owns token storage and refresh logic.
   */
  authenticate(credentials: BrokerCredentials): Promise<BrokerAuthHandle>;

  /**
   * Fetch, normalize, and return the full portfolio snapshot.
   * Raw payloads must be retained inside the result (`snapshot.sourcePayloads`).
   */
  fetchAndNormalize(auth: BrokerAuthHandle, scope?: BrokerSyncScope[]): Promise<BrokerNormalizationResult>;

  /**
   * Validate that the auth handle is still usable; refresh if necessary.
   * Returns the (possibly refreshed) handle.
   */
  refreshAuth?(auth: BrokerAuthHandle): Promise<BrokerAuthHandle>;
}

/**
 * Opaque credentials supplied by the user for initial authentication.
 * The shape is broker-specific; connectors cast internally.
 */
export type BrokerCredentials = Record<string, string>;

/**
 * Opaque session handle produced by `authenticate`.
 * Connectors define the concrete shape; callers treat it as a black box.
 */
export interface BrokerAuthHandle {
  provider: BrokerProvider;
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: string | null;
  meta?: Record<string, unknown>;
}

// ─── Deduplication types ──────────────────────────────────────────────────────

/**
 * Canonical instrument key used during cross-broker deduplication.
 * ISIN is preferred; symbol+exchange is the operational fallback.
 */
export interface BrokerInstrumentKey {
  isin: string | null;
  symbol: string;
  exchange: string | null;
  region: BrokerRegion;
}

/**
 * Result of merging holdings from multiple broker sources into a single
 * deduplicated holding. Weighted-average price and summed quantity are
 * computed across all contributing lots.
 */
export interface BrokerMergedHolding {
  key: BrokerInstrumentKey;
  instrument: BrokerInstrumentIdentity;
  totalQuantity: number;
  weightedAveragePrice: number;
  totalMarketValue: number | null;
  totalCostBasis: number | null;
  totalUnrealizedPnl: number | null;
  sources: BrokerSourceReference[];
  contributions: BrokerHolding[];
  confidence: number;
}

/**
 * Result of a full cross-broker deduplication pass.
 */
export interface BrokerDeduplicationResult {
  mergedHoldings: BrokerMergedHolding[];
  mergedPositions: BrokerPosition[];
  totalHoldingsBefore: number;
  totalHoldingsAfter: number;
  duplicatesRemoved: number;
  warnings: string[];
}

// ─── Normalizer field mapping helpers ────────────────────────────────────────

/**
 * Field-level mapping descriptor used by normalizer utilities to translate
 * a raw broker field path to the canonical `BrokerHolding` field.
 */
export interface BrokerFieldMap {
  sourceField: string;
  targetField: keyof BrokerHolding | keyof BrokerInstrumentIdentity | keyof BrokerSourceReference;
  transform?: (raw: unknown) => unknown;
  required?: boolean;
}

/**
 * Per-broker normalizer configuration that declaratively describes how to
 * map raw response objects into canonical entities.
 */
export interface BrokerNormalizerConfig {
  provider: BrokerProvider;
  holdingFieldMap: BrokerFieldMap[];
  positionFieldMap: BrokerFieldMap[];
  transactionFieldMap: BrokerFieldMap[];
  assetClassMap: Record<string, BrokerAssetClass>;
  exchangeMap: Record<string, string>;
}

// ─── India integration matrix ─────────────────────────────────────────────────

export const INDIA_BROKER_INTEGRATION_MATRIX: BrokerIntegrationMatrixEntry[] = [
  {
    rank: 1,
    provider: "zerodha",
    label: "Zerodha",
    region: "IN",
    accessModel: "public_api",
    scope: ["holdings", "positions", "transactions", "orders", "balances"],
    authNotes: "Kite Connect: login_url → request_token → session exchange. Paid developer subscription required. Token refreshes daily via re-login or partner auto-renew.",
    productionNotes: "Highest production leverage. Mature docs, strong ecosystem, straightforward holdings/positions fetch. Build first.",
    phase: "phase_1",
  },
  {
    rank: 2,
    provider: "upstox",
    label: "Upstox",
    region: "IN",
    accessModel: "public_api",
    scope: ["holdings", "positions", "transactions", "orders", "balances"],
    authNotes: "OAuth 2.0 PKCE flow. Short-lived access token + refresh token. Developer app registration required.",
    productionNotes: "Clean REST v3 surface, well-documented holdings and portfolio endpoints. Strong second connector for retail coverage.",
    phase: "phase_1",
  },
  {
    rank: 3,
    provider: "angel_one",
    label: "Angel One",
    region: "IN",
    accessModel: "public_api",
    scope: ["holdings", "positions", "transactions", "orders", "balances"],
    authNotes: "SmartAPI: TOTP + client code login → JWT session token. API key required at registration.",
    productionNotes: "High retail relevance. Good production fit for portfolio-level sync once auth is wired.",
    phase: "phase_1",
  },
  {
    rank: 4,
    provider: "dhan",
    label: "Dhan",
    region: "IN",
    accessModel: "public_api",
    scope: ["holdings", "positions", "transactions", "orders", "balances"],
    authNotes: "DhanHQ v2: access token from developer portal. Token is long-lived but user-scoped.",
    productionNotes: "Clean API surface with dedicated holdings/positions endpoints. Practical and well-maintained.",
    phase: "phase_1",
  },
  {
    rank: 5,
    provider: "fyers",
    label: "FYERS",
    region: "IN",
    accessModel: "public_api",
    scope: ["holdings", "positions", "transactions", "orders", "balances"],
    authNotes: "API Connect / SDK: auth code flow → access token via TOTP. App_id + secret required.",
    productionNotes: "Strong trading and portfolio primitives. Good complement to the first four connectors.",
    phase: "phase_1",
  },
  {
    rank: 6,
    provider: "groww",
    label: "Groww",
    region: "IN",
    accessModel: "public_api",
    scope: ["holdings", "positions", "transactions", "orders", "balances"],
    authNotes: "Groww API portal provides portfolio and positions endpoints. Verify partner onboarding and access policy before going live.",
    productionNotes: "Highest user-base relevance for MF + stocks. Treat as a high-value Phase 2 connector, not a fallback.",
    phase: "phase_2",
  },
  {
    rank: 7,
    provider: "icici_direct",
    label: "ICICI Direct",
    region: "IN",
    accessModel: "partner_api",
    scope: ["holdings", "positions", "transactions", "orders", "balances"],
    authNotes: "Breeze Connect API / iCICIdirect Open API: API key + session token. May require formal partner agreement.",
    productionNotes: "Strong brand trust, large user base. Expect compliance friction and onboarding lead time.",
    phase: "phase_2",
  },
  {
    rank: 8,
    provider: "kotak_neo",
    label: "Kotak Neo",
    region: "IN",
    accessModel: "sdk",
    scope: ["holdings", "positions", "transactions", "orders", "balances"],
    authNotes: "Neo API / Python SDK: session token via OTP login. Consumer key + secret from developer portal.",
    productionNotes: "Good banking-brand coverage. Worth adding once core adapters are stable and proven in production.",
    phase: "phase_2",
  },
  {
    rank: 9,
    provider: "five_paisa",
    label: "5paisa",
    region: "IN",
    accessModel: "public_api",
    scope: ["holdings", "positions", "transactions", "orders", "balances"],
    authNotes: "Xstream / developer API: API key + JWT login. Verify SDK version compatibility carefully.",
    productionNotes: "Good retail breadth. Auth and SDK setup need careful environment testing before production.",
    phase: "phase_2",
  },
  {
    rank: 10,
    provider: "motilal_oswal",
    label: "Motilal Oswal",
    region: "IN",
    accessModel: "partner_api",
    scope: ["holdings", "positions", "transactions", "orders", "balances"],
    authNotes: "MO API portal: access may require partner onboarding approval. Token-based session once approved.",
    productionNotes: "Valuable for broader market coverage. Add after core set is proven to reduce onboarding risk.",
    phase: "phase_2",
  },
  {
    rank: 11,
    provider: "shoonya",
    label: "Shoonya (Finvasia)",
    region: "IN",
    accessModel: "public_api",
    scope: ["holdings", "positions", "transactions", "orders", "balances"],
    authNotes: "NorenApi: SHA-256 password hash + TOTP login flow. Python/JS client libraries available.",
    productionNotes: "Zero brokerage platform with an active developer community. Good long-tail coverage for cost-conscious traders.",
    phase: "phase_3",
  },
  {
    rank: 12,
    provider: "alice_blue",
    label: "Alice Blue",
    region: "IN",
    accessModel: "public_api",
    scope: ["holdings", "positions", "transactions", "orders", "balances"],
    authNotes: "ANT+ API / OpenAPI: session auth via client credentials. Developer registration required.",
    productionNotes: "Niche but active base. Add as a secondary source once Phase 1 and 2 connectors are live.",
    phase: "phase_3",
  },
  {
    rank: 13,
    provider: "hdfc_securities",
    label: "HDFC Securities",
    region: "IN",
    accessModel: "partner_api",
    scope: ["holdings", "positions", "transactions", "orders", "balances"],
    authNotes: "API access requires formal partner agreement with HDFC Securities. Limited public documentation.",
    productionNotes: "High brand trust but high onboarding friction. Defer until compliance and partner capacity allows.",
    phase: "fallback",
  },
  {
    rank: 14,
    provider: "axis_direct",
    label: "Axis Direct",
    region: "IN",
    accessModel: "partner_api",
    scope: ["holdings", "positions", "transactions", "orders", "balances"],
    authNotes: "Axis Direct API access is partner-gated. Expect formal approval process.",
    productionNotes: "Meaningful user base in the banking-brokerage segment. Keep as a fallback until partner path clears.",
    phase: "fallback",
  },
];

// ─── US integration matrix ────────────────────────────────────────────────────

export const US_BROKER_INTEGRATION_MATRIX: BrokerIntegrationMatrixEntry[] = [
  {
    rank: 1,
    provider: "plaid",
    label: "Plaid",
    region: "US",
    accessModel: "oauth",
    scope: ["holdings", "positions", "transactions", "balances"],
    authNotes: "Plaid Link (OAuth 2.0 consent UI): public_token exchange → access_token. Investments product required. Institution-level consent and re-auth on token expiry.",
    productionNotes: "Best first US connector. Covers 70-80% of retail investors via Robinhood, Fidelity, Schwab, E*TRADE, TD Ameritrade. Read-only. Sync every 6-12 hours.",
    phase: "phase_1",
  },
  {
    rank: 2,
    provider: "alpaca",
    label: "Alpaca",
    region: "US",
    accessModel: "public_api",
    scope: ["holdings", "positions", "transactions", "orders", "balances"],
    authNotes: "API key + secret (paper and live accounts). OAuth flow available for broker-partner integration. Webhooks for real-time trade events.",
    productionNotes: "Best direct-brokerage layer for real-time portfolio state and power users. Supports live trading, webhooks, and streaming quotes.",
    phase: "phase_1",
  },
];

// ─── Combined convenience export ──────────────────────────────────────────────

export const ALL_BROKER_INTEGRATION_MATRIX: BrokerIntegrationMatrixEntry[] = [
  ...INDIA_BROKER_INTEGRATION_MATRIX,
  ...US_BROKER_INTEGRATION_MATRIX,
];
