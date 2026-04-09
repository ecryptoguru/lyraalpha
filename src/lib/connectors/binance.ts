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

// ─── Binance Connector ─────────────────────────────────────────────────────────────

export class BinanceConnector implements BrokerConnector {
  readonly provider = "binance" as const;
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
      const url = API_ENDPOINTS.BINANCE_API_URL + API_ENDPOINTS.BINANCE_ACCOUNT_SNAPSHOT;
      const secretKey = await decryptSecret(auth.meta?.secretKey as string);
      const response = await withRetry(
        () =>
          brokerFetch<{ snapshotVos: unknown[] }>(url, {
            provider: this.provider,
            headers: {
              "X-MBX-APIKEY": auth.accessToken,
              "X-MBX-SECRET": secretKey,
            },
          }),
      );

      sourcePayloads.push({ holdings: response.snapshotVos });

      const sourceRef = makeSourceRef(this.provider, this.region, "default");
      const snapshot = response.snapshotVos as Record<string, unknown>[];
      const latestSnapshot = snapshot[0] as Record<string, unknown> | undefined;
      const snapshotData = latestSnapshot?.data as Record<string, unknown> | undefined;
      const balances = (snapshotData?.balances as Record<string, unknown>[]) || [];

      return balances.map((b) => {
        const asset = String(b.asset);
        const instrument = makeInstrumentIdentity({
          symbol: asset,
          name: asset,
          chain: null,
          contractAddress: null,
          tokenStandard: null,
          exchange: "BINANCE",
          assetClass: "CRYPTO",
          region: this.region,
          sector: null,
        });

        return {
          source: sourceRef,
          instrument,
          quantity: Number(b.free) + Number(b.locked),
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
      const url = API_ENDPOINTS.BINANCE_API_URL + API_ENDPOINTS.BINANCE_TRADES;
      const secretKey = await decryptSecret(auth.meta?.secretKey as string);
      const response = await withRetry(
        () =>
          brokerFetch<{ trades: unknown[] }>(url, {
            provider: this.provider,
            headers: {
              "X-MBX-APIKEY": auth.accessToken,
              "X-MBX-SECRET": secretKey,
            },
          }),
      );

      sourcePayloads.push({ transactions: response.trades });

      const sourceRef = makeSourceRef(this.provider, this.region, "default");
      const trades = response.trades as Record<string, unknown>[] || [];

      return trades.map((t) => ({
        source: sourceRef,
        instrument: makeInstrumentIdentity({
          symbol: String(t.symbol),
          name: String(t.symbol),
          chain: null,
          contractAddress: null,
          tokenStandard: null,
          exchange: "BINANCE",
          assetClass: "CRYPTO",
          region: this.region,
        }),
        transactionType: t.isBuyer ? "buy" as const : "sell" as const,
        quantity: Number(t.qty),
        price: Number(t.price),
        amount: Number(t.quoteQty),
        tradeDate: new Date(Number(t.time)).toISOString(),
        settlementDate: null,
        orderId: String(t.orderId),
        tradeId: String(t.id),
        status: "filled",
        fees: Number(t.commission),
        taxes: null,
        notes: null,
        raw: t,
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
      const url = API_ENDPOINTS.BINANCE_API_URL + API_ENDPOINTS.BINANCE_ACCOUNT;
      const secretKey = await decryptSecret(auth.meta?.secretKey as string);
      const response = await withRetry(
        () =>
          brokerFetch<{ balances: unknown[] }>(url, {
            provider: this.provider,
            headers: {
              "X-MBX-APIKEY": auth.accessToken,
              "X-MBX-SECRET": secretKey,
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
