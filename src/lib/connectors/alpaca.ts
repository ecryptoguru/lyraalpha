import type {
  BrokerConnector,
  BrokerCredentials,
  BrokerAuthHandle,
  BrokerNormalizationResult,
  BrokerSyncScope,
  BrokerHolding,
  BrokerPosition,
  BrokerAssetClass,
} from "@/lib/types/broker";
import {
  BrokerConnectorError,
  brokerFetch,
  makeSourceRef,
  makeInstrumentIdentity,
  makeSnapshot,
  makeNormalizationResult,
  resolveAssetClass,
  scoreConfidence,
  scopeEnabled,
  withRetry,
} from "./base";

// Alpaca uses paper trading base for dev, live base for production
const BASE =
  process.env.ALPACA_ENV === "paper"
    ? "https://paper-api.alpaca.markets/v2"
    : "https://api.alpaca.markets/v2";

const VERSION = "1.0.0";
const PROVIDER = "alpaca" as const;
const REGION = "US" as const;

// ─── Asset class mapping ──────────────────────────────────────────────────────

const ALPACA_ASSET_CLASS_MAP: Record<string, BrokerAssetClass> = {
  us_equity: "STOCK",
  crypto: "CRYPTO",
  us_option: "DERIVATIVE",
};

// ─── Raw Alpaca response shapes (from official v2 docs) ───────────────────────

interface AlpacaPosition {
  asset_id: string;
  symbol: string;
  exchange: string;
  asset_class: string;
  asset_marginable: boolean;
  avg_entry_price: string;
  qty: string;
  qty_available: string;
  side: "long" | "short";
  market_value: string;
  cost_basis: string;
  unrealized_pl: string;
  unrealized_plpc: string;
  unrealized_intraday_pl: string;
  unrealized_intraday_plpc: string;
  current_price: string;
  lastday_price: string;
  change_today: string;
}

interface AlpacaAccount {
  id: string;
  account_number: string;
  status: string;
  currency: string;
  cash: string;
  portfolio_value: string;
  pattern_day_trader: boolean;
  trading_blocked: boolean;
  buying_power: string;
  equity: string;
  long_market_value: string;
  short_market_value: string;
  non_marginable_buying_power: string;
  accrued_fees: string;
  pending_transfer_in: string;
  pending_transfer_out: string;
}

// ─── Connector ────────────────────────────────────────────────────────────────

