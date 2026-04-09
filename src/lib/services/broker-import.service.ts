import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import {
  type BrokerDeduplicationResult,
  type BrokerHolding,
  type BrokerInstrumentKey,
  type BrokerMergedHolding,
  type BrokerNormalizationResult,
} from "@/lib/types/broker";

const logger = createLogger({ service: "broker-import" });

export interface BrokerImportSummary {
  portfolioId: string;
  provider: BrokerNormalizationResult["provider"];
  region: BrokerNormalizationResult["region"];
  snapshotCapturedAt: string;
  normalizedAt: string;
  sourceCount: number;
  accountCount: number;
  holdingCount: number;
  positionCount: number;
  transactionCount: number;
  importedHoldings: number;
  createdHoldings: number;
  updatedHoldings: number;
  skippedHoldings: number;
  deduplicatedHoldings: number;
  duplicatesRemoved: number;
  warnings: string[];
}

function canonicalSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

function canonicalExchange(exchange: string | null | undefined): string | null {
  const value = exchange?.trim().toUpperCase();
  return value ? value : null;
}

function normalizeKeyParts(holding: BrokerHolding): BrokerInstrumentKey {
  return {
    contractAddress: holding.instrument.contractAddress?.trim().toLowerCase() ?? null,
    symbol: canonicalSymbol(holding.instrument.symbol),
    exchange: canonicalExchange(holding.instrument.exchange),
    region: holding.instrument.region,
    chain: holding.instrument.chain ?? null,
  };
}

function holdingKey(holding: BrokerHolding): string {
  const key = normalizeKeyParts(holding);
  return [key.region, key.contractAddress ?? "", key.symbol, key.exchange ?? "", key.chain ?? ""].join("|");
}

function scoreInstrumentCompleteness(holding: BrokerHolding): number {
  const hasValue = (v: string | number | null | undefined): boolean => {
    if (v == null) return false;
    if (typeof v === "string") return v.trim().length > 0;
    return v !== 0;
  };
  return [
    holding.instrument.contractAddress,
    holding.instrument.chain,
    holding.instrument.tokenStandard,
    holding.instrument.exchange,
    holding.instrument.sector,
    holding.instrument.industry,
    holding.marketPrice,
    holding.marketValue,
    holding.costBasis,
    holding.unrealizedPnl,
    holding.unrealizedPnlPercent,
    holding.dayChange,
    holding.dayChangePercent,
    holding.lots?.length,
  ].reduce<number>((score, value) => score + (hasValue(value as string | number | null | undefined) ? 1 : 0), 0);
}

function pickBestInstrument(contributions: BrokerHolding[]): BrokerHolding["instrument"] {
  return [...contributions].sort((a, b) => {
    const scoreDiff = scoreInstrumentCompleteness(b) - scoreInstrumentCompleteness(a);
    if (scoreDiff !== 0) return scoreDiff;

    const aHasContractAddress = a.instrument.contractAddress ? 1 : 0;
    const bHasContractAddress = b.instrument.contractAddress ? 1 : 0;
    if (aHasContractAddress !== bHasContractAddress) return bHasContractAddress - aHasContractAddress;

    return a.instrument.name.localeCompare(b.instrument.name);
  })[0].instrument;
}

export function mergeBrokerHoldings(holdings: BrokerHolding[]): BrokerDeduplicationResult {
  const groups = new Map<string, BrokerHolding[]>();

  for (const holding of holdings) {
    const key = holdingKey(holding);
    const bucket = groups.get(key);
    if (bucket) {
      bucket.push(holding);
    } else {
      groups.set(key, [holding]);
    }
  }

  const mergedHoldings: BrokerMergedHolding[] = [];

  for (const contributions of groups.values()) {
    const first = contributions[0];
    const totalQuantity = contributions.reduce((sum, holding) => sum + holding.quantity, 0);
    const weightedAveragePrice = totalQuantity > 0
      ? contributions.reduce((sum, holding) => sum + holding.quantity * holding.averagePrice, 0) / totalQuantity
      : 0;

    const totalMarketValue = contributions.reduce<number | null>((sum, holding) => {
      if (holding.marketValue == null) return sum;
      return (sum ?? 0) + holding.marketValue;
    }, null);

    const totalCostBasis = contributions.reduce<number | null>((sum, holding) => {
      if (holding.costBasis == null) return sum;
      return (sum ?? 0) + holding.costBasis;
    }, null);

    const totalUnrealizedPnl = contributions.reduce<number | null>((sum, holding) => {
      if (holding.unrealizedPnl == null) return sum;
      return (sum ?? 0) + holding.unrealizedPnl;
    }, null);

    mergedHoldings.push({
      key: normalizeKeyParts(first),
      instrument: pickBestInstrument(contributions),
      totalQuantity,
      weightedAveragePrice,
      totalMarketValue,
      totalCostBasis,
      totalUnrealizedPnl,
      sources: contributions.map((holding) => holding.source),
      contributions,
      confidence: Math.min(...contributions.map((holding) => holding.confidence)),
    });
  }

  return {
    mergedHoldings,
    mergedPositions: [],
    totalHoldingsBefore: holdings.length,
    totalHoldingsAfter: mergedHoldings.length,
    duplicatesRemoved: Math.max(0, holdings.length - mergedHoldings.length),
    warnings: [],
  };
}

