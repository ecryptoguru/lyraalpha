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

const BASE = "https://api.kite.trade";
const VERSION = "1.0.0";
const PROVIDER = "zerodha" as const;
const REGION = "IN" as const;

// ─── Raw response shapes (from official docs) ─────────────────────────────────

interface KiteHolding {
  tradingsymbol: string;
  exchange: string;
  isin: string;
  quantity: number;
  t1_quantity: number;
  average_price: number;
  last_price: number;
  close_price: number;
  pnl: number;
  day_change: number;
  day_change_percentage: number;
  product: string;
}

interface KitePosition {
  tradingsymbol: string;
  exchange: string;
  instrument_token: number;
  product: string;
  quantity: number;
  overnight_quantity: number;
  average_price: number;
  last_price: number;
  close_price: number;
  pnl: number;
  day_change: number;
  day_change_percentage: number;
  multiplier: number;
  buy_quantity: number;
  sell_quantity: number;
  buy_price: number;
  sell_price: number;
  buy_value: number;
  sell_value: number;
  value: number;
  unrealised: number;
  realised: number;
  m2m: number;
}

interface KitePositionsResponse {
  status: string;
  data: { net: KitePosition[]; day: KitePosition[] };
}

interface KiteHoldingsResponse {
  status: string;
  data: KiteHolding[];
}

interface KiteTokenResponse {
  status: string;
  data: {
    user_id: string;
    user_name: string;
    access_token: string;
    refresh_token: string;
    login_time: string;
  };
}

// ─── Auth helpers ─────────────────────────────────────────────────────────────

function kiteChecksum(apiKey: string, requestToken: string, apiSecret: string): string {
  return crypto.createHash("sha256").update(apiKey + requestToken + apiSecret).digest("hex");
}

function kiteAuthHeader(apiKey: string, accessToken: string): Record<string, string> {
  return {
    "Authorization": `token ${apiKey}:${accessToken}`,
    "X-Kite-Version": "3",
  };
}

// ─── Connector ────────────────────────────────────────────────────────────────

