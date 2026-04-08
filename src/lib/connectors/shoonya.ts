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

// Shoonya (Finvasia) NorenAPI endpoint
const BASE = "https://api.shoonya.com/NorenWClientTP";
const VERSION = "1.0.0";
const PROVIDER = "shoonya" as const;
const REGION = "IN" as const;

// ─── Raw response shapes (NorenAPI docs + community) ─────────────────────────

interface ShoonyaHolding {
  exch: string;
  tsym: string;       // trading symbol
  isin: string;
  holdqty: string;
  npoadqty: string;   // non-poa delivery qty
  dp_qty: string;
  avgprc: string;
  upldprc: string;
  mktprc: string;     // market price (LTP)
  s_prdt_ali: string;
}

interface ShoonyaPosition {
  exch: string;
  tsym: string;
  uid: string;
  actid: string;
  prd: string;
  netqty: string;
  netavgprc: string;
  lp: string;
  rpnl: string;
  urmtom: string;
  dname?: string;
}

interface ShoonyaAuthResponse {
  stat: "Ok" | string;
  susertoken: string;
  uid: string;
  actid: string;
  uname: string;
  emsg?: string;
}

interface ShoonyaHoldingsResponse {
  stat: "Ok" | string;
  emsg?: string;
  // NorenAPI returns a flat array or error object
  [key: string]: unknown;
}

// ─── Shoonya password hash: SHA-256(password + TOTP) ─────────────────────────

function shoonyaPasswordHash(password: string, totp: string): string {
  return crypto.createHash("sha256").update(password + totp).digest("hex");
}

// ─── Connector ────────────────────────────────────────────────────────────────

