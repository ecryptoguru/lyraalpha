import type {
  BrokerProvider,
  BrokerRegion,
  BrokerAssetClass,
  BrokerHolding,
  BrokerPosition,
  BrokerInstrumentIdentity,
  BrokerSourceReference,
  BrokerPortfolioSnapshot,
  BrokerNormalizationResult,
  BrokerSyncScope,
} from "@/lib/types/broker";

// ─── Connector error ─────────────────────────────────────────────────────────

export class BrokerConnectorError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "auth_required"
      | "auth_failed"
      | "rate_limited"
      | "not_found"
      | "upstream_error"
      | "validation_failed"
      | "unsupported_scope",
    public readonly provider: BrokerProvider,
    public readonly retryable: boolean = false,
  ) {
    super(message);
    this.name = "BrokerConnectorError";
  }
}

// ─── Retry helper ─────────────────────────────────────────────────────────────

export async function withRetry<T>(
  fn: () => Promise<T>,
  { maxAttempts = 3, baseDelayMs = 400 }: { maxAttempts?: number; baseDelayMs?: number } = {},
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (err instanceof BrokerConnectorError && !err.retryable) throw err;
      if (attempt < maxAttempts - 1) {
        await new Promise((r) =>
          setTimeout(r, baseDelayMs * Math.pow(2, attempt) + Math.random() * 100),
        );
      }
    }
  }
  throw lastErr;
}

// ─── Source reference factory ─────────────────────────────────────────────────

export function makeSourceRef(
  provider: BrokerProvider,
  region: BrokerRegion,
  accountId: string,
  extra?: Partial<BrokerSourceReference>,
): BrokerSourceReference {
  return {
    provider,
    region,
    accountId,
    accessModel: "public_api",
    fetchedAt: new Date().toISOString(),
    ...extra,
  };
}

// ─── Instrument identity helpers ──────────────────────────────────────────────

export function resolveAssetClass(
  raw: string | null | undefined,
  map: Record<string, BrokerAssetClass>,
): BrokerAssetClass {
  if (!raw) return "STOCK";
  return map[raw.toUpperCase()] ?? map[raw] ?? "STOCK";
}

export function makeInstrumentIdentity(fields: {
  symbol: string;
  name: string;
  isin?: string | null;
  exchange?: string | null;
  assetClass?: BrokerAssetClass;
  region: BrokerRegion;
  sector?: string | null;
}): BrokerInstrumentIdentity {
  return {
    symbol: fields.symbol.trim().toUpperCase(),
    name: fields.name.trim(),
    isin: fields.isin?.trim().toUpperCase() ?? null,
    exchange: fields.exchange?.trim().toUpperCase() ?? null,
    currency: fields.region === "IN" ? "INR" : "USD",
    assetClass: fields.assetClass ?? "STOCK",
    region: fields.region,
    sector: fields.sector ?? null,
  };
}

// ─── Holding confidence scorer ────────────────────────────────────────────────

export function scoreConfidence(h: {
  isin?: string | null;
  exchange?: string | null;
  marketPrice?: number | null;
  costBasis?: number | null;
  unrealizedPnl?: number | null;
  sector?: string | null;
}): number {
  let score = 0.5;
  if (h.isin) score += 0.15;
  if (h.exchange) score += 0.1;
  if (h.marketPrice != null) score += 0.1;
  if (h.costBasis != null) score += 0.1;
  if (h.unrealizedPnl != null) score += 0.05;
  return Math.min(1, score);
}

// ─── Snapshot factory ─────────────────────────────────────────────────────────

export function makeSnapshot(
  provider: BrokerProvider,
  region: BrokerRegion,
  holdings: BrokerHolding[],
  positions: BrokerPosition[],
  sourcePayloads: Record<string, unknown>[],
  warnings: string[],
): BrokerPortfolioSnapshot {
  const confidence =
    holdings.length > 0
      ? holdings.reduce((s, h) => s + h.confidence, 0) / holdings.length
      : 1;
  return {
    provider,
    region,
    capturedAt: new Date().toISOString(),
    accounts: [],
    holdings,
    positions,
    transactions: [],
    cashBalances: [],
    sourcePayloads,
    warnings,
    confidence,
  };
}

// ─── Normalization result factory ─────────────────────────────────────────────

export function makeNormalizationResult(
  provider: BrokerProvider,
  region: BrokerRegion,
  version: string,
  snapshot: BrokerPortfolioSnapshot,
  warnings: string[],
): BrokerNormalizationResult {
  return {
    snapshot,
    provider,
    region,
    connectorVersion: version,
    normalizedAt: new Date().toISOString(),
    sourceCount: 1,
    accountCount: snapshot.accounts.length,
    holdingCount: snapshot.holdings.length,
    positionCount: snapshot.positions.length,
    transactionCount: snapshot.transactions.length,
    warnings: [...new Set([...warnings, ...snapshot.warnings])],
  };
}

// ─── HTTP helper (server-side only) ──────────────────────────────────────────

export async function brokerFetch<T>(
  url: string,
  options: RequestInit & { provider: BrokerProvider },
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...options,
      headers: { "Content-Type": "application/json", ...options.headers },
    });
  } catch (err) {
    throw new BrokerConnectorError(
      `Network error: ${err instanceof Error ? err.message : String(err)}`,
      "upstream_error",
      options.provider,
      true,
    );
  }

  if (res.status === 401 || res.status === 403) {
    throw new BrokerConnectorError("Token expired or invalid", "auth_required", options.provider, false);
  }
  if (res.status === 429) {
    throw new BrokerConnectorError("Rate limited", "rate_limited", options.provider, true);
  }
  if (!res.ok) {
    throw new BrokerConnectorError(
      `HTTP ${res.status} from ${options.provider}`,
      "upstream_error",
      options.provider,
      res.status >= 500,
    );
  }

  return res.json() as Promise<T>;
}

// ─── Scope filter ─────────────────────────────────────────────────────────────

export function scopeEnabled(requested: BrokerSyncScope[] | undefined, scope: BrokerSyncScope): boolean {
  if (!requested || requested.length === 0) return true;
  return requested.includes(scope);
}
