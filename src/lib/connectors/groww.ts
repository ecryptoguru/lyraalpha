import type {
  BrokerConnector,
  BrokerCredentials,
  BrokerAuthHandle,
  BrokerNormalizationResult,
  BrokerSyncScope,
  BrokerHolding,
} from "@/lib/types/broker";
import {
  BrokerConnectorError,
  brokerFetch,
  makeSourceRef,
  makeInstrumentIdentity,
  makeSnapshot,
  makeNormalizationResult,
  scoreConfidence,
  scopeEnabled,
  withRetry,
} from "./base";

const BASE = "https://groww.in/v1/api";
const VERSION = "1.0.0";
const PROVIDER = "groww" as const;
const REGION = "IN" as const;

// ─── Raw response shapes (Groww partner API — public endpoints) ───────────────

interface GrowwHolding {
  tradingSymbol: string;
  isin: string;
  exchange: string;
  quantity: number;
  averagePrice: number;
  ltp: number;
  investedValue: number;
  currentValue: number;
  pnl: number;
  pnlPercent: number;
}

interface GrowwHoldingsResponse {
  holdingResponses: GrowwHolding[];
  totalCount: number;
}

// ─── Connector ────────────────────────────────────────────────────────────────

export const GrowwConnector: BrokerConnector = {
  provider: PROVIDER,
  region: REGION,
  version: VERSION,
  supportedScopes: ["holdings", "positions"],

  async authenticate(credentials: BrokerCredentials): Promise<BrokerAuthHandle> {
    const { access_token, user_id } = credentials;
    if (!access_token || !user_id) {
      throw new BrokerConnectorError(
        "Groww requires access_token and user_id (issued from Groww partner portal)",
        "auth_failed",
        PROVIDER,
      );
    }
    return {
      provider: PROVIDER,
      accessToken: access_token,
      refreshToken: null,
      expiresAt: null,
      meta: { user_id },
    };
  },

  async fetchAndNormalize(
    auth: BrokerAuthHandle,
    scope?: BrokerSyncScope[],
  ): Promise<BrokerNormalizationResult> {
    const headers = {
      Authorization: `Bearer ${auth.accessToken}`,
      Accept: "application/json",
    };
    const warnings: string[] = [];
    const sourcePayloads: Record<string, unknown>[] = [];
    const source = makeSourceRef(PROVIDER, REGION, (auth.meta?.user_id as string) ?? "unknown");

    const holdings: BrokerHolding[] = [];
    if (scopeEnabled(scope, "holdings")) {
      const raw = await withRetry(() =>
        brokerFetch<GrowwHoldingsResponse>(`${BASE}/stocks-data/portfolio/v1/holdings`, {
          headers,
          provider: PROVIDER,
        }),
      );
      sourcePayloads.push({ endpoint: "holdings", data: raw });

      for (const h of raw.holdingResponses ?? []) {
        if ((h.quantity ?? 0) <= 0) {
          warnings.push(`Groww: zero quantity for ${h.tradingSymbol}, skipping`);
          continue;
        }
        const instrument = makeInstrumentIdentity({
          symbol: h.tradingSymbol,
          name: h.tradingSymbol,
          isin: h.isin,
          exchange: h.exchange,
          region: REGION,
        });
        const marketPrice = h.ltp ?? null;
        const costBasis = h.investedValue ?? h.quantity * h.averagePrice;
        const unrealizedPnl = h.pnl ?? null;
        holdings.push({
          source,
          instrument,
          quantity: h.quantity,
          averagePrice: h.averagePrice,
          marketPrice,
          marketValue: h.currentValue ?? null,
          costBasis,
          unrealizedPnl,
          unrealizedPnlPercent: h.pnlPercent ?? null,
          confidence: scoreConfidence({ isin: h.isin, exchange: h.exchange, marketPrice, costBasis, unrealizedPnl }),
          raw: h as unknown as Record<string, unknown>,
        });
      }
    }

    const snapshot = makeSnapshot(PROVIDER, REGION, holdings, [], sourcePayloads, warnings);
    return makeNormalizationResult(PROVIDER, REGION, VERSION, snapshot, warnings);
  },
};