export const ShoonyaConnector: BrokerConnector = {
  provider: PROVIDER,
  region: REGION,
  version: VERSION,
  supportedScopes: ["holdings", "positions"],

  async authenticate(credentials: BrokerCredentials): Promise<BrokerAuthHandle> {
    const { user_id, password, totp, vendor_code, api_secret, imei } = credentials;

    if (!user_id || !password || !totp || !vendor_code || !api_secret) {
      throw new BrokerConnectorError(
        "Shoonya requires user_id, password, totp, vendor_code, api_secret",
        "auth_failed",
        PROVIDER,
      );
    }

    const pwd = shoonyaPasswordHash(password, totp);
    // appkey = SHA-256(user_id + "|" + api_secret)
    const appkey = crypto.createHash("sha256").update(`${user_id}|${api_secret}`).digest("hex");

    const jData = JSON.stringify({
      apkversion: "1.0.0",
      uid: user_id,
      pwd,
      factor2: totp,
      vc: vendor_code,
      appkey,
      imei: imei ?? "abc1234",
      source: "API",
    });

    let res: Response;
    try {
      res = await fetch(`${BASE}/QuickAuth`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `jData=${encodeURIComponent(jData)}`,
      });
    } catch (err) {
      throw new BrokerConnectorError(`Network error: ${String(err)}`, "upstream_error", PROVIDER, true);
    }

    if (!res.ok) {
      throw new BrokerConnectorError(`Shoonya auth failed: HTTP ${res.status}`, "auth_failed", PROVIDER);
    }

    const data = await res.json() as ShoonyaAuthResponse;
    if (data.stat !== "Ok" || !data.susertoken) {
      throw new BrokerConnectorError(
        `Shoonya auth rejected: ${data.emsg ?? "unknown"}`,
        "auth_failed",
        PROVIDER,
      );
    }

    return {
      provider: PROVIDER,
      accessToken: data.susertoken,
      refreshToken: null,
      expiresAt: null,
      meta: { uid: data.uid, actid: data.actid },
    };
  },

  async fetchAndNormalize(
    auth: BrokerAuthHandle,
    scope?: BrokerSyncScope[],
  ): Promise<BrokerNormalizationResult> {
    const uid = (auth.meta?.uid as string) ?? "unknown";
    const actid = (auth.meta?.actid as string) ?? uid;

    const post = async <T>(endpoint: string, jData: Record<string, string>): Promise<T> => {
      const payload = `jData=${encodeURIComponent(JSON.stringify({ ...jData, uid, actid }))}` +
        `&jKey=${auth.accessToken}`;
      return brokerFetch<T>(`${BASE}/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: payload,
        provider: PROVIDER,
      });
    };

    const warnings: string[] = [];
    const sourcePayloads: Record<string, unknown>[] = [];
    const source = makeSourceRef(PROVIDER, REGION, uid);

    // Holdings
    const holdings: BrokerHolding[] = [];
    if (scopeEnabled(scope, "holdings")) {
      const raw = await withRetry(() => post<ShoonyaHoldingsResponse>("Holdings", {}));
      sourcePayloads.push({ endpoint: "Holdings", data: raw });

      const rows: ShoonyaHolding[] = Array.isArray(raw) ? (raw as ShoonyaHolding[]) : [];
      for (const h of rows) {
        const qty = parseInt(h.holdqty ?? "0", 10) + parseInt(h.npoadqty ?? "0", 10);
        if (qty <= 0) {
          warnings.push(`Shoonya: zero quantity for ${h.tsym}, skipping`);
          continue;
        }
        const instrument = makeInstrumentIdentity({
          symbol: h.tsym,
          name: h.tsym,
          isin: h.isin,
          exchange: h.exch,
          region: REGION,
        });
        const avgPrice = parseFloat(h.avgprc ?? "0");
        const marketPrice = parseFloat(h.mktprc ?? "0") || null;
        const costBasis = qty * avgPrice;
        const unrealizedPnl =
          marketPrice != null ? qty * marketPrice - costBasis : null;
        holdings.push({
          source,
          instrument,
          quantity: qty,
          averagePrice: avgPrice,
          marketPrice,
          marketValue: marketPrice != null ? qty * marketPrice : null,
          costBasis,
          unrealizedPnl,
          unrealizedPnlPercent:
            costBasis > 0 && unrealizedPnl != null ? (unrealizedPnl / costBasis) * 100 : null,
          confidence: scoreConfidence({ isin: h.isin, exchange: h.exch, marketPrice, costBasis, unrealizedPnl }),
          raw: h as unknown as Record<string, unknown>,
        });
      }
    }

    // Positions
    const positions: BrokerPosition[] = [];
    if (scopeEnabled(scope, "positions")) {
      const raw = await withRetry(() =>
        post<ShoonyaHoldingsResponse>("PositionBook", { actid }),
      );
      sourcePayloads.push({ endpoint: "PositionBook", data: raw });

      const rows: ShoonyaPosition[] = Array.isArray(raw) ? (raw as ShoonyaPosition[]) : [];
      for (const p of rows) {
        const qty = parseInt(p.netqty ?? "0", 10);
        if (!qty) continue;
        const instrument = makeInstrumentIdentity({
          symbol: p.tsym,
          name: p.dname ?? p.tsym,
          exchange: p.exch,
          region: REGION,
        });
        const lp = parseFloat(p.lp ?? "0") || null;
        const urmtom = parseFloat(p.urmtom ?? "0") || null;
        positions.push({
          source,
          instrument,
          side: qty > 0 ? "long" : qty < 0 ? "short" : "flat",
          quantity: Math.abs(qty),
          averagePrice: parseFloat(p.netavgprc ?? "0"),
          marketPrice: lp,
          unrealizedPnl: urmtom,
          confidence: scoreConfidence({ exchange: p.exch, marketPrice: lp }),
          raw: p as unknown as Record<string, unknown>,
        });
      }
    }

    const snapshot = makeSnapshot(PROVIDER, REGION, holdings, positions, sourcePayloads, warnings);
    return makeNormalizationResult(PROVIDER, REGION, VERSION, snapshot, warnings);
  },
};
