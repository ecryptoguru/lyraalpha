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

// ─── Coinbase Connector ───────────────────────────────────────────────────────────

export class CoinbaseConnector implements BrokerConnector {
  readonly provider = "coinbase" as const;
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
      const url = API_ENDPOINTS.COINBASE_API_URL + API_ENDPOINTS.COINBASE_ACCOUNTS;
      const secretKey = await decryptSecret(auth.meta?.secretKey as string);
      const response = await withRetry(
        () =>
          brokerFetch<{ data: unknown[] }>(url, {
            provider: this.provider,
            headers: {
              "CB-ACCESS-KEY": auth.accessToken,
              "CB-ACCESS-SIGN": secretKey,
              "CB-ACCESS-TIMESTAMP": String(Math.floor(Date.now() / 1000)),
            },
          }),
      );

      sourcePayloads.push({ holdings: response.data });

      const sourceRef = makeSourceRef(this.provider, this.region, "default");
      const accounts = response.data as Record<string, unknown>[];

      return accounts
        .filter((a) => a.type === "wallet" && a.balance && Number((a.balance as Record<string, unknown>).amount) > 0)
        .map((a) => {
          const currency = String(a.currency);
          const balance = a.balance as Record<string, unknown> | undefined;
          const nativeBalance = a.native_balance as Record<string, unknown> | undefined;
          const instrument = makeInstrumentIdentity({
            symbol: currency,
            name: currency,
            chain: null,
            contractAddress: null,
            tokenStandard: null,
            exchange: "COINBASE",
            assetClass: "CRYPTO",
            region: this.region,
            sector: null,
          });

          return {
            source: sourceRef,
            instrument,
            quantity: Number(balance?.amount),
            averagePrice: 0,
            marketPrice: null,
            marketValue: Number(nativeBalance?.amount),
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
            raw: a,
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
      const url = API_ENDPOINTS.COINBASE_API_URL + API_ENDPOINTS.COINBASE_ACCOUNTS;
      const secretKey = await decryptSecret(auth.meta?.secretKey as string);
      const response = await withRetry(
        () =>
          brokerFetch<{ data: unknown[] }>(url, {
            provider: this.provider,
            headers: {
              "CB-ACCESS-KEY": auth.accessToken,
              "CB-ACCESS-SIGN": secretKey,
              "CB-ACCESS-TIMESTAMP": String(Math.floor(Date.now() / 1000)),
            },
          }),
      );

      sourcePayloads.push({ transactions: response.data });

      const sourceRef = makeSourceRef(this.provider, this.region, "default");
      const accounts = response.data as Record<string, unknown>[];

      const txPromises = accounts.map(async (account) => {
        const accountId = String(account.id);
        try {
          const txUrl = `${API_ENDPOINTS.COINBASE_API_URL}/v2/accounts/${accountId}/transactions`;
          const txResponse = await withRetry(
            () =>
              brokerFetch<{ data: unknown[] }>(txUrl, {
                provider: this.provider,
                headers: {
                  "CB-ACCESS-KEY": auth.accessToken,
                  "CB-ACCESS-SIGN": auth.meta?.secretKey as string,
                  "CB-ACCESS-TIMESTAMP": String(Math.floor(Date.now() / 1000)),
                },
              }),
          );
          return txResponse.data as Record<string, unknown>[];
        } catch {
          return [];
        }
      });

      const allTransactionsResults = await Promise.allSettled(txPromises);
      const allTransactions = allTransactionsResults
        .filter((r) => r.status === "fulfilled")
        .flatMap((r) => r.value);

      return allTransactions.map((t) => {
        const amount = t.amount as Record<string, unknown> | undefined;
        const nativeAmount = t.native_amount as Record<string, unknown> | undefined;
        return {
          source: sourceRef,
          instrument: makeInstrumentIdentity({
            symbol: amount?.currency ? String(amount.currency) : "USD",
            name: amount?.currency ? String(amount.currency) : "USD",
            chain: null,
            contractAddress: null,
            tokenStandard: null,
            exchange: "COINBASE",
            assetClass: "CRYPTO",
            region: this.region,
          }),
          transactionType: t.type as import("@/lib/types/broker").BrokerTransactionType,
          quantity: Number(amount?.amount),
          price: nativeAmount && amount ? Number(nativeAmount.amount) / Number(amount.amount) : 0,
          amount: Number(nativeAmount?.amount),
          tradeDate: t.created_at ? String(t.created_at) : new Date().toISOString(),
          settlementDate: null,
          orderId: t.id ? String(t.id) : null,
          tradeId: t.id ? String(t.id) : null,
          status: t.status ? String(t.status) : null,
          fees: null,
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
      const url = API_ENDPOINTS.COINBASE_API_URL + API_ENDPOINTS.COINBASE_ACCOUNTS;
      const secretKey = await decryptSecret(auth.meta?.secretKey as string);
      const response = await withRetry(
        () =>
          brokerFetch<{ data: unknown[] }>(url, {
            provider: this.provider,
            headers: {
              "CB-ACCESS-KEY": auth.accessToken,
              "CB-ACCESS-SIGN": secretKey,
              "CB-ACCESS-TIMESTAMP": String(Math.floor(Date.now() / 1000)),
            },
          }),
      );

      sourcePayloads.push({ balances: response.data });

      const accounts = response.data as Record<string, unknown>[];
      return accounts
        .filter((a) => a.type === "fiat_account" && a.balance && Number((a.balance as Record<string, unknown>).amount) > 0)
        .map((a) => {
          const balance = a.balance as Record<string, unknown> | undefined;
          return {
            currency: a.currency as "USD" | "INR" | "USDT" | "USDC" | "ETH" | "BTC" | "BNB",
            available: Number(balance?.amount),
            settled: null,
            marginUsed: null,
            collateral: null,
            blocked: null,
            asOf: new Date().toISOString(),
          };
        });
    } catch (error) {
      warnings.push(`Failed to fetch balances: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }
}
