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

const BASE = "https://api.upstox.com/v2";
const VERSION = "1.0.0";
const PROVIDER = "upstox" as const;
const REGION = "IN" as const;

// ─── Raw response shapes (from official Upstox v2 docs) ──────────────────────

interface UpstoxHolding {
  isin: string;
  trading_symbol: string;
  tradingsymbol?: string;
  company_name: string;
  exchange: string;
  quantity: number;
  t1_quantity: number;
  average_price: number;
  last_price: number;
  close_price: number;
  pnl: number;
  day_change: number;
  day_change_percentage: number;
  instrument_token: string;
}

interface UpstoxPosition {
  instrument_token: string;
  trading_symbol: string;
  exchange: string;
  product: string;
  quantity: number;
  overnight_quantity: number;
  buy_price: number;
  sell_price: number;
  buy_quantity: number;
  sell_quantity: number;
  average_price: number;
  last_price: number;
  close_price: number;
  pnl: number;
  day_change: number;
  day_change_percentage: number;
  value: number;
  multiplier: number;
}

interface UpstoxHoldingsResponse {
  status: string;
  data: UpstoxHolding[];
}

interface UpstoxPositionsResponse {
  status: string;
  data: UpstoxPosition[];
}

interface UpstoxTokenResponse {
  access_token: string;
  extended_token?: string;
  user_name?: string;
  user_type?: string;
  email?: string;
  user_id?: string;
}

// ─── Connector ────────────────────────────────────────────────────────────────

export const UpstoxConnector: BrokerConnector = {
  provider: PROVIDER,
  region: REGION,
  version: VERSION,
  supportedScopes: ["holdings", "positions", "balances"],

  async authenticate(credentials: BrokerCredentials): Promise<BrokerAuthHandle> {
    const { code, client_id, client_secret, redirect_uri } = credentials;

    if (!code || !client_id || !client_secret || !redirect_uri) {
      throw new BrokerConnectorError(
        "Upstox requires code, client_id, client_secret, redirect_uri",
        "auth_failed",
        PROVIDER,
      );
    }

    const body = new URLSearchParams({
      code,
      client_id,
      client_secret,
      redirect_uri,
      grant_type: "authorization_code",
    });

    let res: Response;
    try {
      res = await fetch(`${BASE}/login/authorization/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
        body: body.toString(),
      });
    } catch (err) {
      throw new BrokerConnectorError(`Network error: ${String(err)}`, "upstream_error", PROVIDER, true);
    }

    if (!res.ok) {
      throw new BrokerConnectorError(`Upstox auth failed: HTTP ${res.status}`, "auth_failed", PROVIDER);
    }

    const data = await res.json() as UpstoxTokenResponse;
    if (!data.access_token) {
      throw new BrokerConnectorError("No access_token in Upstox response", "auth_failed", PROVIDER);
    }

    // Upstox access tokens have a 1-day TTL; no refresh token issued
    const expiresAt = new Date(Date.now() + 86_400_000).toISOString();

    return {
      provider: PROVIDER,
      accessToken: data.access_token,
      refreshToken: null,
      expiresAt,
      meta: { user_id: data.user_id ?? "unknown", client_id },
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

    // Holdings
    const holdings: BrokerHolding[] = [];
    if (scopeEnabled(scope, "holdings")) {
      const raw = await withRetry(() =>
        brokerFetch<UpstoxHoldingsResponse>(`${BASE}/portfolio/long-term-holdings`, {
          headers,
          provider: PROVIDER,
        }),
      );
      sourcePayloads.push({ endpoint: "long-term-holdings", data: raw });

      for (const h of raw.data ?? []) {
        const symbol = h.trading_symbol ?? h.tradingsymbol ?? "";
        const qty = (h.quantity ?? 0) + (h.t1_quantity ?? 0);
        if (qty <= 0 || !symbol) {
          warnings.push(`Upstox: zero quantity or missing symbol for ${symbol || h.isin}, skipping`);
          continue;
        }
        const instrument = makeInstrumentIdentity({
          symbol,
          name: h.company_name ?? symbol,
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

    // Positions
    const positions: BrokerPosition[] = [];
    if (scopeEnabled(scope, "positions")) {
      const raw = await withRetry(() =>
        brokerFetch<UpstoxPositionsResponse>(`${BASE}/portfolio/short-term-positions`, {
          headers,
          provider: PROVIDER,
        }),
      );
      sourcePayloads.push({ endpoint: "short-term-positions", data: raw });

      for (const p of raw.data ?? []) {
        if (!p.quantity) continue;
        const instrument = makeInstrumentIdentity({
          symbol: p.trading_symbol,
          name: p.trading_symbol,
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
          unrealizedPnl: p.pnl ?? null,
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

// ─── OAuth URL helper ─────────────────────────────────────────────────────────

export function getUpstoxAuthUrl(clientId: string, redirectUri: string, state?: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
  });
  if (state) params.set("state", state);
  return `https://api.upstox.com/v2/login/authorization/dialog?${params.toString()}`;
}