export const ZerodhaConnector: BrokerConnector = {
  provider: PROVIDER,
  region: REGION,
  version: VERSION,
  supportedScopes: ["holdings", "positions", "balances"],

  async authenticate(credentials: BrokerCredentials): Promise<BrokerAuthHandle> {
    const { api_key, request_token, api_secret } = credentials;
    if (!api_key || !request_token || !api_secret) {
      throw new BrokerConnectorError(
        "Zerodha requires api_key, request_token, and api_secret",
        "auth_failed",
        PROVIDER,
      );
    }

    const checksum = kiteChecksum(api_key, request_token, api_secret);
    const body = new URLSearchParams({ api_key, request_token, checksum });

    let res: Response;
    try {
      res = await fetch(`${BASE}/session/token`, {
        method: "POST",
        headers: { "X-Kite-Version": "3", "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });
    } catch (err) {
      throw new BrokerConnectorError(`Network error: ${String(err)}`, "upstream_error", PROVIDER, true);
    }

    if (!res.ok) {
      throw new BrokerConnectorError(`Auth failed: HTTP ${res.status}`, "auth_failed", PROVIDER);
    }

    const data = await res.json() as KiteTokenResponse;
    if (data.status !== "success") {
      throw new BrokerConnectorError("Zerodha auth rejected", "auth_failed", PROVIDER);
    }

    return {
      provider: PROVIDER,
      accessToken: data.data.access_token,
      refreshToken: data.data.refresh_token ?? null,
      expiresAt: null, // Kite tokens expire at 06:00 IST next day
      meta: { api_key, user_id: data.data.user_id },
    };
  },

  async fetchAndNormalize(
    auth: BrokerAuthHandle,
    scope?: BrokerSyncScope[],
  ): Promise<BrokerNormalizationResult> {
    const apiKey = auth.meta?.api_key as string;
    const headers = kiteAuthHeader(apiKey, auth.accessToken);
    const warnings: string[] = [];
    const sourcePayloads: Record<string, unknown>[] = [];

    const source = makeSourceRef(PROVIDER, REGION, (auth.meta?.user_id as string) ?? "unknown");

    // Holdings
    const holdings: BrokerHolding[] = [];
    if (scopeEnabled(scope, "holdings")) {
      const raw = await withRetry(() =>
        brokerFetch<KiteHoldingsResponse>(`${BASE}/portfolio/holdings`, { headers, provider: PROVIDER }),
      );
      sourcePayloads.push({ endpoint: "holdings", data: raw });

      for (const h of raw.data ?? []) {
        const qty = (h.quantity ?? 0) + (h.t1_quantity ?? 0);
        if (qty <= 0) {
          warnings.push(`Zerodha: zero quantity for ${h.tradingsymbol}, skipping`);
          continue;
        }
        const instrument = makeInstrumentIdentity({
          symbol: h.tradingsymbol,
          name: h.tradingsymbol,
          isin: h.isin,
          exchange: h.exchange,
          region: REGION,
        });
        const marketPrice = h.last_price ?? null;
        const costBasis = qty * h.average_price;
        const unrealizedPnl = h.pnl ?? null;
        holdings.push({
          source,
          instrument,
          quantity: qty,
          averagePrice: h.average_price,
          marketPrice,
          marketValue: marketPrice != null ? qty * marketPrice : null,
          costBasis,
          unrealizedPnl,
          unrealizedPnlPercent:
            costBasis > 0 && unrealizedPnl != null ? (unrealizedPnl / costBasis) * 100 : null,
          dayChange: h.day_change ?? null,
          dayChangePercent: h.day_change_percentage ?? null,
          confidence: scoreConfidence({ isin: h.isin, exchange: h.exchange, marketPrice, costBasis, unrealizedPnl }),
          raw: h as unknown as Record<string, unknown>,
        });
      }
    }

    // Positions (net)
    const positions: BrokerPosition[] = [];
    if (scopeEnabled(scope, "positions")) {
      const raw = await withRetry(() =>
        brokerFetch<KitePositionsResponse>(`${BASE}/portfolio/positions`, { headers, provider: PROVIDER }),
      );
      sourcePayloads.push({ endpoint: "positions", data: raw });

      for (const p of raw.data?.net ?? []) {
        if (!p.quantity) continue;
        const instrument = makeInstrumentIdentity({
          symbol: p.tradingsymbol,
          name: p.tradingsymbol,
          exchange: p.exchange,
          region: REGION,
        });
        positions.push({
          source,
          instrument,
          side: p.quantity > 0 ? "long" : p.quantity < 0 ? "short" : "flat",
          quantity: Math.abs(p.quantity),
          overnightQuantity: p.overnight_quantity ?? null,
          averagePrice: p.average_price,
          marketPrice: p.last_price ?? null,
          marketValue: p.value ?? null,
          unrealizedPnl: p.unrealised ?? null,
          dayChange: p.day_change ?? null,
          dayChangePercent: p.day_change_percentage ?? null,
          confidence: scoreConfidence({ exchange: p.exchange }),
          raw: p as unknown as Record<string, unknown>,
        });
      }
    }

    const snapshot = makeSnapshot(PROVIDER, REGION, holdings, positions, sourcePayloads, warnings);
    return makeNormalizationResult(PROVIDER, REGION, VERSION, snapshot, warnings);
  },
};

// ─── OAuth URL helper (called from API route before auth) ─────────────────────

export function getZerodhaLoginUrl(apiKey: string, redirectUri: string): string {
  const params = new URLSearchParams({ v: "3", api_key: apiKey });
  if (redirectUri) params.set("redirect_params", encodeURIComponent(`redirect_uri=${redirectUri}`));
  return `https://kite.zerodha.com/connect/login?${params.toString()}`;
}
