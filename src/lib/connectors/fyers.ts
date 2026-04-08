import * as crypto from "crypto";
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

const BASE = "https://api-t1.fyers.in/api/v3";
const VERSION = "1.0.0";
const PROVIDER = "fyers" as const;
const REGION = "IN" as const;

// ─── Raw response shapes (FYERS API v3 docs) ─────────────────────────────────

interface FyersHolding {
  id: number;
  symbol: string;          // format: "NSE:INFY-EQ"
  isin: string;
  qty: number;
  remainingQuantity: number;
  buyAvg: number;
  costPrice: number;
  ltp: number;
  pl: number;
  marketVal: number;
  holdingType: string;
  exchange: number;
}

interface FyersPosition {
  id: string;
  symbol: string;          // format: "NSE:NIFTY25APRFUT"
  qty: number;
  buyQty: number;
  sellQty: number;
  netQty: number;
  side: number;            // 1=long, -1=short
  buyAvg: number;
  sellAvg: number;
  netAvg: number;
  realized_profit: number;
  unrealized_profit: number;
  ltp: number;
  costPrice: number;
  exchange: number;
  productType: string;
}

interface FyersHoldingsResponse {
  code: number;
  message: string;
  s: string;
  holdings: FyersHolding[];
  overall: {
    count_total: number;
    total_investment: number;
    total_current_value: number;
    total_pl: number;
    pnl_perc: number;
  };
}

interface FyersPositionsResponse {
  code: number;
  message: string;
  s: string;
  netPositions: FyersPosition[];
  overall: {
    count_total: number;
    total_investment: number;
    total_current_value: number;
    total_pl: number;
    pnl_perc: number;
  };
}

interface FyersTokenResponse {
  s: string;
  code: number;
  message: string;
  access_token: string;
}

// ─── FYERS symbol parser: "NSE:INFY-EQ" → { exchange: "NSE", symbol: "INFY" } ─

function parseFyersSymbol(raw: string): { exchange: string; symbol: string } {
  const [exchange, rest] = raw.split(":");
  const symbol = rest ? rest.replace(/-EQ$|-BE$|-BL$/, "") : raw;
  return { exchange: exchange ?? "NSE", symbol: symbol ?? raw };
}

// ─── Connector ────────────────────────────────────────────────────────────────

