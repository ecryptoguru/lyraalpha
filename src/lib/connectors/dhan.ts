import type {
  BrokerConnector,
  BrokerCredentials,
  BrokerAuthHandle,
  BrokerNormalizationResult,
  BrokerSyncScope,
  BrokerHolding,
  BrokerPosition,
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

const BASE = "https://api.dhan.co/v2";
const VERSION = "1.0.0";
const PROVIDER = "dhan" as const;
const REGION = "IN" as const;

// ─── Raw response shapes (DhanHQ v2 docs) ────────────────────────────────────

interface DhanHolding {
  exchange: string;
  tradingSymbol: string;
  securityId: string;
  isin: string;
  totalQty: number;
  dpQty: number;
  t1Qty: number;
  availableQty: number;
  collateralQty: number;
  avgCostPrice: number;
  lastTradedPrice: number;
  unrealizedProfit: number;
  investedValue: number;
  currentValue: number;
  drQty?: number;
}

interface DhanPosition {
  dhanClientId: string;
  tradingSymbol: string;
  securityId: string;
  exchangeSegment: string;
  productType: string;
  buyAvg: number;
  sellAvg: number;
  netQty: number;
  realizedProfit: number;
  unrealizedProfit: number;
  rbiReferenceRate: number;
  multiplier: number;
  carryForwardBuyQty: number;
  carryForwardSellQty: number;
  carryForwardBuyValue: number;
  carryForwardSellValue: number;
  dayBuyQty: number;
  daySellQty: number;
  dayBuyValue: number;
  daySellValue: number;
  drvExpiryDate: string;
  drvOptionType: string;
  drvStrikePrice: number;
  crossCurrency: boolean;
  costPrice: number;
  lastTradedPrice: number;
}

// ─── Connector ────────────────────────────────────────────────────────────────

export const DhanConnector: BrokerConnector = {
  provider: PROVIDER,
  region: REGION,
  version: VERSION,
  supportedScopes: ["holdings", "positions", "balances"],

  async authenticate(credentials: BrokerCredentials): Promise<BrokerAuthHandle> {
    const { access_token, client_id } = credentials;
    if (!access_token || !client_id) {
      throw new BrokerConnectorError(
        "Dhan requires access_token and client_id from the DhanHQ developer portal",
        "auth_failed",
        PROVIDER,
      );
    }
    // Dhan tokens are long-lived (issued from developer portal); no exchange needed
    return {
      provider: PROVIDER,
      accessToken: access_token,
      refreshToken: null,
      expiresAt: null,
      meta: { client_id },
    };
  },

  async fetchAndNormalize(
    auth: BrokerAuthHandle,
    scope?: BrokerSyncScope[],
  ): Promise<BrokerNormalizationResult> {
    const headers = {
      "access-token": auth.accessToken,
      "client-id": (auth.meta?.client_id as string) ?? "",
      "Content-Type": "application/json",
      "Accept": "application/json",
    };
    const warnings: string[] = [];
    const sourcePayloads: Record<string, unknown>[] = [];
    const source = makeSourceRef(PROVIDER, REGION, (auth.meta?.client_id as string) ?? "unknown");

    // Holdings
    const holdings: BrokerHolding[] = [];
    if (scopeEnabled(scope, "holdings")) {
      const raw = await withRetry(() =>
        brokerFetch<DhanHolding[]>(`${BASE}/holdings`, { headers, provider: PROVIDER }),
      );
      sourcePayloads.push({ endpoint: "holdings", data: raw });

      for (const h of Array.isArray(raw) ? raw : []) {
        const qty = (h.totalQty ?? 0);
        if (qty <= 0) {
          warnings.push(`Dhan: zero quantity for ${h.tradingSymbol}, skipping`);
          continue;
        }
        const instrument = makeInstrumentIdentity({
          symbol: h.tradingSymbol,
          name: h.tradingSymbol,
          isin: h.isin,
          exchange: h.exchange !== "ALL" ? h.exchange : null,
          region: REGION,
        });
        const marketPrice = h.lastTradedPrice ?? null;
        const costBasis = h.investedValue ?? qty * h.avgCostPrice;
        const unrealizedPnl = h.unrealizedProfit ?? null;
        holdings.push({
          source,
          instrument,
          quantity: qty,
          averagePrice: h.avgCostPrice,
          marketPrice,
          marketValue: h.currentValue ?? (marketPrice != null ? qty * marketPrice : null),
          costBasis,
          unrealizedPnl,
          unrealizedPnlPercent:
            costBasis > 0 && unrealizedPnl != null ? (unrealizedPnl / costBasis) * 100 : null,
          confidence: scoreConfidence({ isin: h.isin, marketPrice, costBasis, unrealizedPnl }),
          raw: h as unknown as Record<string, unknown>,
        });
      }
    }

    // Positions
    const positions: BrokerPosition[] = [];
    if (scopeEnabled(scope, "positions")) {
      const raw = await withRetry(() =>
        brokerFetch<DhanPosition[]>(`${BASE}/positions`, { headers, provider: PROVIDER }),
      );
      sourcePayloads.push({ endpoint: "positions", data: raw });

      for (const p of Array.isArray(raw) ? raw : []) {
        const qty = p.netQty ?? 0;
        if (!qty) continue;
        const instrument = makeInstrumentIdentity({
          symbol: p.tradingSymbol,
          name: p.tradingSymbol,
          exchange: p.exchangeSegment ?? null,
          region: REGION,
        });
        const ltp = p.lastTradedPrice ?? null;
        positions.push({
          source,
          instrument,
          side: qty > 0 ? "long" : qty < 0 ? "short" : "flat",
          quantity: Math.abs(qty),
          averagePrice: p.costPrice ?? p.buyAvg,
          marketPrice: ltp,
          unrealizedPnl: p.unrealizedProfit ?? null,
          confidence: scoreConfidence({ exchange: p.exchangeSegment, marketPrice: ltp }),
          raw: p as unknown as Record<string, unknown>,
        });
      }
    }

    const snapshot = makeSnapshot(PROVIDER, REGION, holdings, positions, sourcePayloads, warnings);
    return makeNormalizationResult(PROVIDER, REGION, VERSION, snapshot, warnings);
  },
};
