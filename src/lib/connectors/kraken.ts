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

// ─── Kraken Connector ─────────────────────────────────────────────────────────────

export class KrakenConnector implements BrokerConnector {
  readonly provider = "kraken" as const;
  readonly region = "US" as const;
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
      const url = API_ENDPOINTS.KRAKEN_API_URL + API_ENDPOINTS.KRAKEN_BALANCE;
      const secretKey = await decryptSecret(auth.meta?.secretKey as string);
      const response = await withRetry(
        () =>
          brokerFetch<{ result: Record<string, unknown> }>(url, {
            provider: this.provider,
            headers: {
              "API-Key": auth.accessToken,
              "API-Sign": secretKey,
            },
          }),
      );

      sourcePayloads.push({ holdings: response.result });

      const sourceRef = makeSourceRef(this.provider, this.region, "default");
      const balances = response.result || {};

      return Object.entries(balances).map(([asset, balance]) => {
        const instrument = makeInstrumentIdentity({
          symbol: asset,
          name: asset,
          chain: null,
          contractAddress: null,
          tokenStandard: null,
          exchange: "KRAKEN",
          assetClass: "CRYPTO",
          region: this.region,
          sector: null,
        });

        return {
          source: sourceRef,
          instrument,
          quantity: Number(balance),
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
          raw: { asset, balance },
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
      const url = API_ENDPOINTS.KRAKEN_API_URL + API_ENDPOINTS.KRAKEN_TRADES_HISTORY;
      const secretKey = await decryptSecret(auth.meta?.secretKey as string);
      const response = await withRetry(
        () =>
          brokerFetch<{ result: { trades: Record<string, unknown> } }>(url, {
            provider: this.provider,
            headers: {
              "API-Key": auth.accessToken,
              "API-Sign": secretKey,
            },
          }),
        { maxAttempts: 3 },
      );

      sourcePayloads.push({ transactions: response.result.trades });

      const sourceRef = makeSourceRef(this.provider, this.region, "default");
      const trades = response.result.trades as Record<string, unknown>;
      
      return Object.entries(trades).map(([tradeId, trade]) => {
        const t = trade as Record<string, unknown>;
        return {
          source: sourceRef,
          instrument: makeInstrumentIdentity({
            symbol: t.pair ? String(t.pair) : "BTC",
            name: t.pair ? String(t.pair) : "BTC",
            chain: null,
            contractAddress: null,
            tokenStandard: null,
            exchange: "KRAKEN",
            assetClass: "CRYPTO",
            region: this.region,
          }),
          transactionType: t.type === "buy" ? "buy" as const : "sell" as const,
          quantity: Number(t.vol),
          price: Number(t.price),
          amount: Number(t.cost),
          tradeDate: t.time ? new Date(Number(t.time)).toISOString() : new Date().toISOString(),
          settlementDate: null,
          orderId: t.ordertxid ? String(t.ordertxid) : null,
          tradeId,
          status: "filled",
          fees: Number(t.fee),
          taxes: null,
          notes: null,
          raw: t,
        };
      });
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
      const url = API_ENDPOINTS.KRAKEN_API_URL + API_ENDPOINTS.KRAKEN_BALANCE;
      const secretKey = await decryptSecret(auth.meta?.secretKey as string);
      const response = await withRetry(
        () =>
          brokerFetch<{ result: Record<string, unknown> }>(url, {
            provider: this.provider,
            headers: {
              "API-Key": auth.accessToken,
              "API-Sign": secretKey,
            },
          }),
      );

      sourcePayloads.push({ balances: response.result });

      const balances = response.result || {};
      return Object.entries(balances)
        .filter(([, balance]) => Number(balance) > 0)
        .map(([asset, balance]) => ({
          currency: asset as "USD" | "INR" | "USDT" | "USDC" | "ETH" | "BTC" | "BNB",
          available: Number(balance),
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