export const FyersConnector: BrokerConnector = {
  provider: PROVIDER,
  region: REGION,
  version: VERSION,
  supportedScopes: ["holdings", "positions"],

  async authenticate(credentials: BrokerCredentials): Promise<BrokerAuthHandle> {
    const { app_id, app_secret, auth_code } = credentials;
    if (!app_id || !app_secret || !auth_code) {
      throw new BrokerConnectorError(
        "FYERS requires app_id, app_secret, and auth_code",
        "auth_failed",
        PROVIDER,
      );
    }

    // FYERS appIdHash = SHA-256(app_id:app_secret)
    const appIdHash = crypto
      .createHash("sha256")
      .update(`${app_id}:${app_secret}`)
      .digest("hex");

    let res: Response;
    try {
      res = await fetch(`${BASE}/validate-authcode`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grant_type: "authorization_code", appIdHash, code: auth_code }),
      });
    } catch (err) {
      throw new BrokerConnectorError(`Network error: ${String(err)}`, "upstream_error", PROVIDER, true);
    }

    if (!res.ok) {
      throw new BrokerConnectorError(`FYERS auth failed: HTTP ${res.status}`, "auth_failed", PROVIDER);
    }

    const data = await res.json() as FyersTokenResponse;
    if (data.s !== "ok" || !data.access_token) {
      throw new BrokerConnectorError(
        `FYERS auth rejected: ${data.message ?? "unknown"}`,
        "auth_failed",
        PROVIDER,
      );
    }

    const expiresAt = new Date(Date.now() + 86_400_000).toISOString();

    return {
      provider: PROVIDER,
      accessToken: data.access_token,
      refreshToken: null,
      expiresAt,
      meta: { app_id },
    };
  },

  async fetchAndNormalize(
    auth: BrokerAuthHandle,
    scope?: BrokerSyncScope[],
  ): Promise<BrokerNormalizationResult> {
    // FYERS auth header format: "app_id:access_token"
    const authValue = `${auth.meta?.app_id as string}:${auth.accessToken}`;
    const headers = { Authorization: authValue };
    const warnings: string[] = [];
    const sourcePayloads: Record<string, unknown>[] = [];
    const source = makeSourceRef(PROVIDER, REGION, (auth.meta?.app_id as string) ?? "unknown");

    // Holdings
    const holdings: BrokerHolding[] = [];
    if (scopeEnabled(scope, "holdings")) {
      const raw = await withRetry(() =>
        brokerFetch<FyersHoldingsResponse>(`${BASE}/holdings`, { headers, provider: PROVIDER }),
      );
      sourcePayloads.push({ endpoint: "holdings", data: raw });

      for (const h of raw.holdings ?? []) {
        const qty = (h.qty ?? 0) + (h.remainingQuantity ?? 0);
        if (qty <= 0) {
          warnings.push(`FYERS: zero quantity for ${h.symbol}, skipping`);
          continue;
        }
        const { exchange, symbol } = parseFyersSymbol(h.symbol);
        const instrument = makeInstrumentIdentity({
          symbol,
          name: symbol,
          isin: h.isin,
          exchange,
          region: REGION,
        });
        const marketPrice = h.ltp ?? null;
        const costBasis = h.costPrice ?? qty * h.buyAvg;
        const unrealizedPnl = h.pl ?? null;
        holdings.push({
          source,
          instrument,
          quantity: qty,
          averagePrice: h.buyAvg,
          marketPrice,
          marketValue: h.marketVal ?? (marketPrice != null ? qty * marketPrice : null),
          costBasis,
          unrealizedPnl,
          unrealizedPnlPercent:
            costBasis > 0 && unrealizedPnl != null ? (unrealizedPnl / costBasis) * 100 : null,
          confidence: scoreConfidence({ isin: h.isin, exchange, marketPrice, costBasis, unrealizedPnl }),
          raw: h as unknown as Record<string, unknown>,
        });
      }
    }

    // Positions
    const positions: BrokerPosition[] = [];
    if (scopeEnabled(scope, "positions")) {
      const raw = await withRetry(() =>
        brokerFetch<FyersPositionsResponse>(`${BASE}/positions`, { headers, provider: PROVIDER }),
      );
      sourcePayloads.push({ endpoint: "positions", data: raw });

      for (const p of raw.netPositions ?? []) {
        const qty = p.netQty ?? 0;
        if (!qty) continue;
        const { exchange, symbol } = parseFyersSymbol(p.symbol);
        const instrument = makeInstrumentIdentity({
          symbol,
          name: symbol,
          exchange,
          region: REGION,
        });
        positions.push({
          source,
          instrument,
          side: p.side === 1 ? "long" : p.side === -1 ? "short" : "flat",
          quantity: Math.abs(qty),
          averagePrice: p.netAvg ?? p.buyAvg,
          marketPrice: p.ltp ?? null,
          costBasis: p.costPrice ?? null,
          unrealizedPnl: p.unrealized_profit ?? null,
          confidence: scoreConfidence({ exchange, marketPrice: p.ltp }),
          raw: p as unknown as Record<string, unknown>,
        });
      }
    }

    const snapshot = makeSnapshot(PROVIDER, REGION, holdings, positions, sourcePayloads, warnings);
    return makeNormalizationResult(PROVIDER, REGION, VERSION, snapshot, warnings);
  },
};

// ─── OAuth URL helper ─────────────────────────────────────────────────────────

export function getFyersAuthUrl(appId: string, redirectUri: string, state?: string): string {
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    response_type: "code",
    state: state ?? "insightalpha",
  });
  return `https://api-t1.fyers.in/api/v3/generate-authcode?${params.toString()}`;
}
