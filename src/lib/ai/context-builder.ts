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
  if (/protocol|what does .* do|use case|utility|smart contract|consensus|layer|l1|l2|defi|dapp/.test(q)) focus.push("protocol summary");
  if (/grow|growth|driver|catalyst|adoption|active address|developer|github|commit|tvl|expansion/.test(q)) focus.push("growth drivers");
  if (/risk|downside|bear|fragile|break|concern|headwind|exploit|hack|regulation|sec|ban/.test(q)) focus.push("risks");
  if (/valu|cheap|expensive|fdv|mcap|market cap|dilut|supply|tokenomics|unlock|vesting|emission|inflation/.test(q)) focus.push("tokenomics valuation");
  if (/stake|staking|yield|apy|apr|reward|validator|node/.test(q)) focus.push("staking and yield");
  if (/on.chain|onchain|wallet|address|transaction|volume|velocity|whale|holder|concentration/.test(q)) focus.push("on-chain fundamentals");
  if (/momentum|trend|score|signal|setup|technical|ath|atl|52w|cycle/.test(q)) focus.push("signal story");
  if (/liquidity|dex|cex|pool|spread|slippage|depth|orderbook/.test(q)) focus.push("liquidity analysis");
  if (focus.length === 0) {
    focus.push("protocol summary", "growth drivers", "risks", "tokenomics valuation");
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

  // --- Region / Network ---
  if (context.region) {
    if (type === "CRYPTO") {
      // Crypto is global; region is less relevant. Omit or show chain context if available.
    } else {
      lines.push(`[REGION] ${context.region === "IN" ? "India" : "United States"}`);
    }
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

    // P0: Valuation Metrics — not applicable for crypto-only platform

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

    // Company profile — not applicable for crypto-only platform

    // Insider sentiment & financials — not applicable for crypto-only platform

    // Platform is crypto-only — non-crypto sections removed

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

    // Factor DNA — not applicable for crypto-only platform
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
// Block 5: Crypto-only benchmark list for GLOBAL queries — ~50 tokens vs ~1000 for the full dump.
const BENCHMARK_SYMBOLS = [
  // Crypto majors
  "BTC-USD", "ETH-USD", "SOL-USD", "BNB-USD", "XRP-USD",
  // Crypto mid-caps
  "ADA-USD", "DOGE-USD", "AVAX-USD", "DOT-USD", "LINK-USD",
  // Crypto L1/L2
  "MATIC-USD", "UNI-USD", "AAVE-USD", "ARB-USD", "OP-USD",
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
 * Extract potential crypto symbols mentioned in the conversation messages.
 * Looks for uppercase 1-6 letter words and common crypto ticker patterns.
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
