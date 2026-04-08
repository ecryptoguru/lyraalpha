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

const BASE = "https://apiconnect.angelone.in";
const VERSION = "1.0.0";
const PROVIDER = "angel_one" as const;
const REGION = "IN" as const;

// ─── Raw response shapes (SmartAPI docs + community forum) ───────────────────

interface AngelHolding {
  tradingsymbol: string;
  exchange: string;
  isin: string;
  t1quantity: number;
  realisedquantity: number;
  quantity: number;
  authorisedquantity: number;
  product: string;
  collateralquantity: number | null;
  collateraltype: string | null;
  haircut: number;
  averagenetprice: number;
  ltp: number;
  symboltoken: string;
  close: number;
  profitandloss: number;
  pnlpercentage: number;
}

interface AngelPosition {
  exchange: string;
  symboltoken: string;
  producttype: string;
  tradingsymbol: string;
  symbolname: string;
  instrumenttype: string;
  priceden: string;
  pricenum: string;
  gendenom: string;
  precision: string;
  multiplier: string;
  boardlotsize: string;
  buyqty: string;
  sellqty: string;
  buyamount: string;
  sellamount: string;
  symbolgroup: string;
  strikeprice: string;
  optiontype: string;
  expirydate: string;
  lotsize: string;
  cfbuyqty: string;
  cfselqty: string;
  cfbuyamount: string;
  cfsellamount: string;
  cfavgbuyamount: string;
  cfavgsellamount: string;
  netqty: string;
  netamount: string;
  totalbuyvalue: string;
  totalsellvalue: string;
  cfbuyavgprice: string;
  cfsellavgprice: string;
  totalbuyavgprice: string;
  totalsellavgprice: string;
  netprice: string;
  ltp: string;
  unrealised: string;
  realised: string;
  pnl: string;
  carryforwardvalue: string;
  productcode: string;
}

interface AngelAuthResponse {
  status: boolean;
  message: string;
  errorcode: string;
  data: {
    jwtToken: string;
    refreshToken: string;
    feedToken: string;
    name: string;
    clientcode: string;
  };
}

interface AngelHoldingResponse {
  status: boolean;
  message: string;
  data: AngelHolding[];
}

interface AngelPositionResponse {
  status: boolean;
  message: string;
  data: AngelPosition[];
}

// ─── Connector ────────────────────────────────────────────────────────────────

