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

const BASE = "https://openapi.motilaloswal.com/rest/login/v3";
const TRADE_BASE = "https://openapi.motilaloswal.com/rest/report/v1";
const VERSION = "1.0.0";
const PROVIDER = "motilal_oswal" as const;
const REGION = "IN" as const;

// ─── Raw response shapes (Motilal Oswal OpenAPI docs) ────────────────────────

interface MOHolding {
  exchange: string;
  symbol: string;
  isin: string;
  qty: number;
  avgprice: number;
  ltp: number;
  pnl: number;
  curval: number;
  purchasevalue: number;
  pnlpercent: number;
  scripname?: string;
}

interface MOPosition {
  exchange: string;
  symbol: string;
  netqty: number;
  avgprice: number;
  ltp: number;
  pnl: number;
  producttype: string;
}

interface MOAuthResponse {
  status: string;
  data: {
    AuthToken: string;
    clientid: string;
    UserName: string;
  };
  ErrorCode: string;
  message: string;
}

interface MOHoldingsResponse {
  status: string;
  data: MOHolding[];
  message: string;
}

interface MOPositionsResponse {
  status: string;
  data: MOPosition[];
  message: string;
}

// ─── Connector ────────────────────────────────────────────────────────────────

export const MotilalOswalConnector: BrokerConnector = {
  provider: PROVIDER,
  region: REGION,
  version: VERSION,
  supportedScopes: ["holdings", "positions"],

  async authenticate(credentials: BrokerCredentials): Promise<BrokerAuthHandle> {
    const { client_id, password, api_key, totp } = credentials;

    if (!client_id || !password || !api_key) {
      throw new BrokerConnectorError(
        "Motilal Oswal requires client_id, password, and api_key from the MO API portal",
        "auth_failed",
        PROVIDER,
      );
    }

    let res: Response;
    try {
      res = await fetch(`${BASE}/gettoken`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "ApiKey": api_key,
        },
        body: JSON.stringify({
          clientid: client_id,
          password,
          totp: totp ?? "",
        }),
      });
    } catch (err) {
      throw new BrokerConnectorError(`Network error: ${String(err)}`, "upstream_error", PROVIDER, true);
    }

    if (!res.ok) {
      throw new BrokerConnectorError(`MO auth failed: HTTP ${res.status}`, "auth_failed", PROVIDER);
    }

    const data = await res.json() as MOAuthResponse;
    if (data.status !== "SUCCESS" || !data.data?.AuthToken) {
      throw new BrokerConnectorError(
        `MO auth rejected: ${data.message ?? data.ErrorCode ?? "unknown"}`,
        "auth_failed",
        PROVIDER,
      );
    }

    return {
      provider: PROVIDER,
      accessToken: data.data.AuthToken,
      refreshToken: null,
      expiresAt: null,
      meta: { api_key, client_id: data.data.clientid },
    };
  },

  async fetchAndNormalize(
    auth: BrokerAuthHandle,
    scope?: BrokerSyncScope[],
  ): Promise<BrokerNormalizationResult> {
    const headers = {
      "Authorization": `Bearer ${auth.accessToken}`,
      "ApiKey": (auth.meta?.api_key as string) ?? "",
      "Content-Type": "application/json",
    };
    const warnings: string[] = [];
    const sourcePayloads: Record<string, unknown>[] = [];
    const source = makeSourceRef(PROVIDER, REGION, (auth.meta?.client_id as string) ?? "unknown");

    // Holdings
    const holdings: BrokerHolding[] = [];
    if (scopeEnabled(scope, "holdings")) {
      const raw = await withRetry(() =>
        brokerFetch<MOHoldingsResponse>(`${TRADE_BASE}/getholdingtransaction`, {
          method: "POST",
          headers,
          body: JSON.stringify({ clientid: auth.meta?.client_id }),
          provider: PROVIDER,
        }),
      );
      sourcePayloads.push({ endpoint: "holdings", data: raw });

      for (const h of raw.data ?? []) {
        if ((h.qty ?? 0) <= 0) {
          warnings.push(`MO: zero quantity for ${h.symbol}, skipping`);
          continue;
        }
        const instrument = makeInstrumentIdentity({
          symbol: h.symbol,
          name: h.scripname ?? h.symbol,
          isin: h.isin,
          exchange: h.exchange,
          region: REGION,
        });
        const marketPrice = h.ltp ?? null;
        const costBasis = h.purchasevalue ?? h.qty * h.avgprice;
        const unrealizedPnl = h.pnl ?? null;
        holdings.push({
          source,
          instrument,
          quantity: h.qty,
          averagePrice: h.avgprice,
          marketPrice,
          marketValue: h.curval ?? null,
          costBasis,
          unrealizedPnl,
          unrealizedPnlPercent: h.pnlpercent ?? null,
          confidence: scoreConfidence({ isin: h.isin, exchange: h.exchange, marketPrice, costBasis, unrealizedPnl }),
          raw: h as unknown as Record<string, unknown>,
        });
      }
    }

    // Positions
    const positions: BrokerPosition[] = [];
    if (scopeEnabled(scope, "positions")) {
      const raw = await withRetry(() =>
        brokerFetch<MOPositionsResponse>(`${TRADE_BASE}/getposition`, {
          method: "POST",
          headers,
          body: JSON.stringify({ clientid: auth.meta?.client_id }),
          provider: PROVIDER,
        }),
      );
      sourcePayloads.push({ endpoint: "positions", data: raw });

      for (const p of raw.data ?? []) {
        if (!p.netqty) continue;
        const instrument = makeInstrumentIdentity({
          symbol: p.symbol,
          name: p.symbol,
          exchange: p.exchange,
          region: REGION,
        });
        positions.push({
          source,
          instrument,
          side: p.netqty > 0 ? "long" : p.netqty < 0 ? "short" : "flat",
          quantity: Math.abs(p.netqty),
          averagePrice: p.avgprice,
          marketPrice: p.ltp ?? null,
          unrealizedPnl: p.pnl ?? null,
          confidence: scoreConfidence({ exchange: p.exchange }),
          raw: p as unknown as Record<string, unknown>,
        });
      }
    }

    const snapshot = makeSnapshot(PROVIDER, REGION, holdings, positions, sourcePayloads, warnings);
    return makeNormalizationResult(PROVIDER, REGION, VERSION, snapshot, warnings);
  },
};
