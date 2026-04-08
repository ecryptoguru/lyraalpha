import { prisma } from "../prisma";
import { AssetType, Prisma } from "@/generated/prisma/client";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import type { TopHoldingsData, Holding, SectorWeight } from "@/lib/engines/mf-lookthrough";
import crypto from "crypto";
import type { Page } from "playwright";

const logger = createLogger({ service: "mf-holdings-scraper" });

// ─── Moneycontrol Scraping Types ──────────────────────────────────────

interface RawHolding {
  name: string;
  sector: string;
  marketValueCr: number;
  weightPct: number;
}

interface RawScrapeResult {
  holdings: RawHolding[];
  sectors: { sector: string; weight: number }[];
  meta: {
    totalStocks: number;
    top5Weight: number;
    top10Weight: number;
    avgMcapCr: number;
    largeCapPct: number;
    midCapPct: number;
    smallCapPct: number;
    asOfDate?: string;
  };
}

// ─── Sector Normalization Map ─────────────────────────────────────────
// Moneycontrol uses granular sector names; normalize to broader categories

const SECTOR_MAP: Record<string, string> = {
  "private sector bank": "Financial Services",
  "public sector bank": "Financial Services",
  "housing finance company": "Financial Services",
  "finance (including nbfcs)": "Financial Services",
  "financial institution": "Financial Services",
  "life insurance": "Financial Services",
  "general insurance": "Financial Services",
  "asset management company": "Financial Services",
  "stock/ commodity brokers": "Financial Services",
  "refineries & marketing": "Energy",
  "oil exploration": "Energy",
  "power generation & distribution": "Energy",
  "power generation/distribution": "Energy",
  "gas transmission/marketing": "Energy",
  "computers - software & consulting": "Technology",
  "it - software": "Technology",
  "it enabled services": "Technology",
  "telecom - cellular & fixed line services": "Communication Services",
  "telecom - infrastructure": "Communication Services",
  "civil construction": "Industrials",
  "engineering - industrial equipments": "Industrials",
  "infrastructure developers & operators": "Industrials",
  "capital goods - electrical equipment": "Industrials",
  "capital goods-non electrical equipment": "Industrials",
  "diversified fmcg": "Consumer Staples",
  "personal care": "Consumer Staples",
  "food processing": "Consumer Staples",
  "tobacco products": "Consumer Staples",
  "consumer food": "Consumer Staples",
  "beverages": "Consumer Staples",
  "pharmaceuticals": "Healthcare",
  "healthcare": "Healthcare",
  "hospitals & medical services": "Healthcare",
  "automobiles - passenger cars": "Consumer Discretionary",
  "automobiles-trucks/lcv": "Consumer Discretionary",
  "auto ancillaries": "Consumer Discretionary",
  "two & three wheelers": "Consumer Discretionary",
  "consumer durables": "Consumer Discretionary",
  "retailing": "Consumer Discretionary",
  "hotels & restaurants": "Consumer Discretionary",
  "cement & cement products": "Materials",
  "steel": "Materials",
  "aluminium": "Materials",
  "chemicals": "Materials",
  "mining & mineral products": "Materials",
  "realty": "Real Estate",
  "residential,commercial projects": "Real Estate",
  "defence": "Industrials",
  "aerospace & defense": "Industrials",
  "logistics": "Industrials",
  "shipping": "Industrials",
  "railways": "Industrials",
};

function normalizeSectorName(rawSector: string): string {
  const lower = rawSector.toLowerCase().trim();
  return SECTOR_MAP[lower] || rawSector;
}

// ─── NSE Symbol Guessing ──────────────────────────────────────────────
// Try to guess NSE symbol from holding name for cross-referencing