export const AlpacaConnector: BrokerConnector = {
  provider: PROVIDER,
  region: REGION,
  version: VERSION,
  supportedScopes: ["holdings", "positions", "balances"],

  /**
   * Alpaca uses API key + secret (OAuth2 client credentials) or OAuth tokens.
   * credentials = { api_key: string, api_secret: string }
   *   OR (OAuth flow): { access_token: string }
   */
  async authenticate(credentials: BrokerCredentials): Promise<BrokerAuthHandle> {
    const { api_key, api_secret, access_token } = credentials;

    if (access_token) {
      // OAuth bearer token path
      return {
        provider: PROVIDER,
        accessToken: access_token,
        refreshToken: null,
        expiresAt: null,
        meta: { auth_type: "oauth" },
      };
    }

    if (!api_key || !api_secret) {
      throw new BrokerConnectorError(
        "Alpaca requires api_key and api_secret (or an OAuth access_token)",
        "auth_failed",
        PROVIDER,
      );
    }

    // Validate credentials by hitting /account
    let res: Response;
    try {
      res = await fetch(`${BASE}/account`, {
        headers: {
          "APCA-API-KEY-ID": api_key,
          "APCA-API-SECRET-KEY": api_secret,
        },
      });
    } catch (err) {
      throw new BrokerConnectorError(`Network error: ${String(err)}`, "upstream_error", PROVIDER, true);
    }

    if (res.status === 401 || res.status === 403) {
      throw new BrokerConnectorError("Alpaca: invalid API key or secret", "auth_failed", PROVIDER);
    }
    if (!res.ok) {
      throw new BrokerConnectorError(`Alpaca auth check failed: HTTP ${res.status}`, "auth_failed", PROVIDER);
    }

    const account = await res.json() as AlpacaAccount;

    return {
      provider: PROVIDER,
      accessToken: api_key,           // stored as accessToken; secret kept in meta
      refreshToken: null,
      expiresAt: null,
      meta: {
        api_secret,
        account_id: account.id,
        auth_type: "apikey",
        currency: account.currency,
        portfolio_value: account.portfolio_value,
        buying_power: account.buying_power,
      },
    };
  },

  async refreshAuth(auth: BrokerAuthHandle): Promise<BrokerAuthHandle> {
    // API key auth doesn't expire; OAuth tokens are managed externally
    return auth;
  },

  async fetchAndNormalize(
    auth: BrokerAuthHandle,
    scope?: BrokerSyncScope[],
  ): Promise<BrokerNormalizationResult> {
    const isOAuth = auth.meta?.auth_type === "oauth";
    const headers: Record<string, string> = isOAuth
      ? { Authorization: `Bearer ${auth.accessToken}` }
      : {
          "APCA-API-KEY-ID": auth.accessToken,
          "APCA-API-SECRET-KEY": (auth.meta?.api_secret as string) ?? "",
        };

    const warnings: string[] = [];
    const sourcePayloads: Record<string, unknown>[] = [];
    const accountId = (auth.meta?.account_id as string) ?? "alpaca_account";
    const source = makeSourceRef(PROVIDER, REGION, accountId, { accessModel: "public_api" });

    // Fetch positions (Alpaca positions = live holdings in the account)
    const holdings: BrokerHolding[] = [];
    const positions: BrokerPosition[] = [];

    if (scopeEnabled(scope, "holdings") || scopeEnabled(scope, "positions")) {
      const rawPositions = await withRetry(() =>
        brokerFetch<AlpacaPosition[]>(`${BASE}/positions`, {
          headers,
          provider: PROVIDER,
        }),
      );
      sourcePayloads.push({ endpoint: "positions", data: rawPositions });

      for (const p of rawPositions) {
        const qty = parseFloat(p.qty ?? "0");
        if (qty <= 0) {
          warnings.push(`Alpaca: zero quantity for ${p.symbol}, skipping`);
          continue;
        }

        const assetClass = resolveAssetClass(p.asset_class, ALPACA_ASSET_CLASS_MAP);
        const instrument = makeInstrumentIdentity({
          symbol: p.symbol,
          name: p.symbol,
          exchange: p.exchange,
          assetClass,
          region: REGION,
        });

        const avgEntryPrice = parseFloat(p.avg_entry_price ?? "0");
        const currentPrice = parseFloat(p.current_price ?? "0") || null;
        const marketValue = parseFloat(p.market_value ?? "0") || null;
        const costBasis = parseFloat(p.cost_basis ?? "0") || null;
        const unrealizedPl = parseFloat(p.unrealized_pl ?? "0") || null;
        const unrealizedPlPc = parseFloat(p.unrealized_plpc ?? "0") || null; // already a decimal fraction; multiply by 100 for percentage
        const dayChange = parseFloat(p.change_today ?? "0") || null;

        const conf = scoreConfidence({
          exchange: p.exchange,
          marketPrice: currentPrice,
          costBasis,
          unrealizedPnl: unrealizedPl,
        });

        // Surface long equity as holdings, everything else as positions
        if (p.side === "long" && assetClass === "STOCK") {
          holdings.push({
            source,
            instrument,
            quantity: qty,
            averagePrice: avgEntryPrice,
            marketPrice: currentPrice,
            marketValue,
            costBasis,
            unrealizedPnl: unrealizedPl,
            unrealizedPnlPercent: unrealizedPlPc != null ? unrealizedPlPc * 100 : null,
            dayChangePercent: dayChange != null ? dayChange * 100 : null,
            confidence: conf,
            raw: p as unknown as Record<string, unknown>,
          });
        } else {
          positions.push({
            source,
            instrument,
            side: p.side === "long" ? "long" : "short",
            quantity: qty,
            averagePrice: avgEntryPrice,
            marketPrice: currentPrice,
            marketValue,
            costBasis,
            unrealizedPnl: unrealizedPl,
            unrealizedPnlPercent: unrealizedPlPc != null ? unrealizedPlPc * 100 : null, // decimal → percent
            dayChangePercent: dayChange != null ? dayChange * 100 : null, // decimal → percent
            confidence: conf,
            raw: p as unknown as Record<string, unknown>,
          });
        }
      }
    }

    const snapshot = makeSnapshot(PROVIDER, REGION, holdings, positions, sourcePayloads, warnings);
    return makeNormalizationResult(PROVIDER, REGION, VERSION, snapshot, warnings);
  },
};

// ─── OAuth URL helper ─────────────────────────────────────────────────────────

export function getAlpacaOAuthUrl(clientId: string, redirectUri: string, state?: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "account:write trading",
    state: state ?? "",
  });
  return `https://app.alpaca.markets/oauth/authorize?${params.toString()}`;
}

export async function exchangeAlpacaOAuthCode(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
): Promise<string> {
  const res = await fetch("https://api.alpaca.markets/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    }).toString(),
  });

  if (!res.ok) {
    throw new BrokerConnectorError(
      `Alpaca OAuth token exchange failed: HTTP ${res.status}`,
      "auth_failed",
      PROVIDER,
    );
  }

  const data = await res.json() as { access_token: string };
  if (!data.access_token) {
    throw new BrokerConnectorError("Alpaca: no access_token in OAuth response", "auth_failed", PROVIDER);
  }
  return data.access_token;
}
