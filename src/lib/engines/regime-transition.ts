import { HistoricalAnalogResult } from "./historical-analog";

export interface RegimeChangeProbability {
  [regime: string]: number;
}

export function estimateRegimeChangeProbability(
  currentRegime: string,
  historicalAnalogs: HistoricalAnalogResult[]
): RegimeChangeProbability {
  if (!historicalAnalogs || historicalAnalogs.length === 0) {
    return {};
  }

  const transitions = historicalAnalogs.map((a) => a.regimeState);
  
  const transitionCounts: Record<string, number> = {};
  for (const nextRegime of transitions) {
    transitionCounts[nextRegime] = (transitionCounts[nextRegime] || 0) + 1;
  }

  const probabilities: RegimeChangeProbability = {};
  for (const [regime, count] of Object.entries(transitionCounts)) {
    probabilities[`${currentRegime} -> ${regime}`] = count / historicalAnalogs.length;
  }

  return probabilities;
}
