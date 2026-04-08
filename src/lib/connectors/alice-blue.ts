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

const BASE = "https://ant.aliceblueonline.com/rest/AliceBlueAPIService/api";
const VERSION = "1.0.0";
const PROVIDER = "alice_blue" as const;
const REGION = "IN" as const;

// ─── Raw response shapes (Alice Blue ANT+ API docs) ───────────────────────────

interface AliceHolding {
  Symbol: string;
  ExchSeg: string;
  ISIN: string;
  HoldingQty: number;
  T1HoldingQty: number;
  AvgPrice: number;
  LTP: number;
  PnL: number;
  CurVal: number;
  ProductCode: string;
}

interface AlicePosition {
  Symbol: string;
  ExchSeg: string;
  Netqty: number;
  NetBuyAmt: number;
  NetSellAmt: number;
  AvgNetPrice: number;
  LTP: number;
  MTOM: number;
  ProductCode: string;
}

interface AliceAuthResponse {
  encKey: string;
  stat: string;
}

interface AliceSessionResponse {
  sessionID: string;
  stat: string;
  emsg?: string;
}

interface AliceHoldingsResponse {
  stat: string;
  HoldingVal: AliceHolding[] | null;
  emsg?: string;
}

interface AlicePositionsResponse {
  stat: string;
  NetPositions: AlicePosition[] | null;
  emsg?: string;
}

// ─── Connector ────────────────────────────────────────────────────────────────

export const AliceBlueConnector: BrokerConnector = {
  provider: PROVIDER,
  region: REGION,
  version: VERSION,
  supportedScopes: ["holdings", "positions"],

  async authenticate(credentials: BrokerCredentials): Promise<BrokerAuthHandle> {
    const { user_id, api_key } = credentials;

    if (!user_id || !api_key) {
      throw new BrokerConnectorError(
        "Alice Blue requires user_id and api_key from the ANT+ developer portal",
        "auth_failed",
        PROVIDER,
      );
    }

    // Step 1: Get encryption key
    let res: Response;
    try {
      res = await fetch(`${BASE}/customer/getAPIEncpkey`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user_id }),
      });
    } catch (err) {
      throw new BrokerConnectorError(`Network error: ${String(err)}`, "upstream_error", PROVIDER, true);
    }

    if (!res.ok) {
      throw new BrokerConnectorError(`Alice Blue enc key fetch failed: HTTP ${res.status}`, "auth_failed", PROVIDER);
    }

    const encData = await res.json() as AliceAuthResponse;
    if (encData.stat !== "Ok" || !encData.encKey) {
      throw new BrokerConnectorError("Alice Blue: failed to get encryption key", "auth_failed", PROVIDER);
    }

    // Step 2: Create session with SHA-256(userId + apiKey + encKey)
    const { createHash } = await import("crypto");
    const checksum = createHash("sha256")
      .update(`${user_id}${api_key}${encData.encKey}`)
      .digest("hex");

    let res2: Response;
    try {
      res2 = await fetch(`${BASE}/customer/createSession`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user_id, userData: checksum }),
      });
    } catch (err) {
      throw new BrokerConnectorError(`Network error: ${String(err)}`, "upstream_error", PROVIDER, true);
    }

    if (!res2.ok) {
      throw new BrokerConnectorError(`Alice Blue session failed: HTTP ${res2.status}`, "auth_failed", PROVIDER);
    }

    const sessionData = await res2.json() as AliceSessionResponse;
    if (sessionData.stat !== "Ok" || !sessionData.sessionID) {
      throw new BrokerConnectorError(
        `Alice Blue session rejected: ${sessionData.emsg ?? "unknown"}`,
        "auth_failed",
        PROVIDER,
      );
    }

    return {
      provider: PROVIDER,
      accessToken: sessionData.sessionID,
      refreshToken: null,
      expiresAt: null,
      meta: { user_id },
    };
  },

  async fetchAndNormalize(
    auth: BrokerAuthHandle,
    scope?: BrokerSyncScope[],
  ): Promise<BrokerNormalizationResult> {
    const userId = (auth.meta?.user_id as string) ?? "unknown";
    const headers = {
      "Authorization": `Bearer ${userId} ${auth.accessToken}`,
      "Content-Type": "application/json",
    };
    const warnings: string[] = [];
    const sourcePayloads: Record<string, unknown>[] = [];
    const source = makeSourceRef(PROVIDER, REGION, userId);

    // Holdings
    const holdings: BrokerHolding[] = [];
    if (scopeEnabled(scope, "holdings")) {
      const raw = await withRetry(() =>
        brokerFetch<AliceHoldingsResponse>(`${BASE}/HoldingV2/holdings`, {
          method: "GET",
          headers,
          provider: PROVIDER,
        }),
      );
      sourcePayloads.push({ endpoint: "holdings", data: raw });

      for (const h of raw.HoldingVal ?? []) {
        const qty = (h.HoldingQty ?? 0) + (h.T1HoldingQty ?? 0);
        if (qty <= 0) {
          warnings.push(`Alice Blue: zero quantity for ${h.Symbol}, skipping`);
          continue;
        }
        const instrument = makeInstrumentIdentity({
          symbol: h.Symbol,
          name: h.Symbol,
          isin: h.ISIN,
          exchange: h.ExchSeg,
          region: REGION,
        });
        const marketPrice = h.LTP ?? null;
        const costBasis = qty * h.AvgPrice;
        const unrealizedPnl = h.PnL ?? null;
        holdings.push({
          source,
          instrument,
          quantity: qty,
          averagePrice: h.AvgPrice,
          marketPrice,
          marketValue: h.CurVal ?? null,
          costBasis,
          unrealizedPnl,
          unrealizedPnlPercent:
            costBasis > 0 && unrealizedPnl != null ? (unrealizedPnl / costBasis) * 100 : null,
          confidence: scoreConfidence({ isin: h.ISIN, exchange: h.ExchSeg, marketPrice, costBasis, unrealizedPnl }),
          raw: h as unknown as Record<string, unknown>,
        });
      }
    }

    // Positions
    const positions: BrokerPosition[] = [];
    if (scopeEnabled(scope, "positions")) {
      const raw = await withRetry(() =>
        brokerFetch<AlicePositionsResponse>(`${BASE}/positionAndHoldings/positionBook`, {
          method: "POST",
          headers,
          body: JSON.stringify({ ret: "NET" }),
          provider: PROVIDER,
        }),
      );
      sourcePayloads.push({ endpoint: "positions", data: raw });

      for (const p of raw.NetPositions ?? []) {
        if (!p.Netqty) continue;
        const instrument = makeInstrumentIdentity({
          symbol: p.Symbol,
          name: p.Symbol,
          exchange: p.ExchSeg,
          region: REGION,
        });
        positions.push({
          source,
          instrument,
          side: p.Netqty > 0 ? "long" : p.Netqty < 0 ? "short" : "flat",
          quantity: Math.abs(p.Netqty),
          averagePrice: p.AvgNetPrice,
          marketPrice: p.LTP ?? null,
          unrealizedPnl: p.MTOM ?? null,
          confidence: scoreConfidence({ exchange: p.ExchSeg }),
          raw: p as unknown as Record<string, unknown>,
        });
      }
    }

    const snapshot = makeSnapshot(PROVIDER, REGION, holdings, positions, sourcePayloads, warnings);
    return makeNormalizationResult(PROVIDER, REGION, VERSION, snapshot, warnings);
  },
};