export async function applyBrokerNormalizationResultToPortfolio(args: {
  portfolioId: string;
  snapshot: BrokerNormalizationResult;
  replaceExisting?: boolean;
}): Promise<BrokerImportSummary> {
  const portfolio = await prisma.portfolio.findUnique({
    where: { id: args.portfolioId },
    select: { id: true, region: true, currency: true, userId: true },
  });

  if (!portfolio) {
    throw new Error("Portfolio not found");
  }

  const deduplication = mergeBrokerHoldings(args.snapshot.snapshot.holdings);
  const warnings = [...new Set([...args.snapshot.warnings, ...args.snapshot.snapshot.warnings, ...deduplication.warnings])];

  let importedHoldings = 0;
  let createdHoldings = 0;
  let updatedHoldings = 0;
  let skippedHoldings = 0;

  const importedAssetIds = new Set<string>();

  // Batch 1: resolve all symbols → assets in one query
  const allSymbols = deduplication.mergedHoldings.map((h) => canonicalSymbol(h.instrument.symbol));
  const assetRows = await prisma.asset.findMany({
    where: { symbol: { in: allSymbols } },
    select: { id: true, symbol: true, region: true, currency: true },
  });
  const assetBySymbol = new Map(assetRows.map((a) => [a.symbol, a]));

  // Determine which assets pass region check so we can batch the existence lookup
  const eligibleAssets: Array<{ assetId: string; symbol: string; currency: string | null }> = [];
  for (const mergedHolding of deduplication.mergedHoldings) {
    const symbol = canonicalSymbol(mergedHolding.instrument.symbol);
    const asset = assetBySymbol.get(symbol);
    if (!asset) {
      skippedHoldings++;
      warnings.push(`Skipped ${symbol}: asset not found in universe`);
      continue;
    }
    if (portfolio.region && asset.region && portfolio.region !== asset.region) {
      skippedHoldings++;
      warnings.push(`Skipped ${symbol}: asset region (${asset.region}) does not match portfolio region (${portfolio.region})`);
      continue;
    }
    eligibleAssets.push({ assetId: asset.id, symbol, currency: asset.currency });
  }

  // Batch 2: check which holdings already exist
  const existingHoldings = await prisma.portfolioHolding.findMany({
    where: {
      portfolioId: portfolio.id,
      assetId: { in: eligibleAssets.map((a) => a.assetId) },
    },
    select: { assetId: true },
  });
  const existingAssetIds = new Set(existingHoldings.map((h) => h.assetId));

  // Build O(1) lookup before the upsert loop
  const mergedBySymbol = new Map(
    deduplication.mergedHoldings.map((h) => [canonicalSymbol(h.instrument.symbol), h]),
  );

  // Batch 3: upsert eligible holdings
  for (const { assetId, symbol, currency } of eligibleAssets) {
    const resolvedCurrency = currency ?? portfolio.currency;
    const mergedHolding = mergedBySymbol.get(symbol);
    if (!mergedHolding) continue;

    await prisma.portfolioHolding.upsert({
      where: { portfolioId_assetId: { portfolioId: portfolio.id, assetId } },
      create: {
        portfolioId: portfolio.id,
        assetId,
        symbol,
        quantity: mergedHolding.totalQuantity,
        avgPrice: mergedHolding.weightedAveragePrice,
        currency: resolvedCurrency,
      },
      update: {
        symbol,
        quantity: mergedHolding.totalQuantity,
        avgPrice: mergedHolding.weightedAveragePrice,
        currency: resolvedCurrency,
      },
    });

    importedAssetIds.add(assetId);
    importedHoldings++;
    if (existingAssetIds.has(assetId)) {
      updatedHoldings++;
    } else {
      createdHoldings++;
    }
  }

  if (args.replaceExisting && importedAssetIds.size > 0) {
    await prisma.portfolioHolding.deleteMany({
      where: {
        portfolioId: portfolio.id,
        assetId: { notIn: Array.from(importedAssetIds) },
      },
    });
  }

  logger.info(
    {
      portfolioId: portfolio.id,
      provider: args.snapshot.provider,
      importedHoldings,
      createdHoldings,
      updatedHoldings,
      skippedHoldings,
      deduplicatedHoldings: deduplication.totalHoldingsAfter,
    },
    "Broker normalization result applied to portfolio",
  );

  return {
    portfolioId: portfolio.id,
    provider: args.snapshot.provider,
    region: args.snapshot.region,
    snapshotCapturedAt: args.snapshot.snapshot.capturedAt,
    normalizedAt: args.snapshot.normalizedAt,
    sourceCount: args.snapshot.sourceCount,
    accountCount: args.snapshot.accountCount,
    holdingCount: args.snapshot.holdingCount,
    positionCount: args.snapshot.positionCount,
    transactionCount: args.snapshot.transactionCount,
    importedHoldings,
    createdHoldings,
    updatedHoldings,
    skippedHoldings,
    deduplicatedHoldings: deduplication.totalHoldingsAfter,
    duplicatesRemoved: deduplication.duplicatesRemoved,
    warnings,
  };
}