const NAME_TO_SYMBOL_HINTS: Record<string, string> = {
  "hdfc bank": "HDFCBANK.NS",
  "icici bank": "ICICIBANK.NS",
  "reliance industries": "RELIANCE.NS",
  "infosys": "INFY.NS",
  "bharti airtel": "BHARTIARTL.NS",
  "tata consultancy services": "TCS.NS",
  "larsen & toubro": "LT.NS",
  "state bank of india": "SBIN.NS",
  "axis bank": "AXISBANK.NS",
  "itc": "ITC.NS",
  "kotak mahindra bank": "KOTAKBANK.NS",
  "hindustan unilever": "HINDUNILVR.NS",
  "bajaj finance": "BAJFINANCE.NS",
  "maruti suzuki": "MARUTI.NS",
  "sun pharmaceutical": "SUNPHARMA.NS",
  "titan company": "TITAN.NS",
  "asian paints": "ASIANPAINT.NS",
  "hcl technologies": "HCLTECH.NS",
  "wipro": "WIPRO.NS",
  "ultratech cement": "ULTRACEMCO.NS",
  "power grid": "POWERGRID.NS",
  "ntpc": "NTPC.NS",
  "tata motors": "TATAMOTORS.NS",
  "tata steel": "TATASTEEL.NS",
  "mahindra & mahindra": "M&M.NS",
  "adani enterprises": "ADANIENT.NS",
  "adani ports": "ADANIPORTS.NS",
  "bajaj finserv": "BAJAJFINSV.NS",
  "tech mahindra": "TECHM.NS",
  "nestle india": "NESTLEIND.NS",
  "dr. reddy": "DRREDDY.NS",
  "cipla": "CIPLA.NS",
  "grasim industries": "GRASIM.NS",
  "divis laboratories": "DIVISLAB.NS",
  "britannia industries": "BRITANNIA.NS",
  "apollo hospitals": "APOLLOHOSP.NS",
  "eicher motors": "EICHERMOT.NS",
  "sbi life insurance": "SBILIFE.NS",
  "hdfc life insurance": "HDFCLIFE.NS",
  "delhivery": "DELHIVERY.NS",
  "zomato": "ZOMATO.NS",
  "trent": "TRENT.NS",
  "jio financial": "JIOFIN.NS",
  "indusind bank": "INDUSINDBK.NS",
};

function guessSymbol(holdingName: string): string | null {
  const lower = holdingName.toLowerCase().replace(/\s+ltd\.?$/, "").trim();
  for (const [hint, symbol] of Object.entries(NAME_TO_SYMBOL_HINTS)) {
    if (lower.includes(hint)) return symbol;
  }
  return null;
}

// ─── Parse Moneycontrol Holdings Page ─────────────────────────────────

/**
 * Extracts holdings data from a Moneycontrol portfolio page using Playwright.
 * This function is called with a Playwright Page object already navigated to the holdings URL.
 */
export async function extractHoldingsFromPage(page: Page): Promise<RawScrapeResult | null> {
  try {
    const result = await page.evaluate(() => {
      const holdings: { name: string; sector: string; marketValueCr: number; weightPct: number }[] = [];
      const meta = {
        totalStocks: 0,
        top5Weight: 0,
        top10Weight: 0,
        avgMcapCr: 0,
        largeCapPct: 0,
        midCapPct: 0,
        smallCapPct: 0,
      };

      // Find all table rows
      const rows = document.querySelectorAll("table tbody tr");
      const seenNames = new Set<string>();

      for (const row of rows) {
        const cells = row.querySelectorAll("td");
        if (cells.length < 4) continue;

        const firstCell = cells[0]?.textContent?.trim() || "";

        // Parse summary stats
        if (firstCell === "No. of Stocks") {
          meta.totalStocks = parseInt(cells[1]?.textContent?.trim() || "0", 10);
          continue;
        }
        if (firstCell === "Top 5 Stock Weight") {
          meta.top5Weight = parseFloat(cells[1]?.textContent?.replace("%", "").trim() || "0");
          continue;
        }
        if (firstCell === "Top 10 Stock Weight") {
          meta.top10Weight = parseFloat(cells[1]?.textContent?.replace("%", "").trim() || "0");
          continue;
        }
        if (firstCell === "Average mcap (Cr)") {
          meta.avgMcapCr = parseFloat(cells[1]?.textContent?.replace(/,/g, "").trim() || "0");
          continue;
        }
        if (firstCell.includes("large cap")) {
          meta.largeCapPct = parseFloat(cells[1]?.textContent?.replace("%", "").trim() || "0");
          continue;
        }
        if (firstCell.includes("mid cap")) {
          meta.midCapPct = parseFloat(cells[1]?.textContent?.replace("%", "").trim() || "0");
          continue;
        }
        if (firstCell.includes("small cap")) {
          meta.smallCapPct = parseFloat(cells[1]?.textContent?.replace("%", "").trim() || "0");
          continue;
        }

        // Parse holding rows (have 7+ cells: name, sector, mktval, weight, change, 1y-high, 1y-low, ...)
        if (cells.length >= 7) {
          // Clean the name (remove # prefix and extra whitespace)
          const rawName = firstCell.replace(/^#\s*/, "").replace(/\s+/g, " ").trim();
          if (!rawName || rawName.length < 3) continue;

          const sector = cells[1]?.textContent?.trim() || "";
          const mktVal = parseFloat(cells[2]?.textContent?.replace(/,/g, "").trim() || "0");
          const weight = parseFloat(cells[3]?.textContent?.replace("%", "").trim() || "0");

          if (weight > 0 && !seenNames.has(rawName)) {
            seenNames.add(rawName);
            holdings.push({
              name: rawName,
              sector,
              marketValueCr: mktVal,
              weightPct: weight,
            });
          }
        }
      }

      return { holdings, meta };
    });

    if (!result || result.holdings.length === 0) {
      return null;
    }

    // Aggregate sectors from holdings
    const sectorMap = new Map<string, number>();
    for (const h of result.holdings) {
      const sector = h.sector || "Other";
      sectorMap.set(sector, (sectorMap.get(sector) || 0) + h.weightPct);
    }
    const sectors = Array.from(sectorMap.entries())
      .map(([sector, weight]) => ({ sector, weight: Math.round(weight * 100) / 100 }))
      .sort((a, b) => b.weight - a.weight);

    return {
      holdings: result.holdings,
      sectors,
      meta: result.meta,
    };
  } catch (error) {
    logger.error({ err: sanitizeError(error) }, "Failed to extract holdings from page");
    return null;
  }
}

// ─── Transform to TopHoldingsData ─────────────────────────────────────

export function transformToTopHoldings(raw: RawScrapeResult): TopHoldingsData {
  const holdings: Holding[] = raw.holdings.map((h) => ({
    symbol: guessSymbol(h.name),
    name: h.name,
    weight: h.weightPct / 100, // Convert percentage to decimal (12.3% → 0.123)
  }));

  // Normalize sectors to broader categories and re-aggregate
  const sectorMap = new Map<string, number>();
  for (const s of raw.sectors) {
    const normalized = normalizeSectorName(s.sector);
    sectorMap.set(normalized, (sectorMap.get(normalized) || 0) + s.weight);
  }
  const sectorWeights: SectorWeight[] = Array.from(sectorMap.entries())
    .map(([sector, weight]) => ({ sector, weight: Math.round(weight * 100) / 100 }))
    .sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0));

  return {
    holdings,
    sectorWeights,
    equityHoldings: {
      medianMarketCap: raw.meta.avgMcapCr ? raw.meta.avgMcapCr * 10_000_000 : null, // Cr to absolute
      priceToEarnings: null,
      priceToBook: null,
      priceToSales: null,
      threeYearEarningsGrowth: null,
    },
  };
}