export const AngelOneConnector: BrokerConnector = {
  provider: PROVIDER,
  region: REGION,
  version: VERSION,
  supportedScopes: ["holdings", "positions"],

  async authenticate(credentials: BrokerCredentials): Promise<BrokerAuthHandle> {
    const { clientcode, password, totp, api_key } = credentials;
    if (!clientcode || !password || !totp || !api_key) {
      throw new BrokerConnectorError(
        "Angel One requires clientcode, password, totp, api_key",
        "auth_failed",
        PROVIDER,
      );
    }

    let res: Response;
    try {
      res = await fetch(`${BASE}/rest/auth/angelbroking/user/v1/loginByPassword`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "X-UserType": "USER",
          "X-SourceID": "WEB",
          "X-ClientLocalIP": "CLIENT_LOCAL_IP",
          "X-ClientPublicIP": "CLIENT_PUBLIC_IP",
          "X-MACAddress": "MAC_ADDRESS",
          "X-PrivateKey": api_key,
        },
        body: JSON.stringify({ clientcode, password, totp }),
      });
    } catch (err) {
      throw new BrokerConnectorError(`Network error: ${String(err)}`, "upstream_error", PROVIDER, true);
    }

    if (!res.ok) {
      throw new BrokerConnectorError(`Angel One auth failed: HTTP ${res.status}`, "auth_failed", PROVIDER);
    }

    const data = await res.json() as AngelAuthResponse;
    if (!data.status || !data.data?.jwtToken) {
      throw new BrokerConnectorError(
        `Angel One auth rejected: ${data.message ?? "unknown"}`,
        "auth_failed",
        PROVIDER,
      );
    }

    return {
      provider: PROVIDER,
      accessToken: data.data.jwtToken,
      refreshToken: data.data.refreshToken ?? null,
      expiresAt: null,
      meta: { api_key, clientcode: data.data.clientcode, feedToken: data.data.feedToken },
    };
  },

  async fetchAndNormalize(
    auth: BrokerAuthHandle,
    scope?: BrokerSyncScope[],
  ): Promise<BrokerNormalizationResult> {
    const headers = {
      "Authorization": `Bearer ${auth.accessToken}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
      "X-UserType": "USER",
      "X-SourceID": "WEB",
      "X-PrivateKey": (auth.meta?.api_key as string) ?? "",
    };
    const warnings: string[] = [];
    const sourcePayloads: Record<string, unknown>[] = [];
    const source = makeSourceRef(PROVIDER, REGION, (auth.meta?.clientcode as string) ?? "unknown");

    // Holdings
    const holdings: BrokerHolding[] = [];
    if (scopeEnabled(scope, "holdings")) {
      const raw = await withRetry(() =>
        brokerFetch<AngelHoldingResponse>(
          `${BASE}/rest/secure/angelbroking/portfolio/v1/getHolding`,
          { headers, provider: PROVIDER },
        ),
      );
      sourcePayloads.push({ endpoint: "getHolding", data: raw });

      for (const h of raw.data ?? []) {
        const qty = (h.quantity ?? 0) + (h.t1quantity ?? 0);
        if (qty <= 0) {
          warnings.push(`Angel One: zero quantity for ${h.tradingsymbol}, skipping`);
          continue;
        }
        const instrument = makeInstrumentIdentity({
          symbol: h.tradingsymbol,
          name: h.tradingsymbol,
          isin: h.isin,
          exchange: h.exchange,
          region: REGION,
        });
        const marketPrice = h.ltp ?? null;
        const costBasis = qty * h.averagenetprice;
        const unrealizedPnl = h.profitandloss ?? null;
        holdings.push({
          source,
          instrument,
          quantity: qty,
          averagePrice: h.averagenetprice,
          marketPrice,
          marketValue: marketPrice != null ? qty * marketPrice : null,
          costBasis,
          unrealizedPnl,
          unrealizedPnlPercent: h.pnlpercentage ?? null,
          confidence: scoreConfidence({ isin: h.isin, exchange: h.exchange, marketPrice, costBasis, unrealizedPnl }),
          raw: h as unknown as Record<string, unknown>,
        });
      }
    }

    // Positions
    const positions: BrokerPosition[] = [];
    if (scopeEnabled(scope, "positions")) {
      const raw = await withRetry(() =>
        brokerFetch<AngelPositionResponse>(
          `${BASE}/rest/secure/angelbroking/order/v1/getPosition`,
          { headers, provider: PROVIDER },
        ),
      );
      sourcePayloads.push({ endpoint: "getPosition", data: raw });

      for (const p of raw.data ?? []) {
        const qty = parseInt(p.netqty ?? "0", 10);
        if (!qty) continue;
        const instrument = makeInstrumentIdentity({
          symbol: p.tradingsymbol,
          name: p.symbolname ?? p.tradingsymbol,
          exchange: p.exchange,
          region: REGION,
        });
        const ltp = parseFloat(p.ltp ?? "0");
        positions.push({
          source,
          instrument,
          side: qty > 0 ? "long" : qty < 0 ? "short" : "flat",
          quantity: Math.abs(qty),
          averagePrice: parseFloat(p.netprice ?? "0"),
          marketPrice: ltp || null,
          unrealizedPnl: parseFloat(p.unrealised ?? "0") || null,
          confidence: scoreConfidence({ exchange: p.exchange }),
          raw: p as unknown as Record<string, unknown>,
        });
      }
    }

    const snapshot = makeSnapshot(PROVIDER, REGION, holdings, positions, sourcePayloads, warnings);
    return makeNormalizationResult(PROVIDER, REGION, VERSION, snapshot, warnings);
  },
};
