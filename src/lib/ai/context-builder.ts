import { AssetEnrichment, COMMON_WORDS } from "./types";
import { getMentoringMessage, type BehavioralInsight } from "./behavioral-intelligence";

/**
 * Converts internal regime enum values to human-readable labels.
 * Prevents raw SCREAMING_SNAKE_CASE values from leaking into model context and responses.
 */
function formatRegimeLabel(raw: string): string {
  const map: Record<string, string> = {
    STRONG_RISK_ON: "Strong Risk-On",
    RISK_ON: "Risk-On",
    NEUTRAL: "Neutral",
    DEFENSIVE: "Defensive",
    RISK_OFF: "Risk-Off",
    TRANSITIONING: "Transitioning",
    TRANSITIONAL: "Transitional",
  };
  return map[raw] ?? raw.replace(/_/g, "-");
}

/**
 * Truncate a description to at most maxLen characters, breaking on word boundary.
 * Uses nullish fallback (?? maxLen) so a leading space at index 0 doesn't trigger
 * the wrong slice position.
 */
function truncateDesc(s: string, maxLen: number): string {
  const raw = s.replace(/\s+/g, " ").trim();
  if (raw.length <= maxLen) return raw;
  const cut = raw.lastIndexOf(" ", maxLen);
  return raw.slice(0, cut > 0 ? cut : maxLen) + "...";
}

/**
 * Truncate a context block to at most maxLen characters, cutting on the last
 * sentence boundary (period + space, or newline) before the limit.
 * Falls back to word boundary if no sentence break is found within 85% of maxLen.
 */
export function truncateAtSentence(s: string, maxLen: number): string {
  if (s.length <= maxLen) return s;
  const region = s.slice(0, maxLen);
  // Try sentence break (". " or newline) in the last 15% of the region
  const minCut = Math.floor(maxLen * 0.85);
  let cut = -1;
  for (let i = region.length - 1; i >= minCut; i--) {
    if ((region[i] === '.' && (i + 1 >= region.length || region[i + 1] === ' ' || region[i + 1] === '\n')) || region[i] === '\n') {
      cut = i + 1;
      break;
    }
  }
  if (cut > 0) return s.slice(0, cut).trimEnd();
  // Fallback: word boundary
  const wordCut = region.lastIndexOf(" ");
  return s.slice(0, wordCut > 0 ? wordCut : maxLen).trimEnd();
}

function buildQuestionFocus(query?: string, symbol?: string): string | null {
  if (!query || !symbol || symbol === "GLOBAL") return null;
  const q = query.toLowerCase();
  const focus: string[] = [];
  if (/business|model|revenue|moat|customer|segment|what does .* do/.test(q)) focus.push("business model");
  if (/grow|growth|driver|catalyst|adoption|market share|volume|tvl|expansion/.test(q)) focus.push("growth drivers");
  if (/risk|downside|bear|fragile|break|concern|headwind/.test(q)) focus.push("risks");
  if (/valu|cheap|expensive|multiple|pe\b|p\/e|pb\b|p\/b|fcf|rerating|target price/.test(q)) focus.push("valuation insight");
  if (/momentum|trend|score|signal|setup|technical/.test(q)) focus.push("signal story");
  if (/result|earnings|quarter|guidance|margin|cash flow|fcf/.test(q)) focus.push("operating and financial context");
  if (focus.length === 0) {
    focus.push("business model", "growth drivers", "risks", "valuation insight");
  }
  return `[QUESTION_FOCUS] Prioritize ${focus.join(" → ")}. Add other useful supporting data only if it sharpens the answer. Do not repeat the same point across sections.`;
}

/**
 * Builds a compact, structured text context from LyraContext data.
 * Replaces wasteful JSON.stringify with token-efficient format the LLM can parse faster.
 *
 * Saves ~500-800 tokens per request vs raw JSON.
 */
