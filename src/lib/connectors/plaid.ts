import type {
  BrokerConnector,
  BrokerCredentials,
  BrokerAuthHandle,
  BrokerNormalizationResult,
  BrokerSyncScope,
  BrokerHolding,
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

// Plaid base URL — use sandbox for dev, production otherwise
const BASE =
  process.env.PLAID_ENV === "sandbox"
    ? "https://sandbox.plaid.com"
    : process.env.PLAID_ENV === "development"
      ? "https://development.plaid.com"
      : "https://production.plaid.com";

const VERSION = "1.0.0";
const PROVIDER = "plaid" as const;
const REGION = "US" as const;

// ─── Asset class mapping from Plaid security type ────────────────────────────

const PLAID_ASSET_CLASS_MAP: Record<string, BrokerAssetClass> = {
  equity: "STOCK",
  etf: "ETF",
  "mutual fund": "MUTUAL_FUND",
  "mutual_fund": "MUTUAL_FUND",
  fixed_income: "BOND",
  "fixed income": "BOND",
  cash: "CASH_EQUIVALENT",
  cryptocurrency: "CRYPTO",
  derivative: "DERIVATIVE",
  other: "OTHER",
};

// ─── Raw Plaid response shapes (/investments/holdings/get) ────────────────────

interface PlaidSecurity {
  security_id: string;
  isin: string | null;
  cusip: string | null;
  sedol: string | null;
  institution_security_id: string | null;
  institution_id: string | null;
  proxy_security_id: string | null;
  name: string;
  ticker_symbol: string | null;
  is_cash_equivalent: boolean;
  type: string;
  close_price: number | null;
  close_price_as_of: string | null;
  iso_currency_code: string | null;
  unofficial_currency_code: string | null;
}

interface PlaidHolding {
  account_id: string;
  security_id: string;
  institution_price: number;
  institution_price_as_of: string | null;
  institution_value: number;
  cost_basis: number | null;
  quantity: number;
  iso_currency_code: string | null;
  unofficial_currency_code: string | null;
}

interface PlaidAccount {
  account_id: string;
  name: string;
  official_name: string | null;
  type: string;
  subtype: string | null;
  balances: {
    available: number | null;
    current: number | null;
    limit: number | null;
    iso_currency_code: string | null;
  };
}

interface PlaidHoldingsResponse {
  accounts: PlaidAccount[];
  holdings: PlaidHolding[];
  securities: PlaidSecurity[];
  item: { item_id: string; institution_id: string };
  request_id: string;
}

interface PlaidLinkTokenResponse {
  link_token: string;
  expiration: string;
  request_id: string;
}

interface PlaidTokenExchangeResponse {
  access_token: string;
  item_id: string;
  request_id: string;
}

// ─── Plaid API helper ─────────────────────────────────────────────────────────

function plaidHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID ?? "",
    "PLAID-SECRET": process.env.PLAID_SECRET ?? "",
    "Plaid-Version": "2020-09-14",
  };
}

// ─── Connector ────────────────────────────────────────────────────────────────

