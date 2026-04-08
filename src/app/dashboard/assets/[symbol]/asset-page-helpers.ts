import { AssetAnalyticsResponse, EventImpact, ScoreDynamics } from "@/types/analytics";
import { MFAnalyticsResult } from "@/lib/engines/mutual-fund-analytics";
import { AssetSignals, CompatibilityResult } from "@/lib/engines/compatibility";
import { GroupingResult } from "@/lib/engines/grouping";
import { MarketContextSnapshot } from "@/lib/engines/market-regime";
import { OHLCV } from "@/lib/engines/types";
import { SignalStrengthResult } from "@/lib/engines/signal-strength";
import { getFriendlySymbol } from "@/lib/format-utils";
import { buildAssetShareObject } from "@/lib/intelligence-share";

export interface AssetAnalytics {
  signals: AssetSignals | null;
  compatibility: CompatibilityResult | null;
  grouping: GroupingResult | null;
  factorData: {
    value: number;
    growth: number;
    momentum: number;
    volatility: number;
    mfAnalytics?: MFAnalyticsResult;
  } | null;
  correlationData: Record<string, number>;
  events: {
    id: string;
    type: string;
    title: string;
    description: string | null;
    severity: string;
    date: string;
    metadata: Record<string, unknown> | null;
  }[];
  scoreDynamics?: Record<string, ScoreDynamics>;
  eventAdjustedScores?: Record<string, EventImpact>;
  correlationRegime?: {
    avgCorrelation: number;
    dispersion: number;
    trend: string;
    regime: string;
  };
  factorAlignment?: {
    score: number;
    dominantFactor: string;
    regimeFit: "STRONG" | "MODERATE" | "WEAK";
    breakdown: Record<string, number>;
    explanation: string;
  };
  technicalMetrics?: {
    marketCap: string | null;
    peRatio: number | null;
    dividendYield: number | null;
    pegRatio: number | null;
    eps: number | null;
    fiftyTwoWeekHigh: number | null;
    fiftyTwoWeekLow: number | null;
    shortRatio: number | null;
    priceToBook: number | null;
    roe: number | null;
    roce: number | null;
    industryPe: number | null;
    expenseRatio: number | null;
    nav: number | null;
    yield: number | null;
    morningstarRating: string | null;
    category: string | null;
    openInterest?: number | null;
    [key: string]: unknown;
  };
  performance?: {
    returns: {
      "1D": number | null;
      "1W": number | null;
      "1M": number | null;
      "3M": number | null;
      "6M": number | null;
      YTD: number | null;
      "1Y": number | null;
    };
    range52W: {
      high: number | null;
      low: number | null;
      currentPosition: number | null;
      distanceFromHigh: number | null;
      distanceFromLow: number | null;
    };
  };
  signalStrength?: SignalStrengthResult | null;
  metadata: Record<string, unknown> | null;
  description?: string | null;
  industry?: string | null;
  sector?: string | null;
  fundHouse?: string | null;
  financials?: Record<string, unknown> | null;
  topHoldings?: Record<string, unknown> | null;
  etfLookthrough?: Record<string, unknown> | null;
  mfLookthrough?: Record<string, unknown> | null;
  commodityIntelligence?: Record<string, unknown> | null;
  cryptoIntelligence?: Record<string, unknown> | null;
  fundPerformanceHistory?: Record<string, unknown> | null;
  type: string;
  name: string;
  symbol?: string | null;
  price: number;
  change: number;
  changePercent?: number | null;
  currency: string;
  data?: (OHLCV & { events?: AssetAnalyticsResponse["events"] })[];
}

export function createEmptyAssetAnalytics(): AssetAnalytics {
  return {
    signals: null,
    compatibility: null,
    grouping: null,
    factorData: null,
    correlationData: {},
    events: [],
    metadata: null,
    type: "",
    name: "",
    price: 0,
    change: 0,
    currency: "USD",
  };
}

export function mergeAnalyticsWithData(
  analytics: AssetAnalytics | null,
  data: OHLCV[],
): AssetAnalytics {
  if (!analytics) return createEmptyAssetAnalytics();

  const eventsByDate = new Map<string, AssetAnalyticsResponse["events"]>();
  (analytics.events ?? []).forEach((event) => {
    const dateKey = event.date.split("T")[0];
    if (!eventsByDate.has(dateKey)) eventsByDate.set(dateKey, []);
    eventsByDate.get(dateKey)?.push(event);
  });

  const mergedData = data.map((entry) => {
    const dateKey = entry.date.split("T")[0];
    return { ...entry, events: eventsByDate.get(dateKey) || [] };
  });

  return {
    ...analytics,
    data: mergedData,
  };
}

function hasVisibleValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "number") return Number.isFinite(value) && value !== 0;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed || trimmed === "—") return false;
    const numeric = Number(trimmed.replace(/[^0-9.-]/g, ""));
    if (Number.isFinite(numeric)) return numeric !== 0;
    return true;
  }
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value as Record<string, unknown>).length > 0;
  return true;
}

interface BuildAssetPageDerivedStateArgs {
  analytics?: AssetAnalytics | null;
  analyticsComputed: AssetAnalytics;
  data: OHLCV[];
  marketContext: MarketContextSnapshot | null;
  symbol: string;
}

export function buildAssetPageDerivedState({
  analytics,
  analyticsComputed,
  data,
  marketContext,
  symbol,
}: BuildAssetPageDerivedStateArgs) {
  const compatibility = analyticsComputed.compatibility;
  const performance = analyticsComputed.performance;
  const signals = analyticsComputed.signals;
  const regimeLabel = marketContext?.regime.label?.replace(/_/g, " ") ?? "neutral";
  const riskLabel = marketContext?.risk.label ?? "BALANCED";
  const signalLabel = analyticsComputed.signalStrength?.label ?? "Neutral";
  const compatibilityScore = compatibility?.score != null ? Math.round(compatibility.score) : null;
  const assetName = analyticsComputed.name || getFriendlySymbol(symbol, analytics?.type, analytics?.name);

  const hasMeaningfulEtfLookthrough = (() => {
    const lt = analyticsComputed.etfLookthrough as Record<string, unknown> | null | undefined;
    if (!lt) return false;
    const factor = lt.factorExposure as Record<string, unknown> | undefined;
    const concentration = lt.concentration as Record<string, unknown> | undefined;
    const geographic = lt.geographic as Record<string, unknown> | undefined;
    const scores = lt.lookthroughScores as Record<string, unknown> | undefined;
    return [
      factor?.value,
      factor?.growth,
      factor?.momentum,
      factor?.quality,
      factor?.size,
      concentration?.top1Weight,
      concentration?.top5Weight,
      concentration?.top10Weight,
      geographic?.US,
      geographic?.IN,
      geographic?.other,
      scores?.weightedAvg,
      scores?.matchRate,
    ].some((value) => hasVisibleValue(value));
  })();

  const hasMeaningfulMfLookthrough = (() => {
    const lt = analyticsComputed.mfLookthrough as Record<string, unknown> | null | undefined;
    if (!lt) return false;
    return [lt.lookthroughScores, lt.risk, lt.behavioral, lt.holdingConcentration].some((value) => hasVisibleValue(value));
  })();

  const hasMeaningfulSignalStrength = (() => {
    const ss = analyticsComputed.signalStrength as Record<string, unknown> | null | undefined;
    if (!ss) return false;
    return [
      ss.score,
      ss.label,
      ss.confidence,
      ss.breakdown,
      ss.weights,
      ss.keyDrivers,
      ss.riskFactors,
      ss.engineDirections,
    ].some((value) => hasVisibleValue(value));
  })();

  const priceCalculations = (() => {
    const rawLatest = data.length > 0 ? data[data.length - 1].close : 0;
    const isMcxInAsset = analyticsComputed.symbol === "GOLD-MCX" || analyticsComputed.symbol === "SILVER-MCX";
    const latestPrice = isMcxInAsset && analyticsComputed.price > 0
      ? analyticsComputed.price
      : rawLatest || analyticsComputed.price || 0;
    const prevPrice = !isMcxInAsset && data.length > 1 ? data[data.length - 2].close : 0;
    const changePercent = isMcxInAsset
      ? (analyticsComputed.changePercent ?? 0)
      : prevPrice
        ? ((latestPrice - prevPrice) / prevPrice) * 100
        : (analyticsComputed.changePercent ?? 0);
    return { latestPrice, changePercent, isUp: changePercent >= 0 };
  })();

  const headerDayRange = (() => {
    const meta = analyticsComputed.metadata as Record<string, unknown> | null;
    if (!meta || meta.dayLow == null || meta.dayHigh == null) return null;
    const isMcxIn = analyticsComputed.symbol === "GOLD-MCX" || analyticsComputed.symbol === "SILVER-MCX";
    if (isMcxIn) {
      const mcxOz = Number(meta.mcxPricePerOz);
      const askUsd = Number(meta.spotAsk);
      const rate = mcxOz > 0 && askUsd > 0 ? mcxOz / askUsd : 0;
      if (rate <= 0) return null;
      const ozg = 31.1035;
      const isGold = analyticsComputed.symbol === "GOLD-MCX";
      const low = isGold
        ? (Number(meta.dayLow) * rate / ozg) * 10
        : (Number(meta.dayLow) * rate / ozg) * 1000;
      const high = isGold
        ? (Number(meta.dayHigh) * rate / ozg) * 10
        : (Number(meta.dayHigh) * rate / ozg) * 1000;
      return low > 0 && high > 0 ? { low, high } : null;
    }
    const low = meta.dayLow as number;
    const high = meta.dayHigh as number;
    return low > 0 && high > 0 ? { low, high } : null;
  })();

  const summaryTone = (() => {
    const score = analyticsComputed.signalStrength?.score ?? compatibility?.score ?? 50;
    if (score >= 70) return "Constructive";
    if (score >= 55) return "Balanced";
    if (score >= 40) return "Mixed";
    return "Fragile";
  })();

  const plainEnglishLine = (() => {
    const trend = signals?.trend ?? null;
    const momentum = signals?.momentum ?? null;
    const liquidity = signals?.liquidity ?? null;
    const volatility = signals?.volatility ?? null;
    const parts: string[] = [];

    if (signalLabel === "Strong Bullish" || signalLabel === "Bullish") {
      parts.push(`${assetName} is trading with constructive evidence right now`);
    } else if (signalLabel === "Strong Bearish" || signalLabel === "Bearish") {
      parts.push(`${assetName} is showing a weaker setup than the headline price alone suggests`);
    } else {
      parts.push(`${assetName} is not giving a decisive directional edge yet`);
    }

    if (trend != null) {
      if (trend >= 65) parts.push("trend structure is supportive");
      else if (trend <= 40) parts.push("trend support is weak");
      else parts.push("trend support is only moderate");
    }

    if (momentum != null) {
      if (momentum >= 60) parts.push("momentum is improving");
      else if (momentum <= 40) parts.push("momentum is fading");
      else parts.push("momentum is mixed");
    }

    if (liquidity != null) {
      if (liquidity >= 60) parts.push("liquidity support is healthy");
      else if (liquidity <= 40) parts.push("liquidity is thinner than ideal, so moves may be less reliable");
    }

    if (volatility != null) {
      if (volatility >= 65) parts.push("volatility is relatively contained");
      else if (volatility <= 40) parts.push("price swings are elevated");
    }

    const followThrough = parts.slice(1).join(", ");
    return followThrough ? `${parts[0]}. ${followThrough}.` : `${parts[0]}.`;
  })();

  const beginnerHeadline = (() => {
    const compatibilityText = compatibilityScore != null
      ? compatibilityScore >= 75
        ? "Its behavior is holding up better than the broader backdrop"
        : compatibilityScore >= 55
          ? "The setup is workable, but still needs selective judgment"
          : "The backdrop is not offering much help right now"
      : "Backdrop fit is still calibrating, so conviction should stay measured";

    return `${assetName} is reading ${signalLabel.toLowerCase()} in a ${regimeLabel.toLowerCase()} regime. ${compatibilityText}.`;
  })();

  const beginnerRiskLine = (() => {
    if (signals?.volatility != null && signals.volatility < 35) {
      return "The main risk is unstable price behavior: volatility is running hot enough to overwhelm a decent-looking setup.";
    }
    if (signals?.liquidity != null && signals.liquidity < 40) {
      return "Execution risk is higher than it should be because liquidity support looks thinner than ideal.";
    }
    if (riskLabel === "RISK_AVERSION" || riskLabel === "CAUTIOUS") {
      return "The broader market is still defensive, so even decent setups can fail if buyers do not follow through quickly.";
    }
    return "The key risk is that the broader tone stays defensive long enough to cap follow-through, so regime and momentum still need to improve.";
  })();

  const beginnerActionLine = signalLabel.includes("Bullish")
    ? "Best next step: confirm that trend, momentum and liquidity are holding together, then decide whether this strength is broadening or already becoming crowded."
    : signalLabel.includes("Bearish")
      ? "Best next step: focus on the weak drivers first, then check whether the weakness is being reinforced by trend, momentum and the broader regime."
      : "Best next step: identify the one or two drivers that need to improve before treating this as a higher-conviction setup.";

  const nextSectionLabel = (() => {
    if ((signals?.trend ?? 50) < 45 || (signals?.momentum ?? 50) < 45) return "Core Analytics";
    if (analyticsComputed.signalStrength) return "Signal Strength";
    return "Price context";
  })();

  const keyDrivers = analyticsComputed.signalStrength?.keyDrivers?.slice(0, 3) ?? [];
  const keyRisks = analyticsComputed.signalStrength?.riskFactors?.slice(0, 3) ?? [];

  const summaryCards = [
    {
      label: "Signal",
      value: signalLabel,
      detail: `Tone: ${summaryTone}`,
    },
    {
      label: "Compatibility",
      value: compatibilityScore != null ? `${compatibilityScore}/100` : "Pending",
      detail: `${regimeLabel.toLowerCase()} regime fit`,
    },
    {
      label: "Momentum",
      value: signals?.momentum != null ? `${Math.round(signals.momentum)}/100` : "Pending",
      detail: signals?.momentum != null && signals.momentum >= 60 ? "Improving" : signals?.momentum != null && signals.momentum <= 40 ? "Soft" : "Mixed",
    },
    {
      label: "Next read",
      value: nextSectionLabel,
      detail: "Go deeper only if you need conviction",
    },
  ];

  const assetShare = buildAssetShareObject({
    assetName: getFriendlySymbol(symbol, analytics?.type, analytics?.name),
    takeaway: beginnerHeadline,
    context: `${beginnerRiskLine} ${beginnerActionLine}`,
    scoreValue: signalLabel,
    href: `/dashboard/assets/${encodeURIComponent(symbol)}`,
  });

  const hasMeaningfulPerformanceSection = (() => {
    if (!performance) return false;
    const returns = performance.returns;
    const range52W = performance.range52W;
    const returnValues = [
      returns["1D"],
      returns["1W"],
      returns["1M"],
      returns["3M"],
      returns["6M"],
      returns.YTD,
      returns["1Y"],
    ];
    const hasReturns = returnValues.some((value) => hasVisibleValue(value));
    const hasVolatility = hasVisibleValue(analyticsComputed.signals?.volatility);
    const hasRange = [
      range52W.low,
      range52W.high,
      range52W.currentPosition,
      range52W.distanceFromHigh,
      range52W.distanceFromLow,
    ].some((value) => hasVisibleValue(value));
    return hasReturns || hasVolatility || hasRange;
  })();

  const cgMeta = (() => {
    if (analyticsComputed.type !== "CRYPTO" || !analyticsComputed.metadata) return null;
    const meta = analyticsComputed.metadata as Record<string, unknown>;
    const cg = meta.coingecko as Record<string, unknown> | undefined;
    if (!cg) return null;
    return {
      marketCapRank: cg.marketCapRank as number | undefined,
      fullyDilutedValuation: cg.fullyDilutedValuation as number | undefined,
      ath: cg.ath as number | undefined,
      athDate: cg.athDate as string | undefined,
      athChangePercentage: cg.athChangePercentage as number | undefined,
      atl: cg.atl as number | undefined,
      atlDate: cg.atlDate as string | undefined,
      atlChangePercentage: cg.atlChangePercentage as number | undefined,
      priceChangePercentage7d: cg.priceChangePercentage7d as number | undefined,
      priceChangePercentage14d: cg.priceChangePercentage14d as number | undefined,
      priceChangePercentage30d: cg.priceChangePercentage30d as number | undefined,
      priceChangePercentage60d: cg.priceChangePercentage60d as number | undefined,
      priceChangePercentage200d: cg.priceChangePercentage200d as number | undefined,
      priceChangePercentage1y: cg.priceChangePercentage1y as number | undefined,
      image: cg.image as { large?: string } | undefined,
      description: cg.description as string | undefined,
      categories: cg.categories as string[] | undefined,
      genesisDate: cg.genesisDate as string | undefined,
      hashingAlgorithm: cg.hashingAlgorithm as string | undefined,
      sentimentVotesUpPercentage: cg.sentimentVotesUpPercentage as number | undefined,
      sentimentVotesDownPercentage: cg.sentimentVotesDownPercentage as number | undefined,
      watchlistUsers: cg.watchlistUsers as number | undefined,
      developer: cg.developer as {
        forks?: number;
        stars?: number;
        subscribers?: number;
        totalIssues?: number;
        closedIssues?: number;
        pullRequestsMerged?: number;
        commitCount4Weeks?: number;
      } | null | undefined,
      community: cg.community as {
        redditSubscribers?: number;
        telegramUsers?: number | null;
      } | null | undefined,
      links: cg.links as {
        homepage?: string[];
        whitepaper?: string | null;
        blockchain?: string[];
        twitter?: string | null;
        reddit?: string | null;
        github?: string[];
        telegram?: string | null;
      } | undefined,
    };
  })();

  return {
    compatibilityScore,
    signalLabel,
    regimeLabel,
    riskLabel,
    summaryTone,
    plainEnglishLine,
    beginnerHeadline,
    beginnerRiskLine,
    beginnerActionLine,
    nextSectionLabel,
    keyDrivers,
    keyRisks,
    summaryCards,
    assetShare,
    hasMeaningfulEtfLookthrough,
    hasMeaningfulMfLookthrough,
    hasMeaningfulSignalStrength,
    hasMeaningfulPerformanceSection,
    latestPrice: priceCalculations.latestPrice,
    changePercent: priceCalculations.changePercent,
    isUp: priceCalculations.isUp,
    headerDayRange,
    cgMeta,
  };
}