export function buildCompressedContext(
  context: Record<string, unknown>,
  opts: {
    knowledgeContext?: string;
    memoryContext?: string;
    globalNotes?: string;
    sessionNotes?: string;
    crossSectorContext?: string;
    availableAssets?: string[];
    mentionedSymbols?: string[];
    priceData?: {
      price?: number | null;
      changePercent?: number | null;
      fiftyTwoWeekHigh?: number | null;
      fiftyTwoWeekLow?: number | null;
      lastPriceUpdate?: Date | null;
    };
    assetEnrichment?: AssetEnrichment;
    userPlan?: string;
    tier?: string;
    historicalAnalogContext?: string;
    behavioralInsights?: BehavioralInsight[];
    responseMode?: "default" | "compare" | "stress-test" | "portfolio" | "macro-research";
    query?: string;
  } = {},
): string {
  const lines: string[] = [];
  const responseMode = opts.responseMode || "default";

  // --- Asset Identity ---
  const symbol = (context.symbol as string) || "GLOBAL";
  const name = (context.assetName as string) || symbol;
  const type = (context.assetType as string) || "UNKNOWN";

  lines.push(`[ASSET] ${symbol} | ${name} | Type: ${type}`);
  const questionFocus = buildQuestionFocus(opts.query, symbol);
  if (questionFocus) lines.push(questionFocus);

  // --- Real-Time Price Data ---
  const pd = opts.priceData;
  const cs = opts.assetEnrichment?.currency === "INR" ? "₹" : "$";
  if (pd?.price != null) {
    const parts = [`Price:${cs}${pd.price.toFixed(2)}`];
    if (pd.changePercent != null) parts.push(`Change:${pd.changePercent >= 0 ? "+" : ""}${pd.changePercent.toFixed(2)}%`);
    if (pd.fiftyTwoWeekHigh != null && pd.fiftyTwoWeekLow != null) {
      parts.push(`52W:${cs}${pd.fiftyTwoWeekLow.toFixed(2)}-${cs}${pd.fiftyTwoWeekHigh.toFixed(2)}`);
    }
    if (pd.lastPriceUpdate) {
      const age = Math.round((Date.now() - new Date(pd.lastPriceUpdate).getTime()) / 60000);
      parts.push(`Updated:${age < 60 ? `${age}m ago` : `${Math.round(age / 60)}h ago`}`);
    }
    lines.push(`[PRICE] ${parts.join(" | ")}`);
  }

  // --- Engine Scores (only non-null) ---
  const scores = (context.scores || {}) as Record<string, number | undefined>;
  const scoreEntries = Object.entries(scores)
    .filter(([, v]) => v != null && v !== undefined)
    .map(([k, v]) => `${capitalize(k)}:${v}`);

  if (scoreEntries.length > 0) {
    lines.push(`[ENGINE_SCORES] ${scoreEntries.join(" | ")}`);
    
    // --- Chain-of-Thought: Pre-compute analytical insights from score patterns ---
    // Skip for SIMPLE tier — the SIMPLE prompt format doesn't inject [ANALYTICAL_CHAIN],
    // so computing it on every SIMPLE request is pure CPU waste.
    if (opts.tier !== "SIMPLE") {
      const dynamics = ((opts.assetEnrichment as Record<string, unknown> | undefined)?.scoreDynamics ?? {}) as Record<string, { trend?: string } | undefined>;
      const chain = buildAnalyticalChain(scores, dynamics);
      if (chain) {
        lines.push(`[ANALYTICAL_CHAIN]\n${chain}`);
      }
    }
  }

  // --- Regime ---
  if (context.regime) {
    lines.push(`[REGIME] ${formatRegimeLabel(context.regime as string)}`);
  }

  // --- Enriched Regime Detail (from Lyra Intel page) ---
  const rd = context.regimeDetail as Record<string, string> | undefined;
  if (rd) {
    const parts = [
      rd.regime && `State:${formatRegimeLabel(rd.regime)}`,
      rd.risk && `Risk:${rd.risk}`,
      rd.volatility && `Volatility:${rd.volatility}`,
      rd.breadth && `Breadth:${rd.breadth}`,
    ].filter(Boolean);
    if (parts.length > 0) {
      lines.push(`[MARKET_REGIME] ${parts.join(" | ")}`);
    }
  }

  // --- Top Movers (from Lyra Intel page) ---
  const tm = context.topMovers as { gainers?: string[]; losers?: string[] } | undefined;
  if (tm) {
    if (tm.gainers?.length) lines.push(`[TOP_GAINERS] ${tm.gainers.join(", ")}`);
    if (tm.losers?.length) lines.push(`[TOP_LOSERS] ${tm.losers.join(", ")}`);
  }

  // --- Region ---
  if (context.region) {
    lines.push(`[REGION] ${context.region === "IN" ? "India" : "United States"}`);
  }

  // ─── ASSET ENRICHMENT (P0/P1/P2 — conditional, only for asset-specific queries) ───
  const enrich = opts.assetEnrichment;
  if (enrich && symbol !== "GLOBAL") {
    const assetType = (enrich.type || type || "").toUpperCase();

    // P0: Performance Data (all asset types)
    const perf = enrich.performanceData as {
      returns?: Record<string, number | null>;
      range52W?: { currentPosition?: number | null; distanceFromHigh?: number | null; distanceFromLow?: number | null };
    } | null;
    if (perf?.returns) {
      const r = perf.returns;
      const retParts = Object.entries(r)
        .filter(([, v]) => v != null)
        .map(([k, v]) => `${k}:${v! >= 0 ? "+" : ""}${v!.toFixed(1)}%`);
      if (retParts.length > 0) {
        lines.push(`[PERFORMANCE] ${retParts.join(" | ")}`);
      }
    }
    if (perf?.range52W) {
      const rng = perf.range52W;
      const rngParts: string[] = [];
      if (rng.currentPosition != null) rngParts.push(`Position:${rng.currentPosition.toFixed(0)}%`);
      if (rng.distanceFromHigh != null) rngParts.push(`FromHigh:${rng.distanceFromHigh.toFixed(1)}%`);
      if (rng.distanceFromLow != null) rngParts.push(`FromLow:+${Math.abs(rng.distanceFromLow).toFixed(1)}%`);
      if (rngParts.length > 0) {
        lines.push(`[52W_POSITION] ${rngParts.join(" | ")}`);
      }
    }

    // P0: Valuation Metrics (stocks and ETFs only)
    // PRUNING: Only send [VALUATION] for MODERATE/COMPLEX tiers (SIMPLE already has price/base scores)
    if (opts.tier !== "SIMPLE" && (assetType === "STOCK" || assetType === "ETF")) {
      const valParts: string[] = [];
      if (enrich.peRatio != null) valParts.push(`P/E:${enrich.peRatio.toFixed(1)}`);
      if (enrich.priceToBook != null) valParts.push(`P/B:${enrich.priceToBook.toFixed(1)}`);
      if (enrich.roe != null) valParts.push(`ROE:${enrich.roe.toFixed(1)}%`);
      if (enrich.eps != null) valParts.push(`EPS:${enrich.eps.toFixed(2)}`);
      if (enrich.dividendYield != null && enrich.dividendYield > 0) valParts.push(`DivYield:${enrich.dividendYield.toFixed(2)}%`);
      if (enrich.marketCap) valParts.push(`MCap:${enrich.marketCap}`);
      if (valParts.length > 0) {
        lines.push(`[VALUATION] ${valParts.join(" | ")}`);
      }
      // Analyst targets from metadata
      const meta = enrich.metadata;
      if (meta) {
        const tgtParts: string[] = [];
        if (meta.targetMeanPrice != null) tgtParts.push(`Mean:${cs}${(meta.targetMeanPrice as number).toFixed(0)}`);
        if (meta.targetHighPrice != null) tgtParts.push(`High:${cs}${(meta.targetHighPrice as number).toFixed(0)}`);
        if (meta.targetLowPrice != null) tgtParts.push(`Low:${cs}${(meta.targetLowPrice as number).toFixed(0)}`);
        if (meta.numberOfAnalystOpinions != null) tgtParts.push(`Analysts:${meta.numberOfAnalystOpinions}`);
        if (tgtParts.length > 0) {
          lines.push(`[ANALYST_TARGETS] ${tgtParts.join(" | ")}`);
        }
      }
    }

    // P1: Signal Strength (all asset types that have it)
    const sig = enrich.signalStrength as {
      score?: number; label?: string;
      layers?: { dse?: number; regime?: number; fundamental?: number; dynamics?: number };
    } | null;
    if (sig?.score != null && sig?.label) {
      const parts = [`Score:${sig.score}`, `Label:${sig.label}`];
      if (sig.layers) {
        const l = sig.layers;
        const layerParts: string[] = [];
        if (l.dse != null) layerParts.push(`DSE:${l.dse}`);
        if (l.regime != null) layerParts.push(`Regime:${l.regime}`);
        if (l.fundamental != null) layerParts.push(`Fundamental:${l.fundamental}`);
        if (l.dynamics != null) layerParts.push(`Dynamics:${l.dynamics}`);
        if (layerParts.length > 0) parts.push(layerParts.join(" "));
      }
      lines.push(`[SIGNAL_STRENGTH] ${parts.join(" | ")}`);
    }

    // PRUNING: Skip subsequent P1/P2 data for SIMPLE tier unless explicitly requested (handled in service.ts)
    if (opts.tier === "SIMPLE") {
       return lines.join("\n");
    }

    // P2: Score Dynamics — trend direction + momentum delta (MODERATE/COMPLEX only)
    if (opts.tier !== "SIMPLE" && enrich.scoreDynamics) {
      const dyn = enrich.scoreDynamics as Record<string, {
        momentum?: number; acceleration?: number; trend?: string;
        percentileRank?: number;
      }>;
      const dynParts: string[] = [];
      for (const [engine, d] of Object.entries(dyn)) {
        if (!d || d.trend == null) continue;
        const arrow = d.trend === "IMPROVING" ? "↑" : d.trend === "DETERIORATING" ? "↓" : "→";
        const mom = d.momentum != null ? `(${d.momentum >= 0 ? "+" : ""}${d.momentum.toFixed(0)})` : "";
        dynParts.push(`${capitalize(engine)}:${arrow}${mom}`);
      }
      if (dynParts.length > 0) {
        lines.push(`[SCORE_DYNAMICS] ${dynParts.join(" | ")}`);
      }
    }

    // P1: Crypto Profile (CoinGecko metadata — crypto only)
    if (assetType === "CRYPTO" && enrich.metadata) {
      const meta = enrich.metadata as Record<string, unknown>;
      const cg = meta.coingecko as Record<string, unknown> | undefined;

      // Supply & Market Structure
      const cryptoParts: string[] = [];
      if (meta.circulatingSupply != null) cryptoParts.push(`CircSupply:${fmtLarge(meta.circulatingSupply as number)}`);
      if (meta.maxSupply != null) cryptoParts.push(`MaxSupply:${fmtLarge(meta.maxSupply as number)}`);
      if (meta.circulatingSupply != null && meta.maxSupply != null && Number(meta.maxSupply) > 0) {
        cryptoParts.push(`Mined:${((Number(meta.circulatingSupply) / Number(meta.maxSupply)) * 100).toFixed(1)}%`);
      }
      if (meta.volume24Hr != null) cryptoParts.push(`Vol24h:$${fmtLarge(meta.volume24Hr as number)}`);
      if (cg?.fullyDilutedValuation != null) cryptoParts.push(`FDV:$${fmtLarge(cg.fullyDilutedValuation as number)}`);
      if (cg?.marketCapRank != null) cryptoParts.push(`Rank:#${cg.marketCapRank}`);
      if (cryptoParts.length > 0) {
        lines.push(`[CRYPTO_MARKET] ${cryptoParts.join(" | ")}`);
      }

      // ATH/ATL
      const athParts: string[] = [];
      if (cg?.ath != null) athParts.push(`ATH:$${(cg.ath as number).toFixed(2)}`);
      if (cg?.athChangePercentage != null) athParts.push(`FromATH:${(cg.athChangePercentage as number).toFixed(1)}%`);
      if (cg?.athDate) athParts.push(`ATHDate:${(cg.athDate as string).split("T")[0]}`);
      if (cg?.atl != null) athParts.push(`ATL:$${(cg.atl as number).toFixed(6)}`);
      if (cg?.atlChangePercentage != null) athParts.push(`FromATL:+${(cg.atlChangePercentage as number).toFixed(0)}%`);
      if (athParts.length > 0) {
        lines.push(`[CRYPTO_ATH_ATL] ${athParts.join(" | ")}`);
      }

      // Multi-timeframe momentum
      const momParts: string[] = [];
      const momFields: [string, string][] = [
        ["priceChangePercentage7d", "7D"], ["priceChangePercentage14d", "14D"],
        ["priceChangePercentage30d", "30D"], ["priceChangePercentage60d", "60D"],
        ["priceChangePercentage200d", "200D"], ["priceChangePercentage1y", "1Y"],
      ];
      if (cg) {
        for (const [field, label] of momFields) {
          const v = cg[field] as number | undefined;
          if (v != null) momParts.push(`${label}:${v >= 0 ? "+" : ""}${v.toFixed(1)}%`);
        }
      }
      if (momParts.length > 0) {
        lines.push(`[CRYPTO_MOMENTUM] ${momParts.join(" | ")}`);
      }

      // Sentiment & Categories
      const sentParts: string[] = [];
      if (cg?.sentimentVotesUpPercentage != null) sentParts.push(`Bullish:${(cg.sentimentVotesUpPercentage as number).toFixed(0)}%`);
      if (cg?.sentimentVotesDownPercentage != null) sentParts.push(`Bearish:${(cg.sentimentVotesDownPercentage as number).toFixed(0)}%`);
      if (sentParts.length > 0) {
        lines.push(`[CRYPTO_SENTIMENT] ${sentParts.join(" | ")}`);
      }

      const cats = cg?.categories as string[] | undefined;
      if (cats?.length) {
        lines.push(`[CRYPTO_CATEGORIES] ${cats.slice(0, 5).join(", ")}`);
      }

      if (cg?.genesisDate) {
        lines.push(`[CRYPTO_GENESIS] ${cg.genesisDate}`);
      }

      // Description (truncated to 80 chars — captures identity, drops marketing copy)
      if (enrich.description) {
        lines.push(`[CRYPTO_ABOUT] ${truncateDesc(enrich.description, 80)}`);
      }
    }

    // PRUNING: Only send [COMPANY_PROFILE] for COMPLEX tier (too much noise for MODERATE)
    if (opts.tier === "COMPLEX" && (assetType === "STOCK" || assetType === "ETF") && (enrich.description || enrich.industry)) {
      const profileParts: string[] = [];
      if (enrich.industry) profileParts.push(`Industry:${enrich.industry}`);
      if (enrich.sector && enrich.sector !== enrich.industry) profileParts.push(`Sector:${enrich.sector}`);
      if (enrich.description) {
        profileParts.push(`About:${truncateDesc(enrich.description, 80)}`);
      }
      if (profileParts.length > 0) {
        lines.push(`[COMPANY_PROFILE] ${profileParts.join(" | ")}`);
      }
    }

    // PRUNING: Only send sentiment in COMPLEX (analysts sufficient for MODERATE)
    if (opts.tier === "COMPLEX" && (assetType === "STOCK" || assetType === "ETF") && enrich.metadata) {
      const meta = enrich.metadata as Record<string, unknown>;

      // Analyst Consensus
      const analyst = meta.finnhubAnalyst as { recommendations?: { consensus?: string; strongBuy?: number; buy?: number; hold?: number; sell?: number }; priceTarget?: { mean?: number; high?: number; low?: number } } | undefined;
      if (analyst?.recommendations) {
        const r = analyst.recommendations;
        const aParts = [`Consensus:${r.consensus || "N/A"}`];
        if (r.strongBuy != null) aParts.push(`StrongBuy:${r.strongBuy}`);
        if (r.buy != null) aParts.push(`Buy:${r.buy}`);
        if (r.hold != null) aParts.push(`Hold:${r.hold}`);
        if (r.sell != null) aParts.push(`Sell:${r.sell}`);
        lines.push(`[ANALYST_CONSENSUS] ${aParts.join(" | ")}`);
      }
      if (analyst?.priceTarget?.mean != null) {
        const pt = analyst.priceTarget;
        const ptParts = [`Mean:${cs}${pt.mean!.toFixed(0)}`];
        if (pt.high != null) ptParts.push(`High:${cs}${pt.high.toFixed(0)}`);
        if (pt.low != null) ptParts.push(`Low:${cs}${pt.low.toFixed(0)}`);
        if (pd?.price) {
          const upside = ((pt.mean! - pd.price) / pd.price * 100);
          ptParts.push(`Upside:${upside >= 0 ? "+" : ""}${upside.toFixed(1)}%`);
        }
        lines.push(`[PRICE_TARGET] ${ptParts.join(" | ")}`);
      }

      // Insider Sentiment
      const insider = meta.insiderSentiment as { signal?: string; avgMSPR?: number; totalShareChange6m?: number } | undefined;
      if (insider?.signal) {
        const iParts = [`Signal:${insider.signal}`];
        if (insider.avgMSPR != null) iParts.push(`MSPR:${insider.avgMSPR.toFixed(3)}`);
        if (insider.totalShareChange6m != null) iParts.push(`NetShares6m:${insider.totalShareChange6m.toLocaleString()}`);
        lines.push(`[INSIDER_SENTIMENT] ${iParts.join(" | ")}`);
      }

      // News Sentiment (Finnhub)
      const fhSent = meta.finnhubSentiment as { companyNewsScore?: number; bullishPercent?: number; bearishPercent?: number; buzz?: number } | undefined;
      if (fhSent?.companyNewsScore != null) {
        const sParts = [`NewsScore:${fhSent.companyNewsScore.toFixed(2)}`];
        if (fhSent.bullishPercent != null) sParts.push(`Bull:${fhSent.bullishPercent.toFixed(0)}%`);
        if (fhSent.bearishPercent != null) sParts.push(`Bear:${fhSent.bearishPercent.toFixed(0)}%`);
        if (fhSent.buzz != null) sParts.push(`Buzz:${fhSent.buzz.toFixed(2)}`);
        lines.push(`[NEWS_SENTIMENT] ${sParts.join(" | ")}`);
      }

      // Finnhub Financials
      const fhFin = meta.finnhubFinancials as Record<string, number | null | undefined> | undefined;
      const valHasRoe = enrich.roe != null;
      const finHasDE = enrich.financials?.debtToEquity != null;
      if (fhFin) {
        const fParts: string[] = [];
        if (!valHasRoe && fhFin.roe != null) fParts.push(`ROE:${fhFin.roe.toFixed(1)}%`);
        if (fhFin.roa != null) fParts.push(`ROA:${fhFin.roa.toFixed(1)}%`);
        if (fhFin.grossMargin != null) fParts.push(`GrossM:${fhFin.grossMargin.toFixed(1)}%`);
        if (fhFin.epsGrowth != null) fParts.push(`EPSGrowth:${fhFin.epsGrowth.toFixed(1)}%`);
        if (fhFin.revenueGrowth != null) fParts.push(`RevGrowth:${fhFin.revenueGrowth.toFixed(1)}%`);
        if (fhFin.beta != null) fParts.push(`Beta:${fhFin.beta.toFixed(2)}`);
        if (!finHasDE && fhFin.debtToEquity != null) fParts.push(`D/E:${fhFin.debtToEquity.toFixed(1)}`);
        if (fParts.length > 0) lines.push(`[FINNHUB_FINANCIALS] ${fParts.join(" | ")}`);
      }

      // Peers
      const peers = meta.finnhubPeers as string[] | undefined;
      if (peers?.length) {
        const mentionedSet = new Set((opts.mentionedSymbols || []).map(s => s.toUpperCase()));
        const filteredPeers = peers
          .filter(p => !mentionedSet.has(p.toUpperCase()))
          .slice(0, 5);
        if (filteredPeers.length > 0) {
          lines.push(`[PEERS] ${filteredPeers.join(", ")}`);
        }
      }
    }

    // P1: Mutual Fund Profile (category, fund house, NAV)
    if (assetType === "MUTUAL_FUND") {
      const mfParts: string[] = [];
      if (enrich.fundHouse) mfParts.push(`FundHouse:${enrich.fundHouse}`);
      if (enrich.category) mfParts.push(`Category:${enrich.category}`);
      if (enrich.nav != null) mfParts.push(`NAV:₹${enrich.nav.toFixed(2)}`);
      if (mfParts.length > 0) {
        lines.push(`[MF_PROFILE] ${mfParts.join(" | ")}`);
      }
    }

    // P1: Financial Highlights (stocks only — key metrics from latest annual)
    if (assetType === "STOCK" && enrich.financials) {
      const fin = enrich.financials as {
        incomeStatement?: { totalRevenue?: number | null; netIncome?: number | null; grossProfit?: number | null };
        balanceSheet?: { totalAssets?: number | null; totalEquity?: number | null; cash?: number | null; longTermDebt?: number | null };
        cashflow?: { freeCashFlow?: number | null; operatingCashflow?: number | null };
        debtToEquity?: number | null; currentRatio?: number | null;
      };
      const finParts: string[] = [];
      if (fin.incomeStatement?.totalRevenue != null) finParts.push(`Rev:$${fmtLarge(fin.incomeStatement.totalRevenue)}`);
      if (fin.incomeStatement?.netIncome != null) finParts.push(`NetInc:$${fmtLarge(fin.incomeStatement.netIncome)}`);
      if (fin.balanceSheet?.cash != null) finParts.push(`Cash:$${fmtLarge(fin.balanceSheet.cash)}`);
      if (fin.balanceSheet?.longTermDebt != null) finParts.push(`LTDebt:$${fmtLarge(fin.balanceSheet.longTermDebt)}`);
      if (fin.cashflow?.freeCashFlow != null) finParts.push(`FCF:$${fmtLarge(fin.cashflow.freeCashFlow)}`);
      if (fin.debtToEquity != null) finParts.push(`D/E:${(fin.debtToEquity/100).toFixed(1)}x`);
      if (finParts.length > 0) {
        lines.push(`[FINANCIALS] ${finParts.join(" | ")}`);
      }
    }

    // P1: ETF Composition (top holdings — ETFs only)
    if (assetType === "ETF") {
      const th = enrich.topHoldings as {
        holdings?: Array<{ name?: string | null; symbol?: string | null; weight?: number | null }>;
      } | null;
      if (th?.holdings?.length) {
        const top5 = th.holdings.slice(0, 5)
          .map(h => `${h.symbol || h.name || "?"}:${h.weight != null ? (h.weight * 100).toFixed(1) + "%" : "?"}`)
          .join(", ");
        lines.push(`[ETF_TOP_HOLDINGS] ${top5}`);
      }
    }

    // P1: ETF Lookthrough Intelligence (ETFs only — factor exposure, concentration, risk, behavioral profile)
    if (assetType === "ETF" && enrich.etfLookthrough) {
      const lt = enrich.etfLookthrough as {
        concentration?: { hhi?: number; top5Weight?: number; level?: string; holdingCount?: number };
        factorExposure?: { value?: number; growth?: number; momentum?: number; quality?: number; size?: number; dominant?: string };
        geographic?: { US?: number; IN?: number; other?: number; matchRate?: number };
        lookthroughScores?: { trend?: number | null; momentum?: number | null; volatility?: number | null; weightedAvg?: number | null; matchRate?: number };
        behavioral?: string;
        risk?: { level?: string; factors?: string[]; tracking?: { trackingError?: number | null; correlation?: number | null }; expense?: { annualImpactBps?: number | null } };
      };

      // Factor exposure
      if (lt.factorExposure) {
        const fe = lt.factorExposure;
        const feParts = [`Dominant:${fe.dominant || "balanced"}`];
        if (fe.value) feParts.push(`Val:${fe.value}`);
        if (fe.growth) feParts.push(`Gro:${fe.growth}`);
        if (fe.momentum) feParts.push(`Mom:${fe.momentum}`);
        if (fe.quality) feParts.push(`Qua:${fe.quality}`);
        lines.push(`[ETF_FACTORS] ${feParts.join(" ")}`);
      }

      // Concentration + behavioral
      const ltParts: string[] = [];
      if (lt.concentration?.hhi != null) ltParts.push(`HHI:${lt.concentration.hhi.toFixed(3)}`);
      if (lt.concentration?.top5Weight != null) ltParts.push(`Top5:${lt.concentration.top5Weight.toFixed(1)}%`);
      if (lt.concentration?.level) ltParts.push(`Conc:${lt.concentration.level}`);
      if (lt.behavioral) ltParts.push(`Profile:${lt.behavioral}`);
      if (ltParts.length > 0) lines.push(`[ETF_LOOKTHROUGH] ${ltParts.join(" | ")}`);

      // Risk summary
      if (lt.risk) {
        const rParts = [`Level:${lt.risk.level || "low"}`];
        if (lt.risk.tracking?.trackingError != null) rParts.push(`TE:${(lt.risk.tracking.trackingError * 100).toFixed(2)}%`);
        if (lt.risk.tracking?.correlation != null) rParts.push(`BenchCorr:${lt.risk.tracking.correlation.toFixed(2)}`);
        if (lt.risk.expense?.annualImpactBps != null) rParts.push(`Expense:${lt.risk.expense.annualImpactBps}bps`);
        lines.push(`[ETF_RISK] ${rParts.join(" | ")}`);
        if (lt.risk.factors?.length) {
          lines.push(`[ETF_RISK_FACTORS] ${lt.risk.factors.slice(0, 3).join("; ")}`);
        }
      }

      // Lookthrough scores
      if (lt.lookthroughScores?.weightedAvg != null) {
        const ls = lt.lookthroughScores;
        const lsParts = [`Avg:${ls.weightedAvg}`];
        if (ls.trend != null) lsParts.push(`Trend:${ls.trend}`);
        if (ls.momentum != null) lsParts.push(`Mom:${ls.momentum}`);
        if (ls.volatility != null) lsParts.push(`Vol:${ls.volatility}`);
        if (ls.matchRate) lsParts.push(`Match:${ls.matchRate.toFixed(0)}%`);
        lines.push(`[ETF_CONSTITUENT_SCORES] ${lsParts.join(" ")}`);
      }
    }

    // P1: Fund Returns (ETFs + Mutual Funds — both have fundPerformanceHistory)
    if ((assetType === "ETF" || assetType === "MUTUAL_FUND") && enrich.fundPerformanceHistory) {
      const fp = enrich.fundPerformanceHistory as {
        ytd?: number | null; oneYear?: number | null; threeYear?: number | null; fiveYear?: number | null;
      };
      const fpParts: string[] = [];
      if (fp.ytd != null) fpParts.push(`YTD:${fp.ytd >= 0 ? "+" : ""}${fp.ytd.toFixed(1)}%`);
      if (fp.oneYear != null) fpParts.push(`1Y:${fp.oneYear >= 0 ? "+" : ""}${fp.oneYear.toFixed(1)}%`);
      if (fp.threeYear != null) fpParts.push(`3Y:${fp.threeYear >= 0 ? "+" : ""}${fp.threeYear.toFixed(1)}%`);
      if (fp.fiveYear != null) fpParts.push(`5Y:${fp.fiveYear >= 0 ? "+" : ""}${fp.fiveYear.toFixed(1)}%`);
      if (fpParts.length > 0) {
        const tag = assetType === "ETF" ? "ETF_FUND_RETURNS" : "MF_RETURNS";
        lines.push(`[${tag}] ${fpParts.join(" | ")}`);
      }
    }

    // P1: MF Lookthrough Intelligence (Mutual Funds only — style analysis, concentration, risk, behavioral profile)
    if (assetType === "MUTUAL_FUND" && enrich.mfLookthrough) {
      const lt = enrich.mfLookthrough as {
        concentration?: { hhi?: number; top5Weight?: number; level?: string; holdingCount?: number };
        styleAnalysis?: { declaredCategory?: string; actualLargeCapPct?: number; actualMidCapPct?: number; actualSmallCapPct?: number; styleDriftDetected?: boolean; driftDescription?: string | null };
        lookthroughScores?: { trend?: number | null; momentum?: number | null; volatility?: number | null; weightedAvg?: number | null; matchRate?: number };
        behavioral?: string;
        risk?: { level?: string; factors?: string[]; styleDrift?: { detected?: boolean; description?: string | null }; benchmarkTracking?: { rSquared?: number | null; isClosetIndexer?: boolean }; expense?: { annualImpactBps?: number | null }; drawdown?: { maxDrawdown?: number | null } };
      };

      // Style analysis + concentration
      const ltParts: string[] = [];
      if (lt.styleAnalysis?.declaredCategory) ltParts.push(`Cat:${lt.styleAnalysis.declaredCategory}`);
      if (lt.styleAnalysis?.actualLargeCapPct != null) ltParts.push(`Large:${lt.styleAnalysis.actualLargeCapPct.toFixed(0)}%`);
      if (lt.styleAnalysis?.actualMidCapPct != null) ltParts.push(`Mid:${lt.styleAnalysis.actualMidCapPct.toFixed(0)}%`);
      if (lt.styleAnalysis?.actualSmallCapPct != null) ltParts.push(`Small:${lt.styleAnalysis.actualSmallCapPct.toFixed(0)}%`);
      if (lt.concentration?.hhi != null) ltParts.push(`HHI:${lt.concentration.hhi.toFixed(3)}`);
      if (lt.concentration?.level) ltParts.push(`Conc:${lt.concentration.level}`);
      if (lt.behavioral) ltParts.push(`Profile:${lt.behavioral}`);
      if (ltParts.length > 0) lines.push(`[MF_LOOKTHROUGH] ${ltParts.join(" | ")}`);

      // Style drift
      if (lt.styleAnalysis?.styleDriftDetected && lt.styleAnalysis.driftDescription) {
        lines.push(`[MF_STYLE_DRIFT] ${lt.styleAnalysis.driftDescription}`);
      }

      // Risk summary
      if (lt.risk) {
        const rParts = [`Level:${lt.risk.level || "low"}`];
        if (lt.risk.expense?.annualImpactBps != null) rParts.push(`Expense:${lt.risk.expense.annualImpactBps}bps`);
        if (lt.risk.drawdown?.maxDrawdown != null) rParts.push(`MaxDD:${lt.risk.drawdown.maxDrawdown.toFixed(1)}%`);
        if (lt.risk.benchmarkTracking?.rSquared != null) rParts.push(`R²:${lt.risk.benchmarkTracking.rSquared.toFixed(2)}`);
        if (lt.risk.benchmarkTracking?.isClosetIndexer) rParts.push(`ClosetIndexer:YES`);
        lines.push(`[MF_RISK] ${rParts.join(" | ")}`);
        if (lt.risk.factors?.length) {
          lines.push(`[MF_RISK_FACTORS] ${lt.risk.factors.slice(0, 3).join("; ")}`);
        }
      }

      // Lookthrough scores
      if (lt.lookthroughScores?.weightedAvg != null) {
        const ls = lt.lookthroughScores;
        const lsParts = [`Avg:${ls.weightedAvg}`];
        if (ls.trend != null) lsParts.push(`Trend:${ls.trend}`);
        if (ls.momentum != null) lsParts.push(`Mom:${ls.momentum}`);
        if (ls.volatility != null) lsParts.push(`Vol:${ls.volatility}`);
        if (ls.matchRate) lsParts.push(`Match:${ls.matchRate.toFixed(0)}%`);
        lines.push(`[MF_CONSTITUENT_SCORES] ${lsParts.join(" ")}`);
      }
    }

    // P1: Commodity Intelligence (Commodities only — regime sensitivity, seasonality, correlations, structural context)
    if (assetType === "COMMODITY" && enrich.commodityIntelligence) {
      const ci = enrich.commodityIntelligence as {
        regimeProfile?: { safeHavenScore?: number; inflationSensitivity?: number; usdSensitivity?: number; dominantRegime?: string; conditionedReturns?: { regime: string; avgReturn: number; count: number }[] };
        seasonality?: { currentMonthSignal?: string; currentMonthAvgReturn?: number; strongestMonth?: string; weakestMonth?: string };
        correlations?: { topCorrelated?: { symbol: string; name: string; correlation: number }[]; topAntiCorrelated?: { symbol: string; name: string; correlation: number }[]; clusterGroup?: string; diversificationValue?: string; avgCrossCorrelation?: number };
        structuralContext?: { cluster?: string; supplyContext?: string; demandDrivers?: string; geopoliticalSensitivity?: string; storageCost?: string; inflationHedge?: boolean; safeHavenCandidate?: boolean; seasonalNotes?: string };
      };

      // Regime profile
      if (ci.regimeProfile) {
        const rp = ci.regimeProfile;
        const rpParts: string[] = [];
        if (rp.dominantRegime) rpParts.push(`BestRegime:${formatRegimeLabel(rp.dominantRegime)}`);
        if (rp.safeHavenScore != null) rpParts.push(`SafeHaven:${rp.safeHavenScore}/100`);
        if (rp.inflationSensitivity != null) rpParts.push(`InflCorr:${rp.inflationSensitivity.toFixed(2)}`);
        if (rp.usdSensitivity != null) rpParts.push(`USDCorr:${rp.usdSensitivity.toFixed(2)}`);
        if (rpParts.length > 0) lines.push(`[COMMODITY_REGIME] ${rpParts.join(" | ")}`);

        // Conditioned returns summary
        if (rp.conditionedReturns?.length) {
          const crParts = rp.conditionedReturns
            .filter(cr => cr.count > 5)
            .map(cr => `${formatRegimeLabel(cr.regime)}:${cr.avgReturn >= 0 ? "+" : ""}${cr.avgReturn.toFixed(2)}%`)
            .join(" ");
          if (crParts) lines.push(`[COMMODITY_REGIME_RETURNS] ${crParts}`);
        }
      }

      // Seasonality
      if (ci.seasonality) {
        const sp = ci.seasonality;
        const spParts: string[] = [];
        if (sp.currentMonthSignal) spParts.push(`CurrentSignal:${sp.currentMonthSignal}`);
        if (sp.currentMonthAvgReturn != null) spParts.push(`CurrentAvg:${sp.currentMonthAvgReturn >= 0 ? "+" : ""}${sp.currentMonthAvgReturn.toFixed(1)}%`);
        if (sp.strongestMonth) spParts.push(`Best:${sp.strongestMonth}`);
        if (sp.weakestMonth) spParts.push(`Worst:${sp.weakestMonth}`);
        if (spParts.length > 0) lines.push(`[COMMODITY_SEASONAL] ${spParts.join(" | ")}`);
      }

      // Correlations
      if (ci.correlations) {
        const cp = ci.correlations;
        const cpParts: string[] = [];
        if (cp.clusterGroup) cpParts.push(`Cluster:${cp.clusterGroup}`);
        if (cp.diversificationValue) cpParts.push(`DivValue:${cp.diversificationValue}`);
        if (cp.avgCrossCorrelation != null) cpParts.push(`AvgCorr:${cp.avgCrossCorrelation.toFixed(2)}`);
        if (cp.topCorrelated?.length) {
          cpParts.push(`Top+:${cp.topCorrelated.slice(0, 3).map(c => `${c.name}(${c.correlation.toFixed(2)})`).join(",")}`);
        }
        if (cp.topAntiCorrelated?.length) {
          cpParts.push(`Top-:${cp.topAntiCorrelated.slice(0, 3).map(c => `${c.name}(${c.correlation.toFixed(2)})`).join(",")}`);
        }
        if (cpParts.length > 0) lines.push(`[COMMODITY_CORRELATIONS] ${cpParts.join(" | ")}`);
      }

      // Structural context
      if (ci.structuralContext) {
        const sc = ci.structuralContext;
        const scParts: string[] = [];
        if (sc.cluster) scParts.push(`Type:${sc.cluster}`);
        if (sc.geopoliticalSensitivity) scParts.push(`GeoPol:${sc.geopoliticalSensitivity}`);
        if (sc.storageCost) scParts.push(`Storage:${sc.storageCost}`);
        if (sc.inflationHedge) scParts.push(`InflHedge:YES`);
        if (sc.safeHavenCandidate) scParts.push(`SafeHaven:YES`);
        if (scParts.length > 0) lines.push(`[COMMODITY_STRUCTURAL] ${scParts.join(" | ")}`);
        if (sc.supplyContext) lines.push(`[COMMODITY_SUPPLY] ${sc.supplyContext}`);
        if (sc.demandDrivers) lines.push(`[COMMODITY_DEMAND] ${sc.demandDrivers}`);
        if (sc.seasonalNotes) lines.push(`[COMMODITY_SEASONAL_NOTES] ${sc.seasonalNotes}`);
      }
    }

    // P1: Crypto Intelligence (Crypto only — network activity, holder stability, liquidity risk, structural risk, enhanced trust)
    if (assetType === "CRYPTO" && enrich.cryptoIntelligence) {
      const ci = enrich.cryptoIntelligence as {
        networkActivity?: { score?: number; devActivity?: number; tvlHealth?: number; communityEngagement?: number; onChainActivity?: number; drivers?: string[] };
        holderStability?: { score?: number; supplyConcentration?: number; buyPressure?: number; marketCapToFDV?: number; priceStability?: number; drivers?: string[] };
        liquidityRisk?: { score?: number; volumeToMcap?: number; dexLiquidity?: number; exchangePresence?: number; poolConcentration?: number; drivers?: string[]; poolSummary?: { totalReserveUsd?: number; totalVolume24h?: number; totalPools?: number; dexCount?: number; buyToSellRatio?: number } };
        structuralRisk?: { dependencyRisk?: { level?: string; description?: string }; governanceRisk?: { level?: string; description?: string }; maturityRisk?: { level?: string; description?: string }; overallLevel?: string };
        enhancedTrust?: { score?: number; level?: string };
        tvlData?: { tvl?: number | null; protocolCount?: number | null; category?: string | null; isChain?: boolean };
      };

      // Network Activity
      if (ci.networkActivity?.score != null) {
        const na = ci.networkActivity;
        const naParts = [`Score:${na.score}/100`];
        if (na.devActivity != null) naParts.push(`Dev:${na.devActivity}`);
        if (na.tvlHealth != null) naParts.push(`TVL:${na.tvlHealth}`);
        if (na.communityEngagement != null) naParts.push(`Community:${na.communityEngagement}`);
        if (na.onChainActivity != null) naParts.push(`OnChain:${na.onChainActivity}`);
        lines.push(`[CRYPTO_NETWORK_ACTIVITY] ${naParts.join(" | ")}`);
        if (na.drivers?.length) lines.push(`[CRYPTO_NETWORK_DRIVERS] ${na.drivers.slice(0, 4).join("; ")}`);
      }

      // Holder Stability
      if (ci.holderStability?.score != null) {
        const hs = ci.holderStability;
        const hsParts = [`Score:${hs.score}/100`];
        if (hs.supplyConcentration != null) hsParts.push(`Supply:${hs.supplyConcentration}`);
        if (hs.buyPressure != null) hsParts.push(`BuyPressure:${hs.buyPressure}`);
        if (hs.marketCapToFDV != null) hsParts.push(`MCap/FDV:${hs.marketCapToFDV}`);
        if (hs.priceStability != null) hsParts.push(`Stability:${hs.priceStability}`);
        lines.push(`[CRYPTO_HOLDER_STABILITY] ${hsParts.join(" | ")}`);
        if (hs.drivers?.length) lines.push(`[CRYPTO_HOLDER_DRIVERS] ${hs.drivers.slice(0, 4).join("; ")}`);
      }

      // Liquidity Risk
      if (ci.liquidityRisk?.score != null) {
        const lr = ci.liquidityRisk;
        const lrParts = [`Score:${lr.score}/100`];
        if (lr.volumeToMcap != null) lrParts.push(`Vol/MCap:${lr.volumeToMcap}`);
        if (lr.dexLiquidity != null) lrParts.push(`DEXLiq:${lr.dexLiquidity}`);
        if (lr.poolSummary?.totalReserveUsd) lrParts.push(`Reserve:$${(lr.poolSummary.totalReserveUsd / 1e6).toFixed(1)}M`);
        if (lr.poolSummary?.totalPools) lrParts.push(`Pools:${lr.poolSummary.totalPools}`);
        if (lr.poolSummary?.dexCount) lrParts.push(`DEXs:${lr.poolSummary.dexCount}`);
        lines.push(`[CRYPTO_LIQUIDITY_RISK] ${lrParts.join(" | ")}`);
        if (lr.drivers?.length) lines.push(`[CRYPTO_LIQUIDITY_DRIVERS] ${lr.drivers.slice(0, 4).join("; ")}`);
      }

      // Structural Risk
      if (ci.structuralRisk?.overallLevel) {
        const sr = ci.structuralRisk;
        const srParts = [`Overall:${sr.overallLevel}`];
        if (sr.dependencyRisk?.level) srParts.push(`Dependency:${sr.dependencyRisk.level}`);
        if (sr.governanceRisk?.level) srParts.push(`Governance:${sr.governanceRisk.level}`);
        if (sr.maturityRisk?.level) srParts.push(`Maturity:${sr.maturityRisk.level}`);
        lines.push(`[CRYPTO_STRUCTURAL_RISK] ${srParts.join(" | ")}`);
      }

      // Enhanced Trust
      if (ci.enhancedTrust?.score != null) {
        lines.push(`[CRYPTO_ENHANCED_TRUST] Score:${ci.enhancedTrust.score}/100 | Level:${ci.enhancedTrust.level || "unknown"}`);
      }

      // TVL Data
      if (ci.tvlData?.tvl) {
        const tvl = ci.tvlData;
        const tvlVal = tvl.tvl as number; // narrowed by outer truthy check
        const tvlParts = [`TVL:$${(tvlVal / 1e9).toFixed(2)}B`];
        if (tvl.category) tvlParts.push(`Cat:${tvl.category}`);
        if (tvl.protocolCount) tvlParts.push(`Protocols:${tvl.protocolCount}`);
        tvlParts.push(tvl.isChain ? "Type:Chain" : "Type:Protocol");
        lines.push(`[CRYPTO_TVL] ${tvlParts.join(" | ")}`);
      }
    }

    // P2: Factor DNA (Elite/Enterprise tier + stocks only)
    if ((opts.userPlan === "ELITE" || opts.userPlan === "ENTERPRISE") && assetType === "STOCK" && enrich.factorAlignment) {
      const fa = enrich.factorAlignment as {
        score?: number; regimeFit?: string; dominantFactor?: string;
        breakdown?: Record<string, number>;
      };
      if (fa.score != null) {
        const parts = [`Score:${fa.score}`];
        if (fa.regimeFit) parts.push(`Fit:${fa.regimeFit}`);
        if (fa.dominantFactor) parts.push(`Dominant:${fa.dominantFactor}`);
        if (fa.breakdown) {
          const bp = Object.entries(fa.breakdown)
            .filter(([, v]) => v != null)
            .map(([k, v]) => `${capitalize(k)}:${v}`)
            .join(" ");
          if (bp) parts.push(bp);
        }
        lines.push(`[FACTOR_DNA] ${parts.join(" | ")}`);
      }
    }
  }

  // --- Portfolio Health Context (injected from portfolio page) ---
  const ph = context.portfolioHealth as Record<string, unknown> | undefined;
  if (ph) {
    const phParts: string[] = [];
    if (ph.healthScore != null) phParts.push(`Score:${ph.healthScore}`);
    if (ph.band) phParts.push(`Band:${ph.band}`);
    if (ph.holdingCount != null) phParts.push(`Holdings:${ph.holdingCount}`);
    if (ph.regime) phParts.push(`Regime:${formatRegimeLabel(ph.regime as string)}`);
    if (phParts.length > 0) lines.push(`[PORTFOLIO_HEALTH] ${phParts.join(" | ")}`);

    const dims = ph.dimensions as Record<string, number> | undefined;
    if (dims) {
      const dimParts = Object.entries(dims)
        .filter(([, v]) => v != null)
        .map(([k, v]) => `${k.replace("Score", "")}:${v}`);
      if (dimParts.length > 0) lines.push(`[PORTFOLIO_DIMENSIONS] ${dimParts.join(" | ")}`);
    }
  }

  // --- Portfolio Fragility Context ---
  const pf = context.portfolioFragility as Record<string, unknown> | undefined;
  if (pf) {
    const pfParts: string[] = [];
    if (pf.fragilityScore != null) pfParts.push(`Score:${pf.fragilityScore}`);
    if (pf.classification) pfParts.push(`Class:${pf.classification}`);
    if (pfParts.length > 0) lines.push(`[PORTFOLIO_FRAGILITY] ${pfParts.join(" | ")}`);
    const drivers = pf.topDrivers as string[] | undefined;
    if (drivers?.length) lines.push(`[PORTFOLIO_FRAGILITY_DRIVERS] ${drivers.join("; ")}`);
  }

  // --- Portfolio Simulation Context ---
  const ps = context.portfolioSimulation as Record<string, unknown> | undefined;
  if (ps) {
    const psParts: string[] = [];
    if (ps.expectedReturn != null) psParts.push(`ExpRet:${((ps.expectedReturn as number) * 100).toFixed(2)}%`);
    if (ps.var5 != null) psParts.push(`VaR5:${((ps.var5 as number) * 100).toFixed(2)}%`);
    if (ps.es5 != null) psParts.push(`ES5:${((ps.es5 as number) * 100).toFixed(2)}%`);
    if (ps.maxDrawdownMean != null) psParts.push(`MaxDD:${((ps.maxDrawdownMean as number) * 100).toFixed(1)}%`);
    if (ps.fragilityMean != null) psParts.push(`Fragility:${ps.fragilityMean}`);
    if (ps.mode) psParts.push(`Mode:${ps.mode}`);
    if (ps.horizon) psParts.push(`Horizon:${ps.horizon}d`);
    if (psParts.length > 0) lines.push(`[PORTFOLIO_SIMULATION] ${psParts.join(" | ")}`);
  }

  // --- Institutional Knowledge (RAG) ---
  const trimmedKnowledgeContext = (() => {
    if (!opts.knowledgeContext) return "";
    const query = (opts.query || "").toLowerCase();
    const needsFreshEvidence = /\b(?:news|latest|today|current|recent|earnings|guidance|headline|update|catalyst)\b/.test(query);
    const isBusinessOrValuationFocus = /\b(?:business|model|revenue|moat|growth|valuation|multiple|pe\b|p\/e|pb\b|p\/b|risk|downside)\b/.test(query);

    if (responseMode === "compare") return truncateAtSentence(opts.knowledgeContext, needsFreshEvidence ? 2400 : 2200);
    if (responseMode === "stress-test") return truncateAtSentence(opts.knowledgeContext, needsFreshEvidence ? 2800 : 2400);
    if (responseMode === "portfolio") return truncateAtSentence(opts.knowledgeContext, 2600);
    if (opts.tier === "MODERATE") {
      return truncateAtSentence(opts.knowledgeContext, isBusinessOrValuationFocus ? 1800 : 2200);
    }
    if (opts.tier === "COMPLEX") {
      return truncateAtSentence(opts.knowledgeContext, needsFreshEvidence ? 3200 : 2800);
    }
    return opts.knowledgeContext;
  })();
  if (trimmedKnowledgeContext) {
    lines.push("");
    lines.push(`[INSTITUTIONAL_KNOWLEDGE]`);
    lines.push(trimmedKnowledgeContext);
  }

  // --- User Memory (RAG) ---
  const trimmedMemoryContext = responseMode === "compare" || responseMode === "stress-test"
    ? (opts.memoryContext ? truncateAtSentence(opts.memoryContext, 320) : undefined)
    : (opts.memoryContext ? truncateAtSentence(opts.memoryContext, 520) : undefined);
  if (trimmedMemoryContext) {
    lines.push("");
    lines.push(`[USER_MEMORY]`);
    lines.push(trimmedMemoryContext);
  }

  // --- User Profile (global memory notes — cross-session durable facts) ---
  // Tighter cap for compare/stress-test modes (cost-sensitive). Use truncateAtSentence for clean cut.
  const globalNotesLimit = responseMode === "compare" || responseMode === "stress-test" ? 300 : 600;
  const trimmedGlobalNotes = opts.globalNotes
    ? truncateAtSentence(opts.globalNotes, globalNotesLimit)
    : undefined;
  if (trimmedGlobalNotes && opts.tier !== "SIMPLE") {
    lines.push("");
    lines.push(`[USER_PROFILE]`);
    lines.push(trimmedGlobalNotes);
  }

  // --- Session Context (session-scoped notes — current session signals) ---
  // Skipped entirely in compare/stress-test modes (not relevant for cross-asset analysis).
  const sessionNotesLimit = responseMode === "compare" || responseMode === "stress-test" ? 0 : 320;
  const trimmedSessionNotes = opts.sessionNotes && sessionNotesLimit > 0
    ? truncateAtSentence(opts.sessionNotes, sessionNotesLimit)
    : undefined;
  if (trimmedSessionNotes && opts.tier !== "SIMPLE") {
    lines.push("");
    lines.push(`[SESSION_CONTEXT]`);
    lines.push(trimmedSessionNotes);
  }

  // --- Cross-Sector Correlation ---
  const trimmedCrossSectorContext = responseMode === "compare" || responseMode === "stress-test"
    ? (opts.crossSectorContext ? truncateAtSentence(opts.crossSectorContext, 400) : undefined)
    : opts.crossSectorContext;
  if (trimmedCrossSectorContext) {
    lines.push("");
    lines.push(trimmedCrossSectorContext.trim());
  }

  // --- Historical Analogs (MODERATE/COMPLEX only — Elite gated in service.ts) ---
  const trimmedHistoricalAnalogContext = responseMode === "compare" || responseMode === "stress-test"
    ? (opts.historicalAnalogContext ? truncateAtSentence(opts.historicalAnalogContext, 450) : undefined)
    : opts.historicalAnalogContext;
  if (trimmedHistoricalAnalogContext && opts.tier !== "SIMPLE") {
    lines.push("");
    lines.push(trimmedHistoricalAnalogContext.trim());
  }

  // --- Behavioral Intelligence (MODERATE/COMPLEX only — coaching context for the model) ---
  // Surfaced as a soft advisory block so Lyra can weave risk mentoring naturally into responses.
  if (opts.behavioralInsights && opts.behavioralInsights.length > 0 && opts.tier !== "SIMPLE") {
    const mentoringMsg = getMentoringMessage(opts.behavioralInsights);
    if (mentoringMsg) {
      lines.push("");
      lines.push(`[BEHAVIORAL_CONTEXT] ${mentoringMsg}`);
    }
  }

  // --- Comparison Context (from Compare Page) ---
  const compCtx = context.compareContext as Array<{
    symbol: string;
    name?: string;
    scores?: Record<string, number | null>;
    signal?: number | null;
    signalLabel?: string;
    factorAlignment?: Record<string, unknown> | null;
    performance?: Record<string, number | null>;
  }> | undefined;
  
  if (compCtx && compCtx.length > 0) {
    lines.push("");
    lines.push(`[COMPARISON_SHARED] Shared regime-aware compare context. Prioritize differences in momentum, risk, and regime fit over repeated company descriptions.`);
    lines.push(`[COMPARISON_DECISION_RUBRIC] Rank assets by upside capture, downside control, and current regime fit. Break ties with cleaner momentum and lower fragility.`);
    compCtx.slice(0, 3).forEach(c => {
      const parts = [`Symbol:${c.symbol}`];
      if (c.name) parts.push(`Name:${c.name}`);
      if (c.signal != null) parts.push(`Signal:${c.signal}${c.signalLabel ? `(${c.signalLabel})` : ""}`);
      if (c.scores) {
        const orderedScores = Object.entries(c.scores)
          .filter(([, v]) => v != null)
          .sort(([a], [b]) => {
            const rank = (key: string) => ["trend", "momentum", "trust", "volatility", "liquidity", "sentiment"].indexOf(key);
            return rank(a) - rank(b);
          })
          .slice(0, 3)
          .map(([k, v]) => `${k}:${Math.round(v as number)}`)
          .join(",");
        if (orderedScores) parts.push(`Scores:[${orderedScores}]`);
      }
      if (c.performance) {
        const perf = Object.entries(c.performance)
          .filter(([, v]) => v != null)
          .slice(0, 3)
          .map(([k, v]) => `${k}:${(v as number) >= 0 ? "+" : ""}${(v as number).toFixed(1)}%`)
          .join(",");
        if (perf) parts.push(`Perf:[${perf}]`);
      }
      if (c.factorAlignment) {
        const f = c.factorAlignment;
        const factor = [
          f.score != null ? `Score:${f.score}` : "",
          f.regimeFit ? `Fit:${f.regimeFit}` : "",
          f.dominantFactor ? `Dominant:${f.dominantFactor}` : "",
        ].filter(Boolean).join(",");
        if (factor) parts.push(`Factor:[${factor}]`);
      }
      lines.push(`[ASSET_CARD] ${parts.join(" | ")}`);
    });
  }

  // --- Available Assets (Smart Subset) ---
  // Only include mentioned symbols + a small curated benchmark set
  const assetList = buildSmartAssetList(
    opts.availableAssets || [],
    opts.mentionedSymbols || [],
    symbol,
  );
  const finalAssetList = responseMode === "compare"
    ? assetList.slice(0, 6)
    : responseMode === "stress-test"
      ? assetList.slice(0, 8)
      : assetList;
  if (finalAssetList.length > 0) {
    lines.push("");
    lines.push(`[AVAILABLE_ASSETS] ${finalAssetList.join(", ")}`);
  }

  return lines.join("\n");
}

