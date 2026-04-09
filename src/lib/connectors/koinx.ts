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

// ─── KoinX Connector ─────────────────────────────────────────────────────────────

export class KoinxConnector implements BrokerConnector {
  readonly provider = "koinx" as const;
  readonly region = "IN" as const;
  readonly version = "1.0.0";
  readonly supportedScopes: BrokerSyncScope[] = ["holdings", "transactions", "balances"];

  async authenticate(credentials: BrokerCredentials): Promise<BrokerAuthHandle> {
    validateCredentials(credentials, ["apiKey", "clientId"], this.provider);

    const apiKey = sanitizeAndValidateCredential(credentials.apiKey, "apiKey", this.provider);
    const clientId = sanitizeAndValidateCredential(credentials.clientId, "apiKey", this.provider);

    // KoinX uses API key + client ID for authentication
    // In a real implementation, this would validate credentials with KoinX API
    return {
      provider: this.provider,
      accessToken: apiKey,
      meta: { clientId: await encryptSecret(clientId) },
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
      const url = API_ENDPOINTS.KOINX_API_URL + API_ENDPOINTS.KOINX_PORTFOLIO_HOLDINGS;
      const clientId = await decryptSecret(auth.meta?.clientId as string);
      const response = await withRetry(
        () =>
          brokerFetch<{ holdings: unknown[] }>(url, {
            provider: this.provider,
            headers: {
              "X-API-Key": auth.accessToken,
              "X-Client-ID": clientId,
            },
          }),
      );

      sourcePayloads.push({ holdings: response.holdings });

      const sourceRef = makeSourceRef(this.provider, this.region, "default");
      const holdings = response.holdings as Record<string, unknown>[] || [];
      return holdings.map((h) => {
        const instrument = makeInstrumentIdentity({
          symbol: String(h.symbol),
          name: String(h.name),
          chain: h.chain as string | null,
          contractAddress: h.contractAddress as string | null,
          tokenStandard: h.tokenStandard as "ERC20" | "ERC721" | "ERC1155" | "SPL" | "BEP20" | null,
          exchange: h.exchange as string | null,
          assetClass: "CRYPTO",
          region: this.region,
          sector: h.sector as string | null,
        });

        return {
          source: sourceRef,
          instrument,
          quantity: Number(h.quantity),
          averagePrice: Number(h.averagePrice),
          marketPrice: h.marketPrice ? Number(h.marketPrice) : null,
          marketValue: h.marketValue ? Number(h.marketValue) : null,
          costBasis: h.costBasis ? Number(h.costBasis) : null,
          unrealizedPnl: h.unrealizedPnl ? Number(h.unrealizedPnl) : null,
          unrealizedPnlPercent: h.unrealizedPnlPercent ? Number(h.unrealizedPnlPercent) : null,
          dayChange: h.dayChange ? Number(h.dayChange) : null,
          dayChangePercent: h.dayChangePercent ? Number(h.dayChangePercent) : null,
          confidence: scoreConfidence({
            contractAddress: instrument.contractAddress,
            exchange: instrument.exchange,
            marketPrice: h.marketPrice ? Number(h.marketPrice) : null,
            costBasis: h.costBasis ? Number(h.costBasis) : null,
            unrealizedPnl: h.unrealizedPnl ? Number(h.unrealizedPnl) : null,
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
      const url = API_ENDPOINTS.KOINX_API_URL + API_ENDPOINTS.KOINX_PORTFOLIO_TRANSACTIONS;
      const clientId = await decryptSecret(auth.meta?.clientId as string);
      const response = await withRetry(
        () =>
          brokerFetch<{ transactions: unknown[] }>(url, {
            provider: this.provider,
            headers: {
              "X-API-Key": auth.accessToken,
              "X-Client-ID": clientId,
            },
          }),
      );

      sourcePayloads.push({ transactions: response.transactions });

      const sourceRef = makeSourceRef(this.provider, this.region, "default");
      const transactions = response.transactions as Record<string, unknown>[] || [];
      return transactions.map((t) => ({
        source: sourceRef,
        instrument: makeInstrumentIdentity({
          symbol: String(t.symbol),
          name: String(t.name),
          chain: t.chain as string | null,
          contractAddress: t.contractAddress as string | null,
          tokenStandard: t.tokenStandard as "ERC20" | "ERC721" | "ERC1155" | "SPL" | "BEP20" | null,
          exchange: t.exchange as string | null,
          assetClass: "CRYPTO",
          region: this.region,
        }),
        transactionType: t.type as import("@/lib/types/broker").BrokerTransactionType,
        quantity: Number(t.quantity),
        price: Number(t.price),
        amount: Number(t.amount),
        tradeDate: String(t.date),
        settlementDate: t.settlementDate ? String(t.settlementDate) : null,
        orderId: t.orderId ? String(t.orderId) : null,
        tradeId: t.tradeId ? String(t.tradeId) : null,
        status: t.status ? String(t.status) : null,
        fees: t.fees ? Number(t.fees) : null,
        taxes: t.taxes ? Number(t.taxes) : null,
        notes: t.notes ? String(t.notes) : null,
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
      const url = API_ENDPOINTS.KOINX_API_URL + API_ENDPOINTS.KOINX_BALANCES;
      const clientId = await decryptSecret(auth.meta?.clientId as string);
      const response = await withRetry(
        () =>
          brokerFetch<{ balances: unknown[] }>(url, {
            provider: this.provider,
            headers: {
              "X-API-Key": auth.accessToken,
              "X-Client-ID": clientId,
            },
          }),
      );

      sourcePayloads.push({ balances: response.balances });

      const balances = response.balances as Record<string, unknown>[] || [];
      return balances.map((b) => ({
        currency: b.currency as "USD" | "INR" | "USDT" | "USDC" | "ETH" | "BTC" | "BNB",
        available: Number(b.available),
        settled: b.settled ? Number(b.settled) : null,
        marginUsed: b.marginUsed ? Number(b.marginUsed) : null,
        collateral: b.collateral ? Number(b.collateral) : null,
        blocked: b.blocked ? Number(b.blocked) : null,
        asOf: String(b.asOf),
      }));
    } catch (error) {
      warnings.push(`Failed to fetch balances: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  async fetchTaxReport(
    auth: BrokerAuthHandle,
    year: number,
    warnings: string[],
  ): Promise<Record<string, unknown> | null> {
    try {
      const url = API_ENDPOINTS.KOINX_API_URL + API_ENDPOINTS.KOINX_TAX_REPORT;
      const clientId = await decryptSecret(auth.meta?.clientId as string);
      const response = await withRetry(
        () =>
          brokerFetch<Record<string, unknown>>(url, {
            provider: this.provider,
            headers: {
              "X-API-Key": auth.accessToken,
              "X-Client-ID": clientId,
            },
          }),
      );

      return response;
    } catch (error) {
      warnings.push(`Failed to fetch tax report: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }
}