export function buildComprehensiveThesisPrompt(
  analyticsComputed: AssetAnalytics,
  symbol: string,
): string {
  const ss = analyticsComputed.signalStrength;
  const fd = analyticsComputed.factorData;
  const fa = analyticsComputed.factorAlignment;
  const sd = analyticsComputed.scoreDynamics;
  const corr = analyticsComputed.correlationData;
  const corrRegime = analyticsComputed.correlationRegime;
  const extra: string[] = [];

  if (ss) {
    const drivers = Array.isArray(ss.keyDrivers) && ss.keyDrivers.length > 0 ? ss.keyDrivers.join("; ") : "None highlighted yet";
    const risks = Array.isArray(ss.riskFactors) && ss.riskFactors.length > 0 ? ss.riskFactors.join("; ") : "No major risk flags isolated yet";
    extra.push(`[SIGNAL] ${ss.score}/100 ${ss.label} (${ss.confidence}) | Drivers: ${drivers} | Risks: ${risks}`);
  }

  if (fd) {
    extra.push(`[FACTOR DNA] Val:${fd.value} Gro:${fd.growth} Mom:${fd.momentum} Vol:${fd.volatility}`);
  }

  if (fa) {
    extra.push(`[FACTOR FIT] ${fa.score} dominant:${fa.dominantFactor} regime:${fa.regimeFit}`);
  }

  if (corr && Object.keys(corr).length > 0) {
    extra.push(`[CORR] ${Object.entries(corr).map(([key, value]) => `${key}:${typeof value === "number" ? value.toFixed(2) : String(value)}`).join(" ")}`);
  }

  if (corrRegime) {
    const avgCorrelation = typeof corrRegime.avgCorrelation === "number"
      ? corrRegime.avgCorrelation.toFixed(2)
      : "n/a";
    const dispersion = typeof corrRegime.dispersion === "number"
      ? corrRegime.dispersion.toFixed(2)
      : "n/a";
    extra.push(`[CORR REGIME] avg:${avgCorrelation} disp:${dispersion} ${corrRegime.trend} ${corrRegime.regime}`);
  }

  if (sd && Object.keys(sd).length > 0) {
    extra.push(`[DYNAMICS] ${Object.entries(sd).map(([engine, dynamics]) => `${engine}:m${Number(dynamics.momentum ?? 0).toFixed(0)}a${Number(dynamics.acceleration ?? 0).toFixed(0)}`).join(" ")}`);
  }

  return `Comprehensive institutional thesis for ${analyticsComputed.name || symbol} (${symbol}).
${extra.length > 0 ? extra.join("\n") : ""}
Use ALL context data. Cover: 1) Bottom line + conviction, 2) Bull vs bear case, 3) Risk-reward with scenarios, 4) Regime positioning, 5) What to watch. Be thorough.`;
}
