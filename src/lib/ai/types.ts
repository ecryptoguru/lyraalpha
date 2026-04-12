/**
 * Shared types and constants for the Lyra AI pipeline.
 * Single source of truth — used by service.ts, context-builder.ts, and query-classifier.ts.
 */

/** Common English words that look like tickers but should be excluded from symbol extraction.
 *  Shared between context-builder.ts and query-classifier.ts to prevent drift. */
export const COMMON_WORDS = new Set([
  "THE", "AND", "FOR", "ARE", "BUT", "NOT", "YOU", "ALL", "CAN", "HER",
  "WAS", "ONE", "OUR", "OUT", "HAS", "HIS", "HOW", "MAN", "NEW", "NOW",
  "OLD", "SEE", "WAY", "WHO", "BOY", "DID", "GET", "HIM", "LET", "SAY",
  "SHE", "TOO", "USE", "DAD", "MOM", "ITS", "YES", "LOW", "HIGH", "UP",
  "DOWN", "WHAT", "WITH", "HAVE", "THIS", "WILL", "YOUR", "FROM", "THEY",
  "BEEN", "CALL", "COME", "EACH", "MAKE", "LIKE", "LONG", "LOOK", "MANY",
  "SOME", "THAN", "THEM", "THEN", "INTO", "JUST", "OVER", "SUCH", "TAKE",
  "YEAR", "ALSO", "BACK", "GOOD", "GIVE", "MOST", "ONLY", "TELL", "VERY",
  "WHEN", "WELL", "MUCH", "EVEN", "HERE", "THAT", "DOES", "RISK", "SELL",
  "BUY", "TVL", "DEX", "CEO", "CFO", "GDP", "USD", "INR", "EUR", "ETF", "IPO",
  "ABOUT", "DOING", "GOING", "THINK", "WHICH", "THEIR", "COULD", "WOULD",
  "SHOULD", "WHERE", "THERE", "THESE", "THOSE", "AFTER", "BEFORE",
  // 2-3 letter words that are real tickers but almost always used as English words
  "AI", "IT", "OR", "AT", "ON", "IS", "IF", "SO", "DO", "GO", "BE", "PE", "PB",
  "AN", "AS", "BY", "WE", "NO", "MY", "US",
  // Financial vocabulary that triggers false ticker matches
  "GOLD", "BOND", "FUND", "RATE", "BANK", "TECH", "DATA", "DEBT",
  "CASH", "COST", "GAIN", "LOSS", "LOAN", "BULL", "BEAR", "HOLD",
  "EARN", "GROW", "FALL", "RISE", "DROP", "PEAK", "BASE", "CORE",
  "REAL", "FAIR", "WIDE", "DEEP", "FAST", "SLOW", "SAFE", "FREE",
  "OPEN", "NEXT", "LAST", "BOTH", "EACH", "LESS", "MORE", "SAME",
  "PLAN", "TERM", "FLOW", "BOOK", "MARK", "MOVE", "PLAY", "WORK",
  "FIRM", "DEAL", "PART", "SIDE", "LINE", "TYPE", "FORM", "VIEW",
  "WEEK", "DAYS", "HOUR", "TIME", "DATE", "HALF", "FULL", "MAIN",
  "AREA", "UNIT", "SIZE", "RATE", "PACE", "STEP", "ROLE", "CASE",
  "MEAN", "NEED", "WANT", "KEEP", "SHOW", "HELP", "LEAD", "PUSH",
  "PULL", "HOLD", "SELL", "SWAP", "LOCK", "STOP", "WAIT", "STAY",
  "RISE", "FALL", "GROW", "SLOW", "FAST", "HIGH", "WIDE", "DEEP",
  "MACRO", "MICRO", "ALPHA", "DELTA", "SIGMA", "THETA", "GAMMA",
  "YIELD", "PRICE", "VALUE", "SHARE", "STOCK", "TRADE", "ASSET",
  "HEDGE", "INDEX", "RATIO", "SCORE", "TREND", "CYCLE", "PHASE",
  "LEVEL", "RANGE", "SCALE", "CURVE", "SLOPE", "POINT", "CHART",
  "MODEL", "FRAME", "LAYER", "STAGE", "ROUND", "LIMIT", "FLOOR",
  "SECTOR", "MARKET", "GLOBAL", "FACTOR", "SIGNAL", "REGIME",
  "RETURN", "PROFIT", "MARGIN", "VOLUME", "SPREAD", "IMPACT",
  "GROWTH", "INCOME", "EQUITY", "CREDIT", "SUPPLY", "DEMAND",
  "POLICY", "FISCAL", "DOLLAR", "RUPEE", "POUND", "FRANC",
  // Non-tradeable brand/generic names used as plain English words (not exchange-listed tickers)
  "SAMSUNG", "SONY", "HONDA", "TOYOTA", "FORD", "GENERAL",
  "ROBINHOOD", "DISCORD", "STRIPE", "MASTER",
]);

/** Asset enrichment data fetched from DB and passed to context builder. */
export interface AssetEnrichment {
  performanceData?: Record<string, unknown> | null;
  signalStrength?: Record<string, unknown> | null;
  scoreDynamics?: Record<string, unknown> | null;
  factorAlignment?: Record<string, unknown> | null;
  marketCap?: string | null;
  metadata?: Record<string, unknown> | null;
  type?: string;
  description?: string | null;
  industry?: string | null;
  sector?: string | null;
  cryptoIntelligence?: Record<string, unknown> | null;
  category?: string | null;
  currency?: string | null;
  coingeckoId?: string | null;
  region?: string | null;
}
