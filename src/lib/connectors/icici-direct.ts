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

const BASE = "https://api.icicidirect.com/apiuser";
const VERSION = "1.0.0";
const PROVIDER = "icici_direct" as const;
const REGION = "IN" as const;

// ─── Raw response shapes (Breeze Connect API) ─────────────────────────────────

interface BreezeHolding {
  stock_code: string;
  exchange_code: string;
  quantity: number;
  average_cost: number;
  ltp: number;
  profit_loss: number;
  isin_code: string;
  stock_name?: string;
}

interface BreezePosition {
  stock_code: string;
  exchange_code: string;
  quantity: number;
  average_price: number;
  ltp: number;
  product: string;
}

interface BreezeSessionResponse {
  Success: {
    session_token: string;
  };
  Status: number;
  Error: string | null;
}

interface BreezeHoldingsResponse {
  Success: BreezeHolding[] | null;
  Status: number;
  Error: string | null;
}

interface BreezePositionsResponse {
  Success: BreezePosition[] | null;
  Status: number;
  Error: string | null;
}

// ─── Connector ────────────────────────────────────────────────────────────────

export const ICICIDirectConnector: BrokerConnector = {
  provider: PROVIDER,
  region: REGION,
  version: VERSION,
  supportedScopes: ["holdings", "positions"],

  async authenticate(credentials: BrokerCredentials): Promise<BrokerAuthHandle> {
    const { api_key, api_secret, session_token } = credentials;

    if (!api_key || !api_secret) {
      throw new BrokerConnectorError(
        "ICICI Direct requires api_key and api_secret. If you have a session_token already, also pass it.",
        "auth_failed",
        PROVIDER,
      );
    }

    // If caller already has a session_token, skip the exchange
    if (session_token) {
      return {
        provider: PROVIDER,
        accessToken: session_token,
        refreshToken: null,
        expiresAt: null,
        meta: { api_key },
      };
    }

    // Generate session token via Breeze Connect POST /session
    // Breeze Connect auth: X-Checksum = "token {api_key}" during session creation;
    // the api_secret is sent in the body, not in the header.
    let res: Response;
    try {
      res = await fetch(`${BASE}/session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Checksum": `token ${api_key}`,
        },
        body: JSON.stringify({ api_key, api_secret }),
      });
    } catch (err) {
      throw new BrokerConnectorError(`Network error: ${String(err)}`, "upstream_error", PROVIDER, true);
    }

    if (!res.ok) {
      throw new BrokerConnectorError(`ICICI Direct auth failed: HTTP ${res.status}`, "auth_failed", PROVIDER);
    }

    const data = await res.json() as BreezeSessionResponse;
    if (data.Status !== 200 || !data.Success?.session_token) {
      throw new BrokerConnectorError(
        `Breeze Connect session failed: ${data.Error ?? "unknown"}`,
        "auth_failed",
        PROVIDER,
      );
    }

    return {
      provider: PROVIDER,
      accessToken: data.Success.session_token,
      refreshToken: null,
      expiresAt: null,
      meta: { api_key },
    };
  },

  async fetchAndNormalize(
    auth: BrokerAuthHandle,
    scope?: BrokerSyncScope[],
  ): Promise<BrokerNormalizationResult> {
    // For data endpoints, Breeze Connect expects: X-Checksum = "token {api_key}:{session_token}"
    const checksum = `token ${auth.meta?.api_key as string}:${auth.accessToken}`;
    const headers = { "X-Checksum": checksum, "Content-Type": "application/json" };
    const warnings: string[] = [];
    const sourcePayloads: Record<string, unknown>[] = [];
    const source = makeSourceRef(PROVIDER, REGION, "icici_account");

    // Holdings
    const holdings: BrokerHolding[] = [];
    if (scopeEnabled(scope, "holdings")) {
      const raw = await withRetry(() =>
        brokerFetch<BreezeHoldingsResponse>(`${BASE}/portfolio/holdings`, {
          method: "GET",
          headers,
          provider: PROVIDER,
        }),
      );
      sourcePayloads.push({ endpoint: "holdings", data: raw });

      for (const h of raw.Success ?? []) {
        if ((h.quantity ?? 0) <= 0) {
          warnings.push(`ICICI Direct: zero quantity for ${h.stock_code}, skipping`);
          continue;
        }
        const instrument = makeInstrumentIdentity({
          symbol: h.stock_code,
          name: h.stock_name ?? h.stock_code,
          isin: h.isin_code,
          exchange: h.exchange_code,
          region: REGION,
        });
        const marketPrice = h.ltp ?? null;
        const costBasis = h.quantity * h.average_cost;
        const unrealizedPnl = h.profit_loss ?? null;
        holdings.push({
          source,
          instrument,
          quantity: h.quantity,
          averagePrice: h.average_cost,
          marketPrice,
          marketValue: marketPrice != null ? h.quantity * marketPrice : null,
          costBasis,
          unrealizedPnl,
          unrealizedPnlPercent:
            costBasis > 0 && unrealizedPnl != null ? (unrealizedPnl / costBasis) * 100 : null,
          confidence: scoreConfidence({ isin: h.isin_code, exchange: h.exchange_code, marketPrice, costBasis, unrealizedPnl }),
          raw: h as unknown as Record<string, unknown>,
        });
      }
    }

    // Positions
    const positions: BrokerPosition[] = [];
    if (scopeEnabled(scope, "positions")) {
      const raw = await withRetry(() =>
        brokerFetch<BreezePositionsResponse>(`${BASE}/portfolio/positions`, {
          method: "GET",
          headers,
          provider: PROVIDER,
        }),
      );
      sourcePayloads.push({ endpoint: "positions", data: raw });

      for (const p of raw.Success ?? []) {
        if (!p.quantity) continue;
        const instrument = makeInstrumentIdentity({
          symbol: p.stock_code,
          name: p.stock_code,
          exchange: p.exchange_code,
          region: REGION,
        });
        positions.push({
          source,
          instrument,
          side: p.quantity > 0 ? "long" : "short",
          quantity: Math.abs(p.quantity),
          averagePrice: p.average_price,
          marketPrice: p.ltp ?? null,
          confidence: scoreConfidence({ exchange: p.exchange_code }),
          raw: p as unknown as Record<string, unknown>,
        });
      }
    }

    const snapshot = makeSnapshot(PROVIDER, REGION, holdings, positions, sourcePayloads, warnings);
    return makeNormalizationResult(PROVIDER, REGION, VERSION, snapshot, warnings);
  },
};
