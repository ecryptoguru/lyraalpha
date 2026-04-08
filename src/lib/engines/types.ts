export interface OHLCV {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  events?: { type: string; title: string; date: string }[];
}

export interface LyraContext {
  scores?: {
    trend?: number;
    momentum?: number;
    volatility?: number;
    liquidity?: number;
    trust?: number;
    sentiment?: number;
  };
  regime?: string;
  symbol?: string;
  assetName?: string;
  assetType?: string;
  /** Preferred market region for this conversation — used to inject [MACRO_CONTEXT] and
   *  select region-specific MACRO_STRATEGIST guidance. */
  region?: "US" | "IN";
  /** Signals a specialised multi-asset mode (Compare / Stress Test / Macro Research) that
   *  should receive Elite COMPLEX tier quality regardless of the user's plan tier. */
  chatMode?: "compare" | "stress-test" | "macro-research";
  compareContext?: Array<{
    symbol: string;
    name?: string;
    scores?: Record<string, number | null>;
    signal?: number | null;
    signalLabel?: string;
    factorAlignment?: Record<string, unknown> | null;
    performance?: Record<string, number | null>;
  }>;
}

export interface ExplanationData {
  title: string;
  score: number;
  definition: string;
  drivers: string[];
  context: string;
  limitations: string;
}

export interface SignalConfig {
  period?: number;
  smoothing?: number;
}

export type SignalDirection = "UP" | "DOWN" | "FLAT" | "NEUTRAL";

export interface EngineResult {
  score: number; // 0-100
  direction: SignalDirection;
  context: string; // "Strong Uptrend detected"
  metadata?: Record<string, unknown>; // Debug info (e.g. sma200 value)
}
