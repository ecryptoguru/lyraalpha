// ─── Primitive enumerations ───────────────────────────────────────────────────

export type BrokerRegion = "IN" | "US" | "GLOBAL";

export type BrokerProvider =
  // ── India CEX ───────────────────────────────────────────────────────────────────
  | "koinx"
  | "wazirx"
  | "coindcx"
  // ── Global CEX ─────────────────────────────────────────────────────────────────
  | "binance"
  | "coinbase"
  | "kraken"
  | "bybit"
  | "okx"
  | "zebpay"
  // ── DEX ───────────────────────────────────────────────────────────────────────────
  | "giottus"
  | "buyucoin"
  | "uniswap"
  | "pancakeswap"
  | "sushiswap"
  | "curve"
  | "jupiter";

export type BrokerAccessModel =
  | "public_api"
  | "partner_api"
  | "oauth"
  | "sdk"
  | "statement"
  | "email"
  | "manual";

export type BrokerAssetClass =
  | "CRYPTO"
  | "DEFI"
  | "NFTS"
  | "LAYER1"
  | "LAYER2";

export type BrokerTransactionType =
  | "buy"
  | "sell"
  | "transfer"
  | "fee"
  | "deposit"
  | "withdrawal"
  | "swap"
  | "stake"
  | "unstake"
  | "liquidity_provide"
  | "liquidity_remove"
  | "bridge"
  | "claim"
  | "airdrop"
  | "reward";

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
  chain?: string | null;
  contractAddress?: string | null;
  tokenStandard?: "ERC20" | "ERC721" | "ERC1155" | "SPL" | "BEP20" | null;
  exchange?: string | null;
  currency: "USD" | "INR" | "USDT" | "USDC" | "ETH" | "BTC";
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
  currency: "USD" | "INR" | "USDT" | "USDC" | "ETH" | "BTC" | "BNB";
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
  currency: "USD" | "INR" | "USDT" | "USDC" | "ETH" | "BTC" | "BNB";
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
 * Contract address is preferred for crypto; symbol+exchange is the operational fallback.
 */
export interface BrokerInstrumentKey {
  contractAddress: string | null;
  symbol: string;
  exchange: string | null;
  region: BrokerRegion;
  chain?: string | null;
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

// ─── India CEX integration matrix ─────────────────────────────────────────────────

export const INDIA_CEX_INTEGRATION_MATRIX: BrokerIntegrationMatrixEntry[] = [
  {
    rank: 1,
    provider: "koinx",
    label: "KoinX",
    region: "IN",
    accessModel: "partner_api",
    scope: ["holdings", "transactions", "balances"],
    authNotes: "KoinX API: API key + client ID authentication. Partner integration for portfolio tracking and tax reports.",
    productionNotes: "Partner integration with tax compliance features. Supports 270+ chains and exchanges. Priority integration.",
    phase: "phase_1",
  },
  {
    rank: 2,
    provider: "wazirx",
    label: "WazirX",
    region: "IN",
    accessModel: "public_api",
    scope: ["holdings", "transactions", "orders", "balances"],
    authNotes: "WazirX API: API key + secret key authentication. Binance-owned, strong API documentation.",
    productionNotes: "India's largest crypto exchange. Mature API, good documentation. Build first.",
    phase: "phase_1",
  },
  {
    rank: 3,
    provider: "coindcx",
    label: "CoinDCX",
    region: "IN",
    accessModel: "public_api",
    scope: ["holdings", "transactions", "orders", "balances"],
    authNotes: "CoinDCX API: API key + secret authentication. OAuth 2.0 available for partner integration.",
    productionNotes: "Major Indian exchange with good API coverage. Strong retail relevance.",
    phase: "phase_1",
  },
  {
    rank: 4,
    provider: "zebpay",
    label: "Zebpay",
    region: "IN",
    accessModel: "public_api",
    scope: ["holdings", "transactions", "orders", "balances"],
    authNotes: "Zebpay API: API key authentication. Established player with stable API.",
    productionNotes: "Early Indian exchange, established user base. Good for market coverage.",
    phase: "phase_2",
  },
  {
    rank: 5,
    provider: "giottus",
    label: "Giottus",
    region: "IN",
    accessModel: "public_api",
    scope: ["holdings", "transactions", "orders", "balances"],
    authNotes: "Giottus API: API key + secret authentication. API-focused exchange.",
    productionNotes: "API-focused Indian exchange. Good for technical users.",
    phase: "phase_2",
  },
  {
    rank: 6,
    provider: "buyucoin",
    label: "BuyUcoin",
    region: "IN",
    accessModel: "public_api",
    scope: ["holdings", "transactions", "orders", "balances"],
    authNotes: "BuyUcoin API: API key authentication. Good coverage of Indian market.",
    productionNotes: "Good retail breadth. Add as secondary source once Phase 1 connectors are live.",
    phase: "phase_2",
  },
];

// ─── Global CEX integration matrix ────────────────────────────────────────────────────

export const GLOBAL_CEX_INTEGRATION_MATRIX: BrokerIntegrationMatrixEntry[] = [
  {
    rank: 1,
    provider: "binance",
    label: "Binance",
    region: "GLOBAL",
    accessModel: "public_api",
    scope: ["holdings", "transactions", "orders", "balances"],
    authNotes: "Binance API: API key + secret authentication. HMAC-SHA256 signature required. IP whitelist available.",
    productionNotes: "Global leader with excellent API. Highest liquidity, most trading pairs. Build first.",
    phase: "phase_1",
  },
  {
    rank: 2,
    provider: "coinbase",
    label: "Coinbase",
    region: "US",
    accessModel: "oauth",
    scope: ["holdings", "transactions", "orders", "balances"],
    authNotes: "Coinbase API: OAuth 2.0 authentication. API key + secret for advanced trading. Strong security.",
    productionNotes: "US market leader. Excellent OAuth flow. Good for institutional users.",
    phase: "phase_1",
  },
  {
    rank: 3,
    provider: "kraken",
    label: "Kraken",
    region: "GLOBAL",
    accessModel: "public_api",
    scope: ["holdings", "transactions", "orders", "balances"],
    authNotes: "Kraken API: API key + secret authentication. API nonce required. Strong institutional focus.",
    productionNotes: "Strong API, institutional-grade. Good for high-value accounts.",
    phase: "phase_1",
  },
  {
    rank: 4,
    provider: "bybit",
    label: "Bybit",
    region: "GLOBAL",
    accessModel: "public_api",
    scope: ["holdings", "transactions", "orders", "balances"],
    authNotes: "Bybit API: API key + secret authentication. Derivatives-focused. Good API documentation.",
    productionNotes: "Derivatives leader. Good for trading-focused users.",
    phase: "phase_2",
  },
  {
    rank: 5,
    provider: "okx",
    label: "OKX",
    region: "GLOBAL",
    accessModel: "public_api",
    scope: ["holdings", "transactions", "orders", "balances"],
    authNotes: "OKX API: API key + secret passphrase authentication. Good global coverage.",
    productionNotes: "Global exchange with good API. Strong derivatives offering.",
    phase: "phase_2",
  },
];

// ─── Combined convenience export ──────────────────────────────────────────────

export const ALL_BROKER_INTEGRATION_MATRIX: BrokerIntegrationMatrixEntry[] = [
  ...INDIA_CEX_INTEGRATION_MATRIX,
  ...GLOBAL_CEX_INTEGRATION_MATRIX,
];