// ─── Delta Check ──────────────────────────────────────────────────────

function hashHoldings(data: TopHoldingsData): string {
  const key = (data.holdings || [])
    .map((h) => `${h.name}:${h.weight}`)
    .sort()
    .join("|");
  return crypto.createHash("md5").update(key).digest("hex");
}

// ─── Persist Holdings ─────────────────────────────────────────────────

export async function persistHoldings(
  assetId: string,
  symbol: string,
  newData: TopHoldingsData,
  existingTopHoldings: unknown
): Promise<boolean> {
  // Delta check: skip if holdings haven't changed
  const newHash = hashHoldings(newData);
  if (existingTopHoldings) {
    const oldHash = hashHoldings(existingTopHoldings as TopHoldingsData);
    if (newHash === oldHash) {
      logger.debug({ symbol }, "Holdings unchanged, skipping update");
      return false;
    }
  }

  await prisma.asset.update({
    where: { id: assetId },
    data: {
      topHoldings: newData as unknown as Prisma.InputJsonValue,
      updatedAt: new Date(),
    },
  });

  logger.info(
    { symbol, holdingCount: newData.holdings?.length, sectorCount: newData.sectorWeights?.length },
    "Updated MF topHoldings"
  );
  return true;
}

// ─── Rich Fund Metadata ───────────────────────────────────────────────

export interface RichFundMetadata {
  aumCr?: number;
  expenseRatioPct?: number;
  sharpeRatio?: number;
  standardDeviation?: number;
  beta?: number;
  alpha?: number;
  rSquared?: number;
  portfolioTurnover?: number;
  fundManagers?: string;
  benchmark?: string;
  launchDate?: string;
  morningstarRating?: number;
  top5StockWeight?: number;
}

/**
 * Extracts rich fund metadata from a Moneycontrol NAV page.
 * The page should already be navigated to /mutual-funds/nav/{slug}/{MC_CODE}
 */
