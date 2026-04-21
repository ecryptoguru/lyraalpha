export interface ScenarioDayPoint {
  day: number;
  drawdown: number; // cumulative drawdown from start, e.g. -0.15 = -15%
}

export type StressScenarioId =
  | "gfc-2008"
  | "covid-2020"
  | "rate-shock-2022"
  | "recession"
  | "interest-rate-shock"
  | "tech-bubble-crash"
  | "oil-spike";

export type StressScenarioSeverity = "Extreme" | "Severe" | "Moderate";

export type StressShockType =
  | "credit-crunch"
  | "pandemic"
  | "rate-shock"
  | "recession"
  | "tech-bubble"
  | "oil-spike";

export type SupportedStressAssetType =
  | "CRYPTO"
  | "DEFI"
  | "NFTS"
  | "LAYER1"
  | "LAYER2";

export interface ScenarioProxyPath {
  proxy: string; // proxy symbol label (e.g. "BTC-USD", "ETH-USD")
  label: string; // human label
  path: ScenarioDayPoint[];
  totalReturn: number; // total period return, e.g. -0.38
  maxDrawdown: number; // peak to trough, e.g. -0.57
}

export interface ScenarioFactors {
  equity: number; // broad equity return over scenario
  rates: number; // long bond return
  gold: number; // gold return
  usd: number; // USD index return (pos = USD strength)
  oil: number; // crude oil return
  credit: number; // HY credit spread widening proxy (negative = bad)
}

export interface ScenarioAssetAdjustmentRule {
  betaMultiplier: number;
  confidenceDelta: number;
  rationale: string;
}

export interface ScenarioNarrative {
  headline: string;
  howItTransmits: string;
  dominantDrivers: string[];
  pressurePoints: string[];
  resilienceThemes: string[];
}

export interface ScenarioDefinition {
  id: StressScenarioId;
  name: string;
  region: "US" | "IN";
  period: { start: string; end: string };
  description: string;
  color: string; // tailwind color class prefix
  severity?: StressScenarioSeverity;
  shockType?: StressShockType;
  narrative?: ScenarioNarrative;
  proxyPaths: ScenarioProxyPath[];
  factors: ScenarioFactors;
  assetTypeAdjustments?: Partial<Record<SupportedStressAssetType, ScenarioAssetAdjustmentRule>>;
}

export interface StressResult {
  symbol: string;
  name: string;
  type: string;
  region: string;
  scenarioId: string;
  method: "DIRECT" | "PROXY" | "ERROR";
  drawdown: number | null;
  periodReturn: number | null;
  maxDrawdown: number | null;
  dailyPath: ScenarioDayPoint[];
  proxyUsed: string | null;
  proxyLabel?: string | null;
  beta: number | null;
  confidence: number;
  factors: ScenarioFactors | null;
  dataPoints?: number;
  scenarioPeriod?: { start: string; end: string };
  scenarioSeverity?: StressScenarioSeverity | null;
  driverSummary?: string | null;
  transmissionMechanism?: string | null;
  pressurePoints?: string[];
  resilienceThemes?: string[];
  dominantDrivers?: string[];
  rationale?: string | null;
  explanationMethod?: string | null;
  error?: string;
}
