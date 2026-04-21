import type { StressResult } from "./types";

// ── Pure functions extracted from stress-test page for testability ──────────

/** Format a decimal value as a percentage string, or "—" for null */
export const fmt = (v: number | null, suffix = "%") =>
  v === null ? "—" : `${v > 0 ? "+" : ""}${(v * 100).toFixed(1)}${suffix}`;

/** Build normalised chart data from multiple stress results */
export function buildChartData(results: StressResult[]) {
  const allDays = Array.from(new Set(results.flatMap((r) => r.dailyPath.map((p) => p.day)))).sort((a, b) => a - b);

  const nearestPoints = new Map<string, Map<number, number>>();

  for (const result of results) {
    const lookup = new Map<number, number>();
    let pointer = 0;

    for (const day of allDays) {
      while (
        pointer < result.dailyPath.length - 1
        && Math.abs(result.dailyPath[pointer + 1].day - day) <= Math.abs(result.dailyPath[pointer].day - day)
      ) {
        pointer += 1;
      }

      lookup.set(day, Math.round(result.dailyPath[pointer].drawdown * 10000) / 100);
    }

    nearestPoints.set(result.symbol, lookup);
  }

  return allDays.map((day) => {
    const entry: Record<string, number | string> = { day };

    for (const result of results) {
      const lookup = nearestPoints.get(result.symbol);
      const value = lookup?.get(day);
      if (value != null) {
        entry[result.symbol] = value;
      }
    }

    return entry;
  });
}

/** Derive a human-readable error message from the stress test API response */
export function getStressTestErrorMessage(status: number, payload: { error?: string; message?: string } | null) {
  const fallback = "Stress test failed. Please try again.";

  if (status === 402) {
    return payload?.message ?? "You do not have enough credits to run this stress test.";
  }

  if (status === 403) {
    return payload?.error === "Elite plan required"
      ? "Stress Test is available on Elite and Enterprise plans."
      : payload?.message ?? payload?.error ?? fallback;
  }

  if (status === 400) {
    return payload?.message ?? payload?.error ?? "Please check your symbols and scenario selection.";
  }

  return payload?.message ?? payload?.error ?? fallback;
}

/** Format a scenario period with cached Intl.DateTimeFormat */
const _periodFormatter = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" });
export function formatScenarioPeriod(period: { start: string; end: string }) {
  const dStart = new Date(period.start);
  const dEnd = new Date(period.end);
  if (isNaN(dStart.getTime()) || isNaN(dEnd.getTime())) return `${period.start} – ${period.end}`;
  return `${_periodFormatter.format(dStart)} – ${_periodFormatter.format(dEnd)}`;
}
