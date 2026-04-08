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

const BASE = "https://Openapi.5paisa.com/VendorsAPI/Service1";
const VERSION = "1.0.0";
const PROVIDER = "five_paisa" as const;
const REGION = "IN" as const;

// ─── Raw response shapes (5paisa OpenAPI docs) ────────────────────────────────

interface FivePaisaHolding {
  Exchange: string;
  ExchangeType: string;
  ScripCode: number;
  ScripData: string;
  ISIN: string;
  Qty: number;
  AvgRate: number;
  LTP: number;
  BseCode: number;
  NseCode: string;
  Pl: number;
  CurVal: number;
  PurchasePrice: number;
}

interface FivePaisaPosition {
  Exch: string;
  ExchType: string;
  ScripCode: number;
  ScripData: string;
  BuyQty: number;
  SellQty: number;
  NetQty: number;
  AvgRate: number;
  LTP: number;
  MTOM: number;
}

interface FivePaisaAuthResponse {
  body: {
    JWTToken: string;
    UserId: string;
    Email: string;
    ClientPublicIp: string;
  };
  status: string;
  resCode: number;
}

interface FivePaisaHoldingsResponse {
  body: {
    Data: FivePaisaHolding[];
  };
  status: string;
  resCode: number;
}

interface FivePaisaPositionsResponse {
  body: {
    NetPositionDetail: FivePaisaPosition[];
  };
  status: string;
  resCode: number;
}

// ─── Connector ────────────────────────────────────────────────────────────────

export const FivePaisaConnector: BrokerConnector = {
  provider: PROVIDER,
  region: REGION,
  version: VERSION,
  supportedScopes: ["holdings", "positions"],

  async authenticate(credentials: BrokerCredentials): Promise<BrokerAuthHandle> {
    const { app_name, app_source, user_id, password, user_key, encryption_key } = credentials;

    if (!app_name || !user_id || !password || !user_key || !encryption_key) {
      throw new BrokerConnectorError(
        "5paisa requires app_name, app_source, user_id, password, user_key, encryption_key",
        "auth_failed",
        PROVIDER,
      );
    }

    let res: Response;
    try {
      res = await fetch(`${BASE}/V10/LoginRequestMobileNewbyEmail`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          head: { appName: app_name, appVer: "1.0", key: user_key, osName: "Web", requestCode: "5PLoginV4" },
          body: {
            Email_id: user_id,
            Password: password,
            LocalIP: "127.0.0.1",
            PublicIP: "127.0.0.1",
            HDSerialNumber: "",
            MACAddress: "",
            MachineID: "WEB",
            VersionNo: "1.4",
            RequestNo: "1",
            My2PINOTP: app_source ?? "",
            EncryKey: encryption_key,
          },
        }),
      });
    } catch (err) {
      throw new BrokerConnectorError(`Network error: ${String(err)}`, "upstream_error", PROVIDER, true);
    }

    if (!res.ok) {
      throw new BrokerConnectorError(`5paisa auth failed: HTTP ${res.status}`, "auth_failed", PROVIDER);
    }

    const data = await res.json() as FivePaisaAuthResponse;
    if (!data.body?.JWTToken) {
      throw new BrokerConnectorError("5paisa: no JWT token in response", "auth_failed", PROVIDER);
    }

    return {
      provider: PROVIDER,
      accessToken: data.body.JWTToken,
      refreshToken: null,
      expiresAt: null,
      meta: { user_id: data.body.UserId, app_name, user_key },
    };
  },

  async fetchAndNormalize(
    auth: BrokerAuthHandle,
    scope?: BrokerSyncScope[],
  ): Promise<BrokerNormalizationResult> {
    const headers = {
      "Authorization": `bearer ${auth.accessToken}`,
      "Content-Type": "application/json",
    };
    const warnings: string[] = [];
    const sourcePayloads: Record<string, unknown>[] = [];
    const source = makeSourceRef(PROVIDER, REGION, (auth.meta?.user_id as string) ?? "unknown");
    const clientCode = (auth.meta?.user_id as string) ?? "";

    // Holdings
    const holdings: BrokerHolding[] = [];
    if (scopeEnabled(scope, "holdings")) {
      const raw = await withRetry(() =>
        brokerFetch<FivePaisaHoldingsResponse>(`${BASE}/V4/Holding`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            head: { key: auth.meta?.user_key },
            body: { ClientCode: clientCode },
          }),
          provider: PROVIDER,
        }),
      );
      sourcePayloads.push({ endpoint: "holdings", data: raw });

      for (const h of raw.body?.Data ?? []) {
        if ((h.Qty ?? 0) <= 0) {
          warnings.push(`5paisa: zero quantity for ${h.ScripData}, skipping`);
          continue;
        }
        const instrument = makeInstrumentIdentity({
          symbol: h.NseCode || h.ScripData,
          name: h.ScripData,
          isin: h.ISIN,
          exchange: h.Exchange,
          region: REGION,
        });
        const marketPrice = h.LTP ?? null;
        const costBasis = h.Qty * h.AvgRate;
        const unrealizedPnl = h.Pl ?? null;
        holdings.push({
          source,
          instrument,
          quantity: h.Qty,
          averagePrice: h.AvgRate,
          marketPrice,
          marketValue: h.CurVal ?? null,
          costBasis,
          unrealizedPnl,
          unrealizedPnlPercent:
            costBasis > 0 && unrealizedPnl != null ? (unrealizedPnl / costBasis) * 100 : null,
          confidence: scoreConfidence({ isin: h.ISIN, exchange: h.Exchange, marketPrice, costBasis, unrealizedPnl }),
          raw: h as unknown as Record<string, unknown>,
        });
      }
    }

    // Positions
    const positions: BrokerPosition[] = [];
    if (scopeEnabled(scope, "positions")) {
      const raw = await withRetry(() =>
        brokerFetch<FivePaisaPositionsResponse>(`${BASE}/V1/NetPosition`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            head: { key: auth.meta?.user_key },
            body: { ClientCode: clientCode },
          }),
          provider: PROVIDER,
        }),
      );
      sourcePayloads.push({ endpoint: "positions", data: raw });

      for (const p of raw.body?.NetPositionDetail ?? []) {
        const qty = p.NetQty ?? 0;
        if (!qty) continue;
        const instrument = makeInstrumentIdentity({
          symbol: p.ScripData,
          name: p.ScripData,
          exchange: p.Exch,
          region: REGION,
        });
        positions.push({
          source,
          instrument,
          side: qty > 0 ? "long" : qty < 0 ? "short" : "flat",
          quantity: Math.abs(qty),
          averagePrice: p.AvgRate,
          marketPrice: p.LTP ?? null,
          unrealizedPnl: p.MTOM ?? null,
          confidence: scoreConfidence({ exchange: p.Exch }),
          raw: p as unknown as Record<string, unknown>,
        });
      }
    }

    const snapshot = makeSnapshot(PROVIDER, REGION, holdings, positions, sourcePayloads, warnings);
    return makeNormalizationResult(PROVIDER, REGION, VERSION, snapshot, warnings);
  },
};
