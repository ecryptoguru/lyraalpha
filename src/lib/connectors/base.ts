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
import { encrypt, decrypt, sanitizeString, isSafeString } from "@/lib/crypto";
import { validateApiKey, validateSecretKey } from "@/lib/validation";
import { RETRY_CONFIG, CACHE_CONFIG, PAGINATION_CONFIG } from "@/lib/config";

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
  { maxAttempts = RETRY_CONFIG.MAX_ATTEMPTS, baseDelayMs = RETRY_CONFIG.BASE_DELAY_MS }: { maxAttempts?: number; baseDelayMs?: number } = {},
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
          setTimeout(r, baseDelayMs * Math.pow(2, attempt) + Math.random() * RETRY_CONFIG.JITTER_MS),
        );
      }
    }
  }
  throw lastErr;
}

// ─── Credential validation helpers ───────────────────────────────────────────

export function validateCredentials(credentials: Record<string, string>, requiredKeys: string[], provider?: BrokerProvider): void {
  for (const key of requiredKeys) {
    if (!credentials[key]) {
      throw new BrokerConnectorError(
        `${key} is required for authentication`,
        "auth_failed",
        provider || ("unknown" as BrokerProvider),
        false,
      );
    }
  }
}

export function sanitizeAndValidateCredential(value: string, type: "apiKey" | "secretKey", provider?: BrokerProvider): string {
  const sanitized = sanitizeString(value);

  if (!sanitized) {
    throw new BrokerConnectorError(
      `${type} cannot be empty`,
      "auth_failed",
      provider || ("unknown" as BrokerProvider),
      false,
    );
  }

  if (!isSafeString(sanitized)) {
    throw new BrokerConnectorError(
      `${type} contains invalid characters`,
      "auth_failed",
      provider || ("unknown" as BrokerProvider),
      false,
    );
  }

  if (type === "apiKey") {
    return validateApiKey(sanitized);
  } else {
    return validateSecretKey(sanitized);
  }
}

// ─── Encryption helpers for sensitive auth metadata ─────────────────────────────

const ENCRYPTION_KEY = process.env.CONNECTOR_ENCRYPTION_KEY;

function getEncryptionKey(): string {
  if (!ENCRYPTION_KEY) {
    throw new BrokerConnectorError(
      "CONNECTOR_ENCRYPTION_KEY environment variable is required for secure secret storage. " +
      "Set it to a strong 32+ character random string in your environment.",
      "validation_failed",
      "unknown" as BrokerProvider,
      false,
    );
  }
  return ENCRYPTION_KEY;
}

export async function encryptSecret(value: string): Promise<string> {
  try {
    return await encrypt(value, getEncryptionKey());
  } catch (error) {
    throw new BrokerConnectorError(
      `Failed to encrypt secret: ${error instanceof Error ? error.message : String(error)}`,
      "validation_failed",
      "unknown" as BrokerProvider,
      false,
    );
  }
}

export async function decryptSecret(encrypted: string): Promise<string> {
  try {
    return await decrypt(encrypted, getEncryptionKey());
  } catch (error) {
    throw new BrokerConnectorError(
      `Failed to decrypt secret: ${error instanceof Error ? error.message : String(error)}`,
      "validation_failed",
      "unknown" as BrokerProvider,
      false,
    );
  }
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
  if (!raw) return "CRYPTO";
  return map[raw.toUpperCase()] ?? map[raw] ?? "CRYPTO";
}

export function makeInstrumentIdentity(fields: {
  symbol: string;
  name: string;
  chain?: string | null;
  contractAddress?: string | null;
  tokenStandard?: "ERC20" | "ERC721" | "ERC1155" | "SPL" | "BEP20" | null;
  exchange?: string | null;
  assetClass?: BrokerAssetClass;
  region: BrokerRegion;
  sector?: string | null;
}): BrokerInstrumentIdentity {
  return {
    symbol: fields.symbol.trim().toUpperCase(),
    name: fields.name.trim(),
    chain: fields.chain?.trim() ?? null,
    contractAddress: fields.contractAddress?.trim() ?? null,
    tokenStandard: fields.tokenStandard ?? null,
    exchange: fields.exchange?.trim().toUpperCase() ?? null,
    currency: fields.region === "IN" ? "INR" : "USD",
    assetClass: fields.assetClass ?? "CRYPTO",
    region: fields.region,
    sector: fields.sector ?? null,
  };
}

// ─── Holding confidence scorer ────────────────────────────────────────────────

export function scoreConfidence(h: {
  contractAddress?: string | null;
  exchange?: string | null;
  marketPrice?: number | null;
  costBasis?: number | null;
  unrealizedPnl?: number | null;
  sector?: string | null;
}): number {
  let score = 0.5;
  if (h.contractAddress) score += 0.15;
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
      signal: options.signal || AbortSignal.timeout(30000), // 30 second default timeout
    });
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      throw new BrokerConnectorError(
        "Request timed out after 30 seconds",
        "upstream_error",
        options.provider,
        true,
      );
    }
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

// ─── Simple in-memory cache for connectors ─────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class ConnectorCache {
  private cache = new Map<string, CacheEntry<unknown>>();

  set<T>(key: string, data: T, ttlMs: number): void {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttlMs,
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  clear(): void {
    this.cache.clear();
  }

  clearPattern(pattern: string): void {
    const escapedPattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedPattern);
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }
}

export const connectorCache = new ConnectorCache();

// ─── Cached fetch helper ─────────────────────────────────────────────────────

export async function cachedFetch<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttlMs: number = CACHE_CONFIG.DEFAULT_TTL_MS,
): Promise<T> {
  const cached = connectorCache.get<T>(key);
  if (cached !== null) {
    return cached;
  }

  const data = await fetchFn();
  connectorCache.set(key, data, ttlMs);
  return data;
}

// ─── Pagination helper ─────────────────────────────────────────────────────────

export interface PaginatedResult<T> {
  data: T[];
  hasMore: boolean;
  nextPage?: string | number;
  totalCount?: number;
}

export async function fetchPaginated<T>(
  fetchFn: (page: number, pageSize: number) => Promise<PaginatedResult<T>>,
  maxTotalItems: number = PAGINATION_CONFIG.MAX_TOTAL_ITEMS,
  pageSize: number = PAGINATION_CONFIG.DEFAULT_PAGE_SIZE,
): Promise<T[]> {
  const allData: T[] = [];
  let page = 1;
  let hasMore = true;
  let totalFetched = 0;

  while (hasMore && totalFetched < maxTotalItems) {
    const result = await fetchFn(page, pageSize);
    allData.push(...result.data);
    totalFetched += result.data.length;

    hasMore = result.hasMore;
    page = typeof result.nextPage === "number" ? result.nextPage : page + 1;
  }

  return allData;
}