export const PlaidConnector: BrokerConnector = {
  provider: PROVIDER,
  region: REGION,
  version: VERSION,
  supportedScopes: ["holdings", "balances"],

  /**
   * Exchange a public_token (from Plaid Link on the client) for an access_token.
   * credentials = { public_token: string }
   */
  async authenticate(credentials: BrokerCredentials): Promise<BrokerAuthHandle> {
    const { public_token, item_id } = credentials;

    if (!public_token) {
      throw new BrokerConnectorError(
        "Plaid requires a public_token from the Plaid Link flow",
        "auth_failed",
        PROVIDER,
      );
    }

    if (!process.env.PLAID_CLIENT_ID || !process.env.PLAID_SECRET) {
      throw new BrokerConnectorError(
        "PLAID_CLIENT_ID and PLAID_SECRET env vars must be set",
        "auth_failed",
        PROVIDER,
      );
    }

    const data = await brokerFetch<PlaidTokenExchangeResponse>(
      `${BASE}/item/public_token/exchange`,
      {
        method: "POST",
        headers: plaidHeaders(),
        body: JSON.stringify({ public_token }),
        provider: PROVIDER,
      },
    );

    return {
      provider: PROVIDER,
      accessToken: data.access_token,
      refreshToken: null,
      expiresAt: null,
      meta: { item_id: item_id ?? data.item_id },
    };
  },

  async fetchAndNormalize(
    auth: BrokerAuthHandle,
    scope?: BrokerSyncScope[],
  ): Promise<BrokerNormalizationResult> {
    const warnings: string[] = [];
    const sourcePayloads: Record<string, unknown>[] = [];

    const holdings: BrokerHolding[] = [];

    if (scopeEnabled(scope, "holdings")) {
      const raw = await withRetry(() =>
        brokerFetch<PlaidHoldingsResponse>(`${BASE}/investments/holdings/get`, {
          method: "POST",
          headers: plaidHeaders(),
          body: JSON.stringify({ access_token: auth.accessToken }),
          provider: PROVIDER,
        }),
      );
      sourcePayloads.push({ endpoint: "investments/holdings/get", data: raw });

      // Build security lookup map
      const secMap = new Map<string, PlaidSecurity>(
        raw.securities.map((s) => [s.security_id, s]),
      );

      // Use first account as source ref
      const primaryAccountId = raw.accounts[0]?.account_id ?? (auth.meta?.item_id as string) ?? "plaid_item";
      const source = makeSourceRef(PROVIDER, REGION, primaryAccountId, { accessModel: "oauth" });

      for (const h of raw.holdings) {
        if ((h.quantity ?? 0) <= 0) {
          warnings.push(`Plaid: zero quantity for security ${h.security_id}, skipping`);
          continue;
        }

        const sec = secMap.get(h.security_id);
        if (!sec) {
          warnings.push(`Plaid: security ${h.security_id} not found in securities list, skipping`);
          continue;
        }

        // Skip pure cash-equivalent rows unless balances scope is requested
        if (sec.is_cash_equivalent && !scopeEnabled(scope, "balances")) continue;

        const symbol = sec.ticker_symbol ?? sec.name ?? sec.security_id;
        const assetClass = resolveAssetClass(sec.type, PLAID_ASSET_CLASS_MAP);
        const instrument = makeInstrumentIdentity({
          symbol,
          name: sec.name ?? symbol,
          isin: sec.isin,
          region: REGION,
          assetClass,
        });

        const marketPrice = h.institution_price ?? null;
        const marketValue = h.institution_value ?? (marketPrice != null ? h.quantity * marketPrice : null);
        const costBasis = h.cost_basis ?? null;
        const unrealizedPnl = costBasis != null && marketValue != null ? marketValue - costBasis : null;

        holdings.push({
          source,
          instrument,
          quantity: h.quantity,
          averagePrice: costBasis != null ? costBasis / h.quantity : (marketPrice ?? 0),
          marketPrice,
          marketValue,
          costBasis,
          unrealizedPnl,
          unrealizedPnlPercent:
            costBasis != null && costBasis > 0 && unrealizedPnl != null
              ? (unrealizedPnl / costBasis) * 100
              : null,
          confidence: scoreConfidence({ isin: sec.isin, marketPrice, costBasis, unrealizedPnl }),
          raw: { holding: h, security: sec } as Record<string, unknown>,
        });
      }
    }

    const snapshot = makeSnapshot(PROVIDER, REGION, holdings, [], sourcePayloads, warnings);
    return makeNormalizationResult(PROVIDER, REGION, VERSION, snapshot, warnings);
  },
};

// ─── Server-side helpers ──────────────────────────────────────────────────────

/**
 * Create a Plaid Link token (call from API route, never from the client).
 * Returns the link_token to pass to the frontend Plaid Link SDK.
 */
export async function createPlaidLinkToken(userId: string): Promise<string> {
  if (!process.env.PLAID_CLIENT_ID || !process.env.PLAID_SECRET) {
    throw new BrokerConnectorError(
      "PLAID_CLIENT_ID and PLAID_SECRET env vars must be set",
      "auth_failed",
      PROVIDER,
    );
  }

  const data = await brokerFetch<PlaidLinkTokenResponse>(`${BASE}/link/token/create`, {
    method: "POST",
    headers: plaidHeaders(),
    body: JSON.stringify({
      user: { client_user_id: userId },
      client_name: "InsightAlpha",
      products: ["investments"],
      country_codes: ["US"],
      language: "en",
    }),
    provider: PROVIDER,
  });

  return data.link_token;
}
