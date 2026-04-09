import type {
  BrokerConnector,
  BrokerCredentials,
  BrokerAuthHandle,
  BrokerNormalizationResult,
  BrokerSyncScope,
  BrokerProvider,
  BrokerRegion,
} from "@/lib/types/broker";
import {
  makeSourceRef,
  makeInstrumentIdentity,
  scoreConfidence,
  makeSnapshot,
  makeNormalizationResult,
  scopeEnabled,
  validateCredentials,
  sanitizeAndValidateCredential,
  encryptSecret,
} from "./base";

// ─── CEX Base Connector ───────────────────────────────────────────────────────────

/**
 * Base class for Centralized Exchange (CEX) connectors
 * Provides common authentication and data normalization patterns
 */
export abstract class CEXBaseConnector implements BrokerConnector {
  abstract readonly provider: BrokerProvider;
  abstract readonly region: BrokerRegion;
  readonly version = "1.0.0";
  abstract readonly supportedScopes: BrokerSyncScope[];

  /**
   * Get the API base URL for this exchange
   */
  protected abstract getApiBaseUrl(): string;

  /**
   * Get the required credential keys for authentication
   */
  protected getRequiredCredentialKeys(): string[] {
    return ["apiKey", "secretKey"];
  }

  /**
   * Build authentication headers for API requests
   */
  protected buildAuthHeaders(auth: BrokerAuthHandle): Record<string, string> {
    return {
      "X-API-KEY": auth.accessToken,
    };
  }

  /**
   * Normalize API-specific asset symbol to standard format
   */
  protected normalizeSymbol(symbol: string): string {
    return symbol.toUpperCase();
  }

  /**
   * Authenticate with the exchange using API key and secret
   */
  async authenticate(credentials: BrokerCredentials): Promise<BrokerAuthHandle> {
    const requiredKeys = this.getRequiredCredentialKeys();
    validateCredentials(credentials, requiredKeys, this.provider);

    const apiKey = sanitizeAndValidateCredential(credentials.apiKey, "apiKey", this.provider);
    const secretKey = sanitizeAndValidateCredential(credentials.secretKey, "secretKey", this.provider);

    return {
      provider: this.provider,
      accessToken: apiKey,
      meta: { secretKey: await encryptSecret(secretKey) },
    };
  }

  /**
   * Fetch and normalize data from the exchange
   */
  async fetchAndNormalize(
    auth: BrokerAuthHandle,
    scope?: BrokerSyncScope[],
  ): Promise<BrokerNormalizationResult> {
    const warnings: string[] = [];
    const sourcePayloads: Record<string, unknown>[] = [];

    let holdings: import("@/lib/types/broker").BrokerHolding[] = [];
    let transactions: import("@/lib/types/broker").BrokerTransaction[] = [];
    let cashBalances: import("@/lib/types/broker").BrokerCashBalance[] = [];

    // Fetch holdings if scope enabled
    if (scopeEnabled(scope, "holdings")) {
      holdings = await this.fetchHoldings(auth, warnings, sourcePayloads);
    }

    // Fetch transactions if scope enabled
    if (scopeEnabled(scope, "transactions")) {
      transactions = await this.fetchTransactions(auth, warnings, sourcePayloads);
    }

    // Fetch balances if scope enabled
    if (scopeEnabled(scope, "balances")) {
      cashBalances = await this.fetchBalances(auth, warnings, sourcePayloads);
    }

    const snapshot = makeSnapshot(this.provider, this.region, holdings, [], sourcePayloads, warnings);
    // Override transactions and cashBalances in snapshot since makeSnapshot sets them to empty arrays
    (snapshot as import("@/lib/types/broker").BrokerPortfolioSnapshot & { transactions: import("@/lib/types/broker").BrokerTransaction[]; cashBalances: import("@/lib/types/broker").BrokerCashBalance[] }).transactions = transactions;
    (snapshot as import("@/lib/types/broker").BrokerPortfolioSnapshot & { transactions: import("@/lib/types/broker").BrokerTransaction[]; cashBalances: import("@/lib/types/broker").BrokerCashBalance[] }).cashBalances = cashBalances;
    return makeNormalizationResult(this.provider, this.region, this.version, snapshot, warnings);
  }

  /**
   * Fetch holdings from the exchange
   * To be implemented by subclasses
   */
  protected abstract fetchHoldings(
    auth: BrokerAuthHandle,
    warnings: string[],
    sourcePayloads: Record<string, unknown>[],
  ): Promise<import("@/lib/types/broker").BrokerHolding[]>;

  /**
   * Fetch transactions from the exchange
   * To be implemented by subclasses
   */
  protected abstract fetchTransactions(
    auth: BrokerAuthHandle,
    warnings: string[],
    sourcePayloads: Record<string, unknown>[],
  ): Promise<import("@/lib/types/broker").BrokerTransaction[]>;

  /**
   * Fetch balances from the exchange
   * To be implemented by subclasses
   */
  protected abstract fetchBalances(
    auth: BrokerAuthHandle,
    warnings: string[],
    sourcePayloads: Record<string, unknown>[],
  ): Promise<import("@/lib/types/broker").BrokerCashBalance[]>;

  /**
   * Common helper to normalize a holding
   */
  protected normalizeHolding(
    sourceRef: ReturnType<typeof makeSourceRef>,
    asset: string,
    quantity: number,
    additionalData?: Partial<{
      averagePrice: number;
      marketPrice: number;
      marketValue: number;
      costBasis: number;
      unrealizedPnl: number;
      unrealizedPnlPercent: number;
    }>,
  ) {
    const symbol = this.normalizeSymbol(asset);
    const instrument = makeInstrumentIdentity({
      symbol,
      name: symbol,
      chain: null,
      contractAddress: null,
      tokenStandard: null,
      exchange: this.provider.toUpperCase(),
      assetClass: "CRYPTO",
      region: this.region,
      sector: null,
    });

    return {
      source: sourceRef,
      instrument,
      quantity,
      averagePrice: additionalData?.averagePrice ?? 0,
      marketPrice: additionalData?.marketPrice ?? null,
      marketValue: additionalData?.marketValue ?? null,
      costBasis: additionalData?.costBasis ?? null,
      unrealizedPnl: additionalData?.unrealizedPnl ?? null,
      unrealizedPnlPercent: additionalData?.unrealizedPnlPercent ?? null,
      dayChange: null,
      dayChangePercent: null,
      confidence: scoreConfidence({
        contractAddress: instrument.contractAddress,
        exchange: instrument.exchange,
        marketPrice: additionalData?.marketPrice ?? null,
        costBasis: additionalData?.costBasis ?? null,
        unrealizedPnl: additionalData?.unrealizedPnl ?? null,
      }),
      raw: { asset, quantity },
    };
  }
}
