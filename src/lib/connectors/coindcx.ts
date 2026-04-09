import type {
  BrokerConnector,
  BrokerCredentials,
  BrokerAuthHandle,
  BrokerNormalizationResult,
  BrokerSyncScope,
} from "@/lib/types/broker";
import {
  withRetry,
  makeSourceRef,
  makeInstrumentIdentity,
  scoreConfidence,
  makeSnapshot,
  makeNormalizationResult,
  brokerFetch,
  scopeEnabled,
  validateCredentials,
  sanitizeAndValidateCredential,
  encryptSecret,
  decryptSecret,
} from "./base";
import { API_ENDPOINTS } from "@/lib/config";

// ─── CoinDCX Connector ───────────────────────────────────────────────────────────

export class CoinDCXConnector implements BrokerConnector {
  readonly provider = "coindcx" as const;
  readonly region = "IN" as const;
  readonly version = "1.0.0";
  readonly supportedScopes: BrokerSyncScope[] = ["holdings", "transactions", "orders", "balances"];

  async authenticate(credentials: BrokerCredentials): Promise<BrokerAuthHandle> {
    validateCredentials(credentials, ["apiKey", "secretKey"], this.provider);

    const apiKey = sanitizeAndValidateCredential(credentials.apiKey, "apiKey", this.provider);
    const secretKey = sanitizeAndValidateCredential(credentials.secretKey, "secretKey", this.provider);

    return {
      provider: this.provider,
      accessToken: apiKey,
      meta: { secretKey: await encryptSecret(secretKey) },
    };
  }

  async fetchAndNormalize(
    auth: BrokerAuthHandle,
    scope?: BrokerSyncScope[],
  ): Promise<BrokerNormalizationResult> {
    const warnings: string[] = [];
    const sourcePayloads: Record<string, unknown>[] = [];

    // Fetch holdings if scope enabled
    const holdings = scopeEnabled(scope, "holdings")
      ? await this.fetchHoldings(auth, warnings, sourcePayloads)
      : [];

    // Fetch transactions if scope enabled
    const transactions = scopeEnabled(scope, "transactions")
      ? await this.fetchTransactions(auth, warnings, sourcePayloads)
      : [];

    // Fetch balances if scope enabled
    const cashBalances = scopeEnabled(scope, "balances")
      ? await this.fetchBalances(auth, warnings, sourcePayloads)
      : [];

    const snapshot = makeSnapshot(
      this.provider,
      this.region,
      holdings,
      [],
      sourcePayloads,
      warnings,
    );

    snapshot.transactions = transactions;
    snapshot.cashBalances = cashBalances;

    return makeNormalizationResult(
      this.provider,
      this.region,
      this.version,
      snapshot,
      warnings,
    );
  }

  private async fetchHoldings(
    auth: BrokerAuthHandle,
    warnings: string[],
    sourcePayloads: Record<string, unknown>[],
  ) {
    try {
      const url = API_ENDPOINTS.COINDCX_API_URL + API_ENDPOINTS.COINDCX_BALANCES;
      const secretKey = await decryptSecret(auth.meta?.secretKey as string);
      const response = await withRetry(
        () =>
          brokerFetch<{ balances: unknown[] }>(url, {
            provider: this.provider,
            headers: {
              "X-API-KEY": auth.accessToken,
              "X-API-SECRET": secretKey,
            },
          }),
      );

      sourcePayloads.push({ holdings: response });

      const sourceRef = makeSourceRef(this.provider, this.region, "default");
      const balances = (response as { balances: unknown[] }).balances as Record<string, unknown>[];

      return balances.map((b) => {
        const asset = String(b.currency);
        const instrument = makeInstrumentIdentity({
          symbol: asset,
          name: asset,
          chain: null,
          contractAddress: null,
          tokenStandard: null,
          exchange: "COINDCX",
          assetClass: "CRYPTO",
          region: this.region,
          sector: null,
        });

        return {
          source: sourceRef,
          instrument,
          quantity: Number(b.balance),
          averagePrice: 0,
          marketPrice: null,
          marketValue: null,
          costBasis: null,
          unrealizedPnl: null,
          unrealizedPnlPercent: null,
          dayChange: null,
          dayChangePercent: null,
          confidence: scoreConfidence({
            contractAddress: instrument.contractAddress,
            exchange: instrument.exchange,
            marketPrice: null,
            costBasis: null,
            unrealizedPnl: null,
          }),
          raw: b,
        };
      });
    } catch (error) {
      warnings.push(`Failed to fetch holdings: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  private async fetchTransactions(
    auth: BrokerAuthHandle,
    warnings: string[],
    sourcePayloads: Record<string, unknown>[],
  ) {
    try {
      // CoinDCX API endpoint for orders
      const url = API_ENDPOINTS.COINDCX_API_URL + API_ENDPOINTS.COINDCX_FILLED_ORDERS;
      const secretKey = await decryptSecret(auth.meta?.secretKey as string);
      const response = await withRetry(
        () =>
          brokerFetch<unknown[]>(url, {
            provider: this.provider,
            headers: {
              "X-AUTH-APIKEY": auth.accessToken,
              "X-AUTH-SECRET": secretKey,
            },
          }),
        { maxAttempts: 3 },
      );

      sourcePayloads.push({ transactions: response });

      const sourceRef = makeSourceRef(this.provider, this.region, "default");
      const orders = response as Record<string, unknown>[];
      
      return orders.map((o) => ({
        source: sourceRef,
        instrument: makeInstrumentIdentity({
          symbol: o.symbol ? String(o.symbol) : "BTC",
          name: o.symbol ? String(o.symbol) : "BTC",
          chain: null,
          contractAddress: null,
          tokenStandard: null,
          exchange: "COINDCX",
          assetClass: "CRYPTO",
          region: this.region,
        }),
        transactionType: o.side === "buy" ? "buy" as const : "sell" as const,
        quantity: Number(o.quantity),
        price: Number(o.price),
        amount: Number(o.total),
        tradeDate: o.timestamp ? new Date(Number(o.timestamp)).toISOString() : new Date().toISOString(),
        settlementDate: null,
        orderId: o.orderId ? String(o.orderId) : null,
        tradeId: o.orderId ? String(o.orderId) : null,
        status: o.status ? String(o.status) : null,
        fees: null,
        taxes: null,
        notes: null,
        raw: o,
      }));
    } catch (error) {
      warnings.push(`Failed to fetch transactions: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  private async fetchBalances(
    auth: BrokerAuthHandle,
    warnings: string[],
    sourcePayloads: Record<string, unknown>[],
  ) {
    try {
      const url = API_ENDPOINTS.COINDCX_API_URL + API_ENDPOINTS.COINDCX_BALANCES;
      const secretKey = await decryptSecret(auth.meta?.secretKey as string);
      const response = await withRetry(
        () =>
          brokerFetch<unknown[]>(url, {
            provider: this.provider,
            headers: {
              "X-AUTH-APIKEY": auth.accessToken,
              "X-AUTH-SECRET": secretKey,
            },
          }),
      );

      sourcePayloads.push({ balances: response });

      const balances = response as Record<string, unknown>[];
      return balances
        .filter((b) => Number(b.balance) > 0)
        .map((b) => ({
          currency: b.currency as "USD" | "INR" | "USDT" | "USDC" | "ETH" | "BTC" | "BNB",
          available: Number(b.balance),
          settled: null,
          marginUsed: null,
          collateral: null,
          blocked: null,
          asOf: new Date().toISOString(),
        }));
    } catch (error) {
      warnings.push(`Failed to fetch balances: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }
}
