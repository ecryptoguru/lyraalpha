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

// ─── WazirX Connector ────────────────────────────────────────────────────────────

export class WazirxConnector implements BrokerConnector {
  readonly provider = "wazirx" as const;
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
      const url = API_ENDPOINTS.WAZIRX_API_URL + API_ENDPOINTS.WAZIRX_ACCOUNT;
      const secretKey = await decryptSecret(auth.meta?.secretKey as string);
      const response = await withRetry(
        () =>
          brokerFetch<{ holdings: unknown[] }>(url, {
            provider: this.provider,
            headers: {
              "X-API-KEY": auth.accessToken,
              "X-API-SECRET": secretKey,
            },
          }),
      );

      sourcePayloads.push({ holdings: response.holdings });

      const sourceRef = makeSourceRef(this.provider, this.region, "default");
      const holdings = response.holdings as Record<string, unknown>[] || [];
      
      return holdings.map((h) => {
        const asset = String(h.asset);
        const instrument = makeInstrumentIdentity({
          symbol: asset,
          name: asset,
          chain: null,
          contractAddress: null,
          tokenStandard: null,
          exchange: "WAZIRX",
          assetClass: "CRYPTO",
          region: this.region,
          sector: null,
        });

        return {
          source: sourceRef,
          instrument,
          quantity: Number(h.free) + Number(h.locked),
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
          raw: h,
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
      // WazirX API endpoint for orders
      const url = API_ENDPOINTS.WAZIRX_API_URL + API_ENDPOINTS.WAZIRX_ORDERS;
      
      const response = await withRetry(
        () =>
          brokerFetch<{ orders: unknown[] }>(url, {
            provider: this.provider,
            headers: {
              "X-API-KEY": auth.accessToken,
            },
          }),
        { maxAttempts: 3 },
      );

      sourcePayloads.push({ transactions: response.orders });

      const sourceRef = makeSourceRef(this.provider, this.region, "default");
      const orders = response.orders as Record<string, unknown>[] || [];
      
      return orders.map((o) => ({
        source: sourceRef,
        instrument: makeInstrumentIdentity({
          symbol: o.symbol ? String(o.symbol) : "BTC",
          name: o.symbol ? String(o.symbol) : "BTC",
          chain: null,
          contractAddress: null,
          tokenStandard: null,
          exchange: "WAZIRX",
          assetClass: "CRYPTO",
          region: this.region,
        }),
        transactionType: o.side === "buy" ? "buy" as const : "sell" as const,
        quantity: Number(o.executedQty),
        price: Number(o.price),
        amount: Number(o.cummulativeQuoteQty),
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
      const url = API_ENDPOINTS.WAZIRX_API_URL + API_ENDPOINTS.WAZIRX_ACCOUNT;

      const response = await withRetry(
        () =>
          brokerFetch<{ balances: unknown[] }>(url, {
            provider: this.provider,
            headers: {
              "X-API-KEY": auth.accessToken,
            },
          }),
      );

      sourcePayloads.push({ balances: response.balances });

      const balances = response.balances as Record<string, unknown>[] || [];
      return balances
        .filter((b) => Number(b.free) > 0 || Number(b.locked) > 0)
        .map((b) => ({
          currency: b.asset as "USD" | "INR" | "USDT" | "USDC" | "ETH" | "BTC" | "BNB",
          available: Number(b.free),
          settled: null,
          marginUsed: Number(b.locked),
          collateral: null,
          blocked: Number(b.locked),
          asOf: new Date().toISOString(),
        }));
    } catch (error) {
      warnings.push(`Failed to fetch balances: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }
}