export async function extractFundMetadata(page: Page): Promise<RichFundMetadata> {
  try {
    const raw = await page.evaluate(() => {
      const kvPairs: Record<string, string> = {};
      const allElements = document.querySelectorAll("span, div, td");

      for (const el of allElements) {
        const text = el.textContent?.trim() || "";
        if (text.length > 150 || text.length < 3) continue;

        // Match exact label elements and grab sibling value
        if (text === "AUM (Crs.)") {
          const next = el.nextElementSibling?.textContent?.trim();
          if (next) kvPairs["aum"] = next;
        }
        if (text === "Expense Ratio") {
          const next = el.nextElementSibling?.textContent?.trim();
          if (next) kvPairs["expenseRatio"] = next;
        }
        if (text === "Sharpe Ratio / Category Average") {
          const next = el.nextElementSibling?.textContent?.trim();
          if (next) kvPairs["sharpe"] = next;
        }
        if (text === "Standard Deviation / Category Average") {
          const next = el.nextElementSibling?.textContent?.trim();
          if (next) kvPairs["stdDev"] = next;
        }
        if (text === "Beta / Category Average") {
          const next = el.nextElementSibling?.textContent?.trim();
          if (next) kvPairs["beta"] = next;
        }
        if (text === "Alpha / Category Average") {
          const next = el.nextElementSibling?.textContent?.trim();
          if (next) kvPairs["alpha"] = next;
        }
        if (text === "R-Squared / Category Average" || text === "R Squared / Category Average") {
          const next = el.nextElementSibling?.textContent?.trim();
          if (next) kvPairs["rSquared"] = next;
        }
        if (text === "Portfolio Turnover / Category Average") {
          const next = el.nextElementSibling?.textContent?.trim();
          if (next) kvPairs["turnover"] = next;
        }
        if (text.startsWith("Fund Manager(s)")) {
          const match = text.match(/Fund Manager\(s\)(?:Check History)?(.+)/);
          if (match) kvPairs["fundManagers"] = match[1].trim();
          else {
            const next = el.nextElementSibling?.textContent?.trim();
            if (next) kvPairs["fundManagers"] = next;
          }
        }
        if (text.startsWith("Benchmark")) {
          const val = text.replace("Benchmark", "").trim();
          if (val) kvPairs["benchmark"] = val;
        }
      }

      // Also try to find fund managers from a broader pattern
      const bodyText = document.body.innerText;
      const fmMatch = bodyText.match(/Fund Manager\(s\)(?:Check History)?([A-Za-z\s,\.]+?)(?:Launch Date|Benchmark|$)/);
      if (fmMatch && !kvPairs["fundManagers"]) {
        kvPairs["fundManagers"] = fmMatch[1].trim();
      }
      const launchMatch = bodyText.match(/Launch Date([\d\s\w,]+?)(?:Benchmark|Fund Manager|$)/);
      if (launchMatch) {
        kvPairs["launchDate"] = launchMatch[1].trim();
      }

      return kvPairs;
    });

    const parseNum = (s?: string): number | undefined => {
      if (!s || s === "-" || s === "--") return undefined;
      const n = parseFloat(s.replace(/[,%]/g, "").trim());
      return isNaN(n) ? undefined : n;
    };

    return {
      aumCr: parseNum(raw.aum),
      expenseRatioPct: parseNum(raw.expenseRatio),
      sharpeRatio: parseNum(raw.sharpe),
      standardDeviation: parseNum(raw.stdDev),
      beta: parseNum(raw.beta),
      alpha: parseNum(raw.alpha),
      rSquared: parseNum(raw.rSquared),
      portfolioTurnover: parseNum(raw.turnover?.split("/")?.[0]),
      fundManagers: raw.fundManagers || undefined,
      benchmark: raw.benchmark || undefined,
      launchDate: raw.launchDate || undefined,
    };
  } catch (error) {
    logger.error({ err: sanitizeError(error) }, "Failed to extract fund metadata");
    return {};
  }
}

// ─── Moneycontrol Search URL Builder ──────────────────────────────────

export function buildSearchQuery(fundName: string): string {
  const cleaned = fundName
    .replace(/\s*-\s*(Direct|Regular)\s*(Plan)?\s*/i, " Direct ")
    .replace(/\s*-\s*Growth\s*/i, " Growth ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned;
}

// ─── Batch Sync Orchestrator ──────────────────────────────────────────

export class MFHoldingsScraperService {
  /**
   * Gets all MF assets that need holdings data
   */
  static async getMFAssets() {
    return prisma.asset.findMany({
      where: { type: AssetType.MUTUAL_FUND, region: "IN" },
      select: {
        id: true,
        symbol: true,
        name: true,
        metadata: true,
        topHoldings: true,
        category: true,
      },
      orderBy: { name: "asc" },
    });
  }

  /**
   * Checks if an asset's holdings are stale (older than 7 days)
   */
  static isStale(topHoldings: unknown): boolean {
    if (!topHoldings) return true;
    const data = topHoldings as Record<string, unknown>;
    const scrapedAt = data._scrapedAt as string | undefined;
    if (!scrapedAt) return true;
    const age = Date.now() - new Date(scrapedAt).getTime();
    return age > 7 * 24 * 60 * 60 * 1000; // 7 days
  }
}
