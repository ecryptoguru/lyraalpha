import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { computeAndStorePortfolioHealth } from "@/lib/services/portfolio.service";
import { invalidateCacheByPrefix } from "@/lib/redis";
import { dashboardHomeCachePrefix } from "@/lib/cache-keys";
import { apiError } from "@/lib/api-response";

const logger = createLogger({ service: "pdf-import" });

export const dynamic = "force-dynamic";

// ─── PDF text extraction ──────────────────────────────────────────────────────

/**
 * Extract readable text from a PDF buffer without external dependencies.
 * Parses the PDF content stream looking for text operators (Tj, TJ, Td, BT/ET blocks).
 */
function extractTextFromPdf(buffer: Buffer): string {
  const raw = buffer.toString("latin1");
  const textParts: string[] = [];

  // Extract all string literals from text-showing operators
  // BT ... ET blocks contain text positioning and drawing commands
  const btEtRegex = /BT([\s\S]*?)ET/g;
  let btMatch: RegExpExecArray | null;

  while ((btMatch = btEtRegex.exec(raw)) !== null) {
    const block = btMatch[1];

    // Tj operator: (text) Tj
    const tjRegex = /\(([^)]*)\)\s*Tj/g;
    let tjMatch: RegExpExecArray | null;
    while ((tjMatch = tjRegex.exec(block)) !== null) {
      textParts.push(decodePdfString(tjMatch[1]));
    }

    // TJ operator: [(text) offset (text) ...] TJ
    const tjArrayRegex = /\[([^\]]*)\]\s*TJ/g;
    let tjArrayMatch: RegExpExecArray | null;
    while ((tjArrayMatch = tjArrayRegex.exec(block)) !== null) {
      const inner = tjArrayMatch[1];
      const innerTjRegex = /\(([^)]*)\)/g;
      let innerMatch: RegExpExecArray | null;
      while ((innerMatch = innerTjRegex.exec(inner)) !== null) {
        textParts.push(decodePdfString(innerMatch[1]));
      }
    }
  }

  // Also look for text outside BT/ET (some PDFs use this)
  const looseTj = /\(([^)]{1,200})\)\s*Tj/g;
  let looseMatch: RegExpExecArray | null;
  while ((looseMatch = looseTj.exec(raw)) !== null) {
    const text = decodePdfString(looseMatch[1]);
    if (!textParts.includes(text)) textParts.push(text);
  }

  return textParts.join(" ").replace(/\s+/g, " ").trim();
}

function decodePdfString(s: string): string {
  return s
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\\\/g, "\\")
    .replace(/\\(\d{3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)));
}

// ─── Broker statement parsers ─────────────────────────────────────────────────

export interface ParsedHolding {
  symbol: string;
  quantity: number;
  avgPrice: number;
  source: string;
}

/**
 * Multi-pattern parser that handles various broker statement formats.
 * Returns an array of detected holdings.
 */
