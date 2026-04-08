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

const BASE = "https://gw-napi.kotaksecurities.com";
const VERSION = "1.0.0";
const PROVIDER = "kotak_neo" as const;
const REGION = "IN" as const;

// ─── Raw response shapes (Kotak Neo REST API) ─────────────────────────────────

interface KotakHolding {
  trdSym: string;        // trading symbol
  isin: string;
  exch: string;          // exchange
  qty: number;
  avgPrice: number;
  mktPrice: number;
  mktVal: number;
  pnl: number;
  pnlPct: number;
}

interface KotakPosition {
  trdSym: string;
  exch: string;
  netQty: number;
  avgPrice: number;
  mktPrice: number;
  pnl: number;
  prdType: string;
}

interface KotakSessionResponse {
  data: {
    token: string;
    sid: string;
    rid: string;
    hsServerId: string;
    ucc: string;
  };
  errMsg: string | null;
  internalErrCode: string;
  errCode: string;
}

interface KotakHoldingsResponse {
  data: KotakHolding[] | null;
  errMsg: string | null;
}

interface KotakPositionsResponse {
  data: KotakPosition[] | null;
  errMsg: string | null;
}

// ─── Connector ────────────────────────────────────────────────────────────────

export const KotakNeoConnector: BrokerConnector = {
  provider: PROVIDER,
  region: REGION,
  version: VERSION,
  supportedScopes: ["holdings", "positions"],

  async authenticate(credentials: BrokerCredentials): Promise<BrokerAuthHandle> {
    const { consumer_key, consumer_secret, mobile_number, password, mpin, otp } = credentials;

    if (!consumer_key || !consumer_secret) {
      throw new BrokerConnectorError(
        "Kotak Neo requires consumer_key and consumer_secret from the Neo API portal",
        "auth_failed",
        PROVIDER,
      );
    }

    // Step 1: Generate session token via OTP login
    const basicAuth = Buffer.from(`${consumer_key}:${consumer_secret}`).toString("base64");

    let res: Response;
    try {
      res = await fetch(`${BASE}/login/1.0/login/v2/validate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Basic ${basicAuth}`,
        },
        body: JSON.stringify({ mobileNumber: mobile_number, password, mpin, otp }),
      });
    } catch (err) {
      throw new BrokerConnectorError(`Network error: ${String(err)}`, "upstream_error", PROVIDER, true);
    }

    if (!res.ok) {
      throw new BrokerConnectorError(`Kotak Neo auth failed: HTTP ${res.status}`, "auth_failed", PROVIDER);
    }

    const data = await res.json() as KotakSessionResponse;
    if (!data.data?.token) {
      throw new BrokerConnectorError(
        `Kotak Neo session failed: ${data.errMsg ?? "unknown"}`,
        "auth_failed",
        PROVIDER,
      );
    }

    return {
      provider: PROVIDER,
      accessToken: data.data.token,
      refreshToken: null,
      expiresAt: null,
      meta: {
        consumer_key,
        consumer_secret,
        sid: data.data.sid,
        ucc: data.data.ucc,
      },
    };
  },

  async fetchAndNormalize(
    auth: BrokerAuthHandle,
    scope?: BrokerSyncScope[],
  ): Promise<BrokerNormalizationResult> {
    const basicAuth = Buffer.from(
      `${auth.meta?.consumer_key as string}:${auth.meta?.consumer_secret as string}`,
    ).toString("base64");
    const headers = {
      "Authorization": `Bearer ${auth.accessToken}`,
      "Sid": (auth.meta?.sid as string) ?? "",
      "Auth": `Basic ${basicAuth}`,
      "neo-fin-key": "neotradeapi",
      "Content-Type": "application/json",
    };
    const warnings: string[] = [];
    const sourcePayloads: Record<string, unknown>[] = [];
    const ucc = (auth.meta?.ucc as string) ?? "unknown";
    const source = makeSourceRef(PROVIDER, REGION, ucc);

    // Holdings
    const holdings: BrokerHolding[] = [];
    if (scopeEnabled(scope, "holdings")) {
      const raw = await withRetry(() =>
        brokerFetch<KotakHoldingsResponse>(
          `${BASE}/portfolio/1.0/portfolio/v1/holdings`,
          { method: "GET", headers, provider: PROVIDER },
        ),
      );
      sourcePayloads.push({ endpoint: "holdings", data: raw });

      for (const h of raw.data ?? []) {
        if ((h.qty ?? 0) <= 0) {
          warnings.push(`Kotak Neo: zero quantity for ${h.trdSym}, skipping`);
          continue;
        }
        const instrument = makeInstrumentIdentity({
          symbol: h.trdSym,
          name: h.trdSym,
          isin: h.isin,
          exchange: h.exch,
          region: REGION,
        });
        const marketPrice = h.mktPrice ?? null;
        const costBasis = h.qty * h.avgPrice;
        const unrealizedPnl = h.pnl ?? null;
        holdings.push({
          source,
          instrument,
          quantity: h.qty,
          averagePrice: h.avgPrice,
          marketPrice,
          marketValue: h.mktVal ?? null,
          costBasis,
          unrealizedPnl,
          unrealizedPnlPercent: h.pnlPct ?? null,
          confidence: scoreConfidence({ isin: h.isin, exchange: h.exch, marketPrice, costBasis, unrealizedPnl }),
          raw: h as unknown as Record<string, unknown>,
        });
      }
    }

    // Positions
    const positions: BrokerPosition[] = [];
    if (scopeEnabled(scope, "positions")) {
      const raw = await withRetry(() =>
        brokerFetch<KotakPositionsResponse>(
          `${BASE}/portfolio/1.0/portfolio/v1/positions`,
          { method: "GET", headers, provider: PROVIDER },
        ),
      );
      sourcePayloads.push({ endpoint: "positions", data: raw });

      for (const p of raw.data ?? []) {
        if (!p.netQty) continue;
        const instrument = makeInstrumentIdentity({
          symbol: p.trdSym,
          name: p.trdSym,
          exchange: p.exch,
          region: REGION,
        });
        positions.push({
          source,
          instrument,
          side: p.netQty > 0 ? "long" : p.netQty < 0 ? "short" : "flat",
          quantity: Math.abs(p.netQty),
          averagePrice: p.avgPrice,
          marketPrice: p.mktPrice ?? null,
          unrealizedPnl: p.pnl ?? null,
          confidence: scoreConfidence({ exchange: p.exch }),
          raw: p as unknown as Record<string, unknown>,
        });
      }
    }

    const snapshot = makeSnapshot(PROVIDER, REGION, holdings, positions, sourcePayloads, warnings);
    return makeNormalizationResult(PROVIDER, REGION, VERSION, snapshot, warnings);
  },
};
