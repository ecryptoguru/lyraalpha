/**
 * Engine Configuration Constants
 *
 * Centralized constants for all deterministic scoring engines.
 * These values are derived from historical analysis and institutional standards.
 */

export const ENGINE_THRESHOLDS = {
  TREND: {
    // Data requirements for tiered logic
    TIER_1_MIN_DAYS: 200,
    TIER_2_MIN_DAYS: 50,
    TIER_3_MIN_DAYS: 20,

    // Scoring weights (Tier 1)
    TIER_1_SMA200_WEIGHT: 40,
    TIER_1_SMA50_WEIGHT: 30,
    TIER_1_GOLDEN_CROSS_WEIGHT: 30,

    // Scoring weights (Tier 2)
    TIER_2_SMA50_WEIGHT: 50,
    TIER_2_SMA20_WEIGHT: 30,
    TIER_2_CROSS_WEIGHT: 20,

    // Scoring weights (Tier 3)
    TIER_3_SMA20_WEIGHT: 70,
    TIER_3_SMA5_WEIGHT: 30,

    // Signal thresholds
    STRONG_SIGNAL: 70,
    WEAK_SIGNAL: 30,
  },

  MOMENTUM: {
    // RSI periods
    RSI_PERIOD: 14,

    // Signal thresholds
    OVERBOUGHT: 70,
    OVERSOLD: 30,
    NEUTRAL: 50,

    // Extreme levels
    EXTREME_OVERBOUGHT: 80,
    EXTREME_OVERSOLD: 20,
  },

  VOLATILITY: {
    // ATR period
    ATR_PERIOD: 14,

    // Asset class scaling factors (K values)
    // Higher K = more tolerance for volatility
    CRYPTO_DIVISOR: 8, // 8% move = 100 score
    EQUITY_DIVISOR: 4, // 4% move = 100 score
    COMMODITY_DIVISOR: 6, // 6% move = 100 score

    // Risk levels
    LOW_RISK: 30,
    MODERATE_RISK: 50,
    HIGH_RISK: 70,
  },

  LIQUIDITY: {
    // Dollar volume thresholds
    INSTITUTIONAL_GRADE: 500_000_000, // $500M
    HIGH_LIQUIDITY: 100_000_000, // $100M
    MEDIUM_LIQUIDITY: 10_000_000, // $10M
    LOW_LIQUIDITY: 1_000_000, // $1M

    // Score ranges
    INSTITUTIONAL_SCORE_MIN: 90,
    HIGH_SCORE_MIN: 75,
    MEDIUM_SCORE_MIN: 50,
    LOW_SCORE_MAX: 30,

    // Lookback period for average volume
    VOLUME_LOOKBACK_DAYS: 10,
  },

  TRUST: {
    // Base scores by asset type
    REGULATED_BASE: 80, // Stocks, ETFs
    UNREGULATED_BASE: 40, // Crypto

    // Market cap modifiers
    MEGA_CAP_THRESHOLD: 100_000_000_000, // $100B
    MEGA_CAP_BONUS: 15,

    LARGE_CAP_THRESHOLD: 10_000_000_000, // $10B
    LARGE_CAP_BONUS: 10,

    MICRO_CAP_THRESHOLD: 100_000_000, // $100M
    MICRO_CAP_PENALTY: -10,

  },

  SENTIMENT: {
    // Variance range for simulation
    MIN_VARIANCE: -15,
    MAX_VARIANCE: 15,
    BASELINE: 50,
  },
} as const;

export const MARKET_REGIME = {
  // Regime score thresholds
  STRONG_RISK_ON_MIN: 75,
  RISK_ON_MIN: 60,
  NEUTRAL_MIN: 45,
  DEFENSIVE_MIN: 30,
  // Below 30 = RISK_OFF

  // Component weights
  BREADTH_WEIGHT: 0.4,
  VOLATILITY_WEIGHT: 0.3,
  RISK_SENTIMENT_WEIGHT: 0.3,

  // Breadth calculation
  BREADTH_TREND_THRESHOLD: 55, // Assets with trend > 55 count as "trending"

  // Risk sentiment sub-weights
  SENTIMENT_SUBWEIGHT: 0.6,
  MOMENTUM_PARTICIPATION_SUBWEIGHT: 0.4,
  MOMENTUM_PARTICIPATION_THRESHOLD: 60,
} as const;

export const COMPATIBILITY = {
  // Fit score ranges
  STRONG_FIT_MIN: 80,
  MODERATE_FIT_MIN: 50,
  // Below 50 = Poor Fit

  // Regime-specific penalties/bonuses
  RISK_ON: {
    LOW_TREND_PENALTY: -15,
    HIGH_MOMENTUM_BONUS: 10,
    STABLE_VOL_BONUS: 5,
  },

  RISK_OFF: {
    HIGH_TREND_PENALTY: -20, // Mean reversion risk
    HIGH_MOMENTUM_PENALTY: -15,
    LOW_VOL_REQUIREMENT: 30, // Must have vol < 30
    HIGH_LIQUIDITY_REQUIREMENT: 75,
  },

  DEFENSIVE: {
    VOL_WEIGHT_MULTIPLIER: 1.5, // Volatility matters more
    LIQUIDITY_WEIGHT_MULTIPLIER: 1.3,
  },
} as const;

export const SYNC_CONFIG = {
  // Batch processing
  CONCURRENCY_LIMIT: 10,
  BATCH_SIZE: 500, // Database write batch size

  // Timeouts
  ASSET_SYNC_TIMEOUT_MS: 30_000, // 30 seconds per asset
  FULL_SYNC_TIMEOUT_MS: 300_000, // 5 minutes total

  // Data lookback
  HISTORY_LOOKBACK_DAYS: 365, // 1 year

  // Event generation thresholds
  MOMENTUM_BREAKOUT_THRESHOLD: 80,
  VALUE_MISPRICING_THRESHOLD: 85,
  CORRELATION_BREAKDOWN_THRESHOLD: 30,
} as const;

export const API_LIMITS = {
  // Rate limiting (requests per minute)
  AI_ENDPOINTS: 10,
  ANALYTICS_ENDPOINTS: 60,
  DISCOVERY_ENDPOINTS: 30,

  // Query limits
  MAX_SYMBOLS_PER_QUOTE: 20,
  MAX_SEARCH_RESULTS: 50,

  // Cache durations (seconds)
  ANALYTICS_CACHE: 3600, // 1 hour
  DISCOVERY_CACHE: 3600, // 1 hour
  QUOTES_CACHE: 60, // 1 minute
  TRENDING_CACHE: 3600, // 1 hour
} as const;

export const DISCOVERY = {
  ELIGIBILITY_WEIGHTS: {
    RELEVANCE: 0.3,
    FRESHNESS: 0.2,
    STRENGTH: 0.2,
    DENSITY: 0.15,
    BEHAVIOR: 0.15,
  },
  FRESHNESS_DECAY: {
    BASE: 100,
    LAMBDA: -0.03,
  },
  NARRATIVE_STRENGTH: {
    SCALING: 50,
  },
  TIER_THRESHOLDS: {
    STRONG: 75,
    MODERATE: 55,
    EMERGING: 35,
  },
} as const;

export const SECTOR_REGIME = {
  WEIGHTS: {
    PARTICIPATION: 0.4,
    VOLATILITY: 0.3,
    RISK: 0.3,
  },
  BOOST_FACTORS: {
    LEADING: 1.1,
    POSITIVE: 1.05,
    PENALTY: 0.95,
    LEADERSHIP_THRESHOLD: 70,
    POSITIVE_THRESHOLD: 60,
  },
} as const;