/**
 * Build the [AVAILABLE_ASSETS] list for the AI context.
 * Only includes: current symbol + mentioned symbols + key benchmarks.
 * Full 669-asset dump was wasting ~1300 tokens per request.
 * The AI is instructed to only link assets in this list, so keeping it
 * small prevents hallucinated links while saving tokens.
 */
// Block 5: Equal US + IN representation. US mega-caps + ETF benchmarks + IN large-caps.
// This is the curated anchor list for GLOBAL queries — ~80 tokens vs ~1000 for the full dump.
const BENCHMARK_SYMBOLS = [
  // US ETF benchmarks
  "SPY", "QQQ", "IWM", "DIA", "VOO", "VTI",
  // Crypto
  "BTC-USD", "ETH-USD",
  // Commodities
  "GLD", "SLV", "TLT",
  // US mega-caps
  "AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META", "TSLA", "JPM", "V",
  // IN large-caps (equal representation)
  "RELIANCE.NS", "TCS.NS", "INFY.NS", "HDFCBANK.NS", "ICICIBANK.NS",
  "HINDUNILVR.NS", "BAJFINANCE.NS", "WIPRO.NS", "AXISBANK.NS", "SBIN.NS",
];

function buildSmartAssetList(
  allAssets: string[],
  mentionedSymbols: string[],
  currentSymbol: string,
): string[] {
  const allAssetsUpper = new Set(allAssets.map((a) => a.toUpperCase()));
  const result = new Set<string>();

  // 1. Current symbol first
  if (currentSymbol && currentSymbol !== "GLOBAL" && allAssetsUpper.has(currentSymbol.toUpperCase())) {
    result.add(currentSymbol.toUpperCase());
  }

  // 2. Mentioned symbols — only if they exist in DB (asset-link validation use case)
  for (const sym of mentionedSymbols) {
    const upper = sym.toUpperCase();
    if (allAssetsUpper.has(upper)) {
      result.add(upper);
    }
  }

  // 3. Key benchmarks — only if they exist in DB (equal US+IN representation)
  for (const bench of BENCHMARK_SYMBOLS) {
    if (allAssetsUpper.has(bench.toUpperCase())) {
      result.add(bench.toUpperCase());
    }
  }

  return Array.from(result);
}