function parseHoldingsFromText(text: string, region: string): ParsedHolding[] {
  const holdings: ParsedHolding[] = [];
  const seen = new Set<string>();

  const lines = text
    .split(/[\n\r]+/)
    .map((l) => l.trim())
    .filter(Boolean);

  // ── Pattern 1: Zerodha / Groww style ─────────────────────────────────────
  // SYMBOL   ISIN   QTY   AVG_PRICE   LTP   ...
  // BTC-USD  INE002A01018  10  95000.00  104000.00  ...
  const zerodhaPattern =
    /([A-Z][A-Z0-9&\-]{1,19})\s+(?:INE|US)\w{10,12}\s+(\d+(?:\.\d+)?)\s+([\d,]+(?:\.\d{1,4})?)/gi;

  for (const line of lines) {
    const m = zerodhaPattern.exec(line);
    if (m) {
      const symbol = m[1].toUpperCase();
      const qty = parseFloat(m[2].replace(/,/g, ""));
      const price = parseFloat(m[3].replace(/,/g, ""));
      if (isValidHolding(symbol, qty, price)) {
        const key = `${symbol}`;
        if (!seen.has(key)) {
          seen.add(key);
          holdings.push({ symbol, quantity: qty, avgPrice: price, source: "zerodha_statement" });
        }
      }
    }
    zerodhaPattern.lastIndex = 0;
  }

  // ── Pattern 2: Fidelity / Schwab / US brokerage style ────────────────────
  // Symbol  Description  Quantity  Price  Value
  // BTC-USD  Bitcoin     0.5       95000   47500.00
  const usBrokeragePattern =
    /\b([A-Z]{1,5}(?:\.[A-Z]{1,2})?)\s+[A-Za-z][\w\s,\.]{3,40}\s+(\d+(?:\.\d+)?)\s+\$?([\d,]+\.\d{2})/g;

  for (const line of lines) {
    const m = usBrokeragePattern.exec(line);
    if (m) {
      const symbol = m[1].toUpperCase();
      const qty = parseFloat(m[2].replace(/,/g, ""));
      const price = parseFloat(m[3].replace(/,/g, ""));
      if (isValidHolding(symbol, qty, price) && region === "US") {
        const key = `${symbol}`;
        if (!seen.has(key)) {
          seen.add(key);
          holdings.push({ symbol, quantity: qty, avgPrice: price, source: "us_broker_statement" });
        }
      }
    }
    usBrokeragePattern.lastIndex = 0;
  }

  // ── Pattern 3: Generic tabular — 2-5 letter symbol + qty + price ─────────
  // Works across Dhan, Angel, 5paisa, Alpaca, etc.
  const genericPattern =
    /\b([A-Z][A-Z0-9]{1,9}(?:\.(?:NS|BO|US))?)(?:\s+\S+){0,3}?\s+(\d{1,10}(?:\.\d{1,4})?)\s+(?:₹|\$|Rs\.?)?\s*([\d,]+\.\d{0,4})/g;

  for (const line of lines) {
    const m = genericPattern.exec(line);
    if (m) {
      const symbol = m[1].toUpperCase().replace(/\.(NS|BO)$/, "");
      const qty = parseFloat(m[2].replace(/,/g, ""));
      const price = parseFloat(m[3].replace(/,/g, ""));
      if (isValidHolding(symbol, qty, price)) {
        const key = symbol;
        if (!seen.has(key)) {
          seen.add(key);
          holdings.push({ symbol, quantity: qty, avgPrice: price, source: "generic_statement" });
        }
      }
    }
    genericPattern.lastIndex = 0;
  }

  // ── Pattern 4: Plain text with "Quantity" / "Average Price" labels ────────
  // Handles: "BTC-USD 0.5 units @ $95000" or "0.5 BTC-USD @ 95000"
  const labeledPattern =
    /(\d+(?:\.\d+)?)\s+(?:shares?|units?|qty)?\s+(?:of\s+)?([A-Z][A-Z0-9]{1,9})\s+(?:@|at|avg\.?\s*price:?)\s+(?:₹|\$|Rs\.?)?\s*([\d,]+(?:\.\d{1,4})?)/gi;
  let lm: RegExpExecArray | null;
  while ((lm = labeledPattern.exec(text)) !== null) {
    const qty = parseFloat(lm[1].replace(/,/g, ""));
    const symbol = lm[2].toUpperCase();
    const price = parseFloat(lm[3].replace(/,/g, ""));
    if (isValidHolding(symbol, qty, price)) {
      const key = symbol;
      if (!seen.has(key)) {
        seen.add(key);
        holdings.push({ symbol, quantity: qty, avgPrice: price, source: "labeled_statement" });
      }
    }
  }

  return holdings;
}