/**
 * Extract potential stock/crypto symbols mentioned in the conversation messages.
 * Looks for uppercase 1-6 letter words, common ticker patterns, and .NS suffixes.
 */
export function extractMentionedSymbols(messages: Array<{ role: string; content: string | unknown }>): string[] {
  const symbols = new Set<string>();
  const tickerPattern = /\b([A-Z]{1,8}(?:[-.][A-Z]{1,4})?(?:=F)?)\b/g;

  for (const msg of messages) {
    const text = typeof msg.content === "string" ? msg.content : "";
    let match;
    while ((match = tickerPattern.exec(text)) !== null) {
      const candidate = match[1];
      // Filter out common English words that look like tickers
      if (!COMMON_WORDS.has(candidate) && candidate.length >= 2) {
        symbols.add(candidate);
      }
    }
  }

  return Array.from(symbols);
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function fmtLarge(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1e12) return `${(v / 1e12).toFixed(1)}T`;
  if (abs >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${(v / 1e6).toFixed(0)}M`;
  if (abs >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return v.toFixed(0);
}

// --- Chain-of-Thought: Pre-compute analytical insights from score patterns ---
function buildAnalyticalChain(
  scores: Record<string, number | undefined>,
  dynamics: Record<string, { trend?: string } | undefined> = {},
): string | null {
  const T = scores.trend;
  const M = scores.momentum;
  const V = scores.volatility;
  const L = scores.liquidity;
  const S = scores.sentiment;
  const Trust = scores.trust;

  // Direction arrows from [SCORE_DYNAMICS] — IMPROVING ↑ / DETERIORATING ↓ / STABLE →
  const tDir = dynamics.trend?.trend;
  const mDir = dynamics.momentum?.trend;
  const tArrow = tDir === "IMPROVING" ? "↑" : tDir === "DETERIORATING" ? "↓" : "";
  const mArrow = mDir === "IMPROVING" ? "↑" : mDir === "DETERIORATING" ? "↓" : "";

  if (T === undefined && M === undefined && V === undefined) return null;

  const steps: string[] = [];

  // Step 1: Trend + Momentum pattern — direction-aware
  if (T !== undefined && M !== undefined) {
    if (T > 75 && M < 55) {
      // Directional refinement: is the divergence worsening (M↓) or stabilising (M↑/→)?
      const note = mDir === "DETERIORATING"
        ? "momentum still falling — divergence worsening, high risk of trend break"
        : mDir === "IMPROVING"
          ? "momentum stabilising — divergence may be temporary"
          : "divergence holding, monitor for resolution";
      steps.push(`Step 1: T:${T}${tArrow} + M:${M}${mArrow} = momentum divergence — trend intact but thrust fading (${note})`);
    } else if (T > 75 && M > 70) {
      const note = (tDir === "IMPROVING" && mDir === "IMPROVING")
        ? "both accelerating — strongest possible setup"
        : (tDir === "DETERIORATING" || mDir === "DETERIORATING")
          ? "one leg softening — watch for early divergence"
          : "aligned and stable";
      steps.push(`Step 1: T:${T}${tArrow} + M:${M}${mArrow} = full confirmation — trend + momentum aligned (${note})`);
    } else if (T < 45 && M < 45) {
      const note = (tDir === "DETERIORATING" && mDir === "DETERIORATING")
        ? "both still falling — no floor visible yet"
        : (tDir === "IMPROVING" || mDir === "IMPROVING")
          ? "at least one score stabilising — early watch for reversal"
          : "dual weakness holding";
      steps.push(`Step 1: T:${T}${tArrow} + M:${M}${mArrow} = dual weakness — both trend and momentum deteriorating (${note})`);
    } else if (T < 45 && M > 65) {
      steps.push(`Step 1: T:${T}${tArrow} + M:${M}${mArrow} = bottom bounce — trend down but momentum recovering (potential reversal; confirm with T turning ↑)`);
    } else if (T > 60 && T < 80 && M > 40 && M < 60) {
      steps.push(`Step 1: T:${T}${tArrow} + M:${M}${mArrow} = consolidation — sideways movement, await breakout`);
    } else if (T >= 55 && T <= 75 && M >= 55 && M <= 75) {
      steps.push(`Step 1: T:${T}${tArrow} + M:${M}${mArrow} = healthy trend, no divergence — sustained move, await directional catalyst for conviction`);
    } else if (T >= 45 && T <= 55 && M >= 45 && M <= 55) {
      steps.push(`Step 1: T:${T}${tArrow} + M:${M}${mArrow} = true neutral — no directional conviction, conflicting signals (indecision zone, breakout imminent)`);
    } else if (T >= 45 && T < 60 && M >= 60) {
      // Moderate trend + building momentum: recovery/accumulation pattern.
      // M leading T is early signal; wait for T to confirm before conviction.
      const note = mDir === "IMPROVING"
        ? "momentum accelerating — watch for T to follow; early entry zone"
        : mDir === "DETERIORATING"
          ? "momentum fading before trend confirmed — false recovery risk"
          : "momentum ahead of trend — needs T confirmation for conviction";
      steps.push(`Step 1: T:${T}${tArrow} + M:${M}${mArrow} = momentum leading trend — recovery signal but unconfirmed (${note})`);
    }
  }
  
  // Step 2: Volatility regime
  if (V !== undefined) {
    if (V > 70) {
      steps.push(`Step 2: V:${V} = elevated vol regime — expect outsized price swings, position sizing critical`);
      // PROMPT-6: strong trend + high vol = fragile uptrend
      if (T !== undefined && T > 75) {
        steps.push(`Step 2a: T:${T} + V:${V} = strong trend in high-vol regime — uptrend is real but fragile, any catalyst amplifies moves`);
      }
      // PROMPT-6: downtrend + high vol = capitulation risk
      if (T !== undefined && T < 45) {
        steps.push(`Step 2a: T:${T} + V:${V} = downtrend + elevated vol = capitulation risk — oversized moves on thin buyer support`);
      }
    } else if (V < 35) {
      steps.push(`Step 2: V:${V} = compressed vol — low volatility = calm before storm, prepare for expansion`);
    }
  }
  
  // Step 3: Liquidity check
  if (L !== undefined && L < 40) {
    steps.push(`Step 3: L:${L} = weak liquidity — large orders will move price, slippage risk high`);
  }
  
  // Step 4: Sentiment check
  if (S !== undefined && T !== undefined) {
    if (S > 75 && T > 75) {
      steps.push(`Step 4: S:${S} + T:${T} = euphoria risk — consensus bullish, watch for reversal triggers`);
    } else if (S < 35 && T < 45) {
      steps.push(`Step 4: S:${S} + T:${T} = fear extreme — capitulation may be near, look for value entry`);
    }
  }

  // Step 5: Sentiment-Momentum divergence (PROMPT-6)
  if (S !== undefined && M !== undefined) {
    if (S > 70 && M < 45) {
      steps.push(`Step 5: S:${S} + M:${M} = sentiment-momentum divergence — crowd is bullish but price thrust is fading (contrarian caution)`);
    } else if (S < 35 && M > 65) {
      steps.push(`Step 5: S:${S} + M:${M} = pessimistic crowd, strong momentum — sentiment lagging price action (potential underappreciated rally)`);
    }
  }

  // Step 6: Trust score — composite signal integrity check
  if (Trust !== undefined) {
    if (Trust < 45 && T !== undefined && T > 70) {
      steps.push(`Step 6: Trust:${Trust} + T:${T} = low-trust uptrend — scores disagree on reliability; strong trend with weak composite trust = fragile signal, treat with caution`);
    } else if (Trust < 40) {
      steps.push(`Step 6: Trust:${Trust} = low composite trust — signal reliability is reduced; do not act on individual high scores without cross-confirming with price action`);
    } else if (Trust > 75 && T !== undefined && T > 70 && M !== undefined && M > 65) {
      steps.push(`Step 6: Trust:${Trust} + T:${T} + M:${M} = high-trust full confirmation — all signal layers aligned, highest-conviction setup`);
    }
  }

  if (steps.length === 0) return null;
  return steps.join("\n");
}