function isValidHolding(symbol: string, qty: number, price: number): boolean {
  if (!symbol || symbol.length < 1 || symbol.length > 15) return false;
  if (/^\d+$/.test(symbol)) return false; // pure numbers
  // Ignore common non-symbol tokens
  const stopwords = new Set([
    "THE", "AND", "FOR", "NET", "TAX", "FEE", "INR", "USD", "EUR", "TOTAL",
    "BALANCE", "AMOUNT", "VALUE", "COST", "PRICE", "DATE", "TYPE", "ISIN",
    "NAME", "DEBIT", "CREDIT", "FUND", "CASH", "INTEREST",
  ]);
  if (stopwords.has(symbol)) return false;
  if (isNaN(qty) || qty <= 0 || qty > 10_000_000) return false;
  if (isNaN(price) || price <= 0 || price > 10_000_000) return false;
  return true;
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return apiError("Unauthorized", 401);
  }

  const { id: portfolioId } = await params;

  try {
    const portfolio = await prisma.portfolio.findFirst({
      where: { id: portfolioId, userId },
      select: { id: true, region: true, currency: true },
    });
    if (!portfolio) {
      return apiError("Portfolio not found", 404);
    }

    const contentType = req.headers.get("content-type") ?? "";
    if (!contentType.includes("multipart/form-data")) {
      return apiError("Expected multipart/form-data", 400);
    }

    const formData = await req.formData();
    const file = formData.get("file");
    const replaceExisting = formData.get("replaceExisting") === "true";

    if (!(file instanceof File)) {
      return apiError("No file provided", 400);
    }

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "pdf") {
      return apiError("Only PDF files are supported", 400);
    }

    if (file.size > 20 * 1024 * 1024) {
      return apiError("File too large (max 20 MB)", 400);
    }

    // Extract text from PDF
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const text = extractTextFromPdf(buffer);

    if (!text || text.length < 20) {
      return NextResponse.json(
        { error: "Could not extract text from this PDF. Scanned/image PDFs are not supported. Try the CSV import instead." },
        { status: 422 },
      );
    }

    // Parse holdings from extracted text
    const parsedHoldings = parseHoldingsFromText(text, portfolio.region ?? "US");

    if (parsedHoldings.length === 0) {
      return NextResponse.json(
        {
          error: "No holdings detected in this PDF. Make sure it is a broker account statement or holdings report. Download the sample CSV for the expected format.",
          extractedTextLength: text.length,
          preview: text.slice(0, 300),
        },
        { status: 422 },
      );
    }

    // Resolve symbols against the asset universe
    const symbols = parsedHoldings.map((h) => h.symbol);
    const assetRows = await prisma.asset.findMany({
      where: { symbol: { in: symbols } },
      select: { id: true, symbol: true, region: true, currency: true },
    });
    const assetBySymbol = new Map(assetRows.map((a) => [a.symbol, a]));

    let importedCount = 0;
    let skippedCount = 0;
    const warnings: string[] = [];
    const importResults: Array<{ symbol: string; status: "imported" | "skipped" | "unknown"; message?: string }> = [];

    // ── Phase 1: validate + bucket holdings into "importable" vs "skip" ──
    // Doing this pre-pass means the transaction below only touches rows that
    // actually need writing, and the client receives authoritative skip reasons
    // even when the transaction later fails.
    const importable: Array<{
      symbol: string;
      assetId: string;
      quantity: number;
      avgPrice: number;
      currency: string;
    }> = [];
    for (const parsed of parsedHoldings) {
      const asset = assetBySymbol.get(parsed.symbol);
      if (!asset) {
        skippedCount++;
        warnings.push(`${parsed.symbol} not found in asset universe — skipped`);
        importResults.push({ symbol: parsed.symbol, status: "unknown", message: "Not in asset universe" });
        continue;
      }
      if (asset.region !== null && asset.region !== portfolio.region) {
        skippedCount++;
        warnings.push(`${parsed.symbol}: region mismatch (${asset.region} vs portfolio ${portfolio.region}) — skipped`);
        importResults.push({ symbol: parsed.symbol, status: "skipped", message: `Region mismatch (${asset.region})` });
        continue;
      }
      importable.push({
        symbol: parsed.symbol,
        assetId: asset.id,
        quantity: parsed.quantity,
        avgPrice: parsed.avgPrice,
        currency: asset.currency ?? portfolio.currency,
      });
    }

    // ── Phase 2: atomic parallel upsert inside a single transaction ──
    // Previously this was a sequential `for…await` which hit one pooled DB
    // round-trip per holding (10–30+ for a typical broker statement). The
    // transaction now fans out all upserts concurrently under a single BEGIN/COMMIT
    // so the DB handles them in parallel and any partial-failure rolls back cleanly.
    // `timeout` is raised from the 5s Prisma default since PDFs with 50+ holdings
    // can realistically take longer under pool pressure.
    if (importable.length > 0) {
      await prisma.$transaction(
        async (tx) => {
          await Promise.all(
            importable.map((h) =>
              tx.portfolioHolding.upsert({
                where: { portfolioId_assetId: { portfolioId: portfolio.id, assetId: h.assetId } },
                create: {
                  portfolioId: portfolio.id,
                  assetId: h.assetId,
                  symbol: h.symbol,
                  quantity: h.quantity,
                  avgPrice: h.avgPrice,
                  currency: h.currency,
                },
                update: replaceExisting
                  ? { quantity: h.quantity, avgPrice: h.avgPrice }
                  : {},
              }),
            ),
          );
        },
        { timeout: 30_000, maxWait: 5_000 },
      );
      importedCount = importable.length;
      for (const h of importable) {
        importResults.push({ symbol: h.symbol, status: "imported" });
      }
    }

    await computeAndStorePortfolioHealth(portfolio.id).catch((err) => {
      logger.warn({ err: sanitizeError(err), portfolioId }, "PDF import health recompute failed (non-fatal)");
    });

    await invalidateCacheByPrefix(dashboardHomeCachePrefix(userId));

    logger.info({ portfolioId, importedCount, skippedCount, fileName: file.name }, "PDF import completed");

    return NextResponse.json({
      summary: {
        fileName: file.name,
        parsedCount: parsedHoldings.length,
        importedCount,
        skippedCount,
      },
      results: importResults,
      warnings,
    });
  } catch (error) {
    logger.error({ err: sanitizeError(error), userId, portfolioId }, "PDF import failed");
    return apiError("PDF import failed", 500);
  }
}
