import { formatRegime, normalizeShareText, parseRiskMetricsWithFragility } from "@/lib/engines/portfolio-utils";
import type { ParsedRiskMetricsWithFragility } from "@/lib/engines/portfolio-utils";

export type PortfolioHealthBand = "Strong" | "Balanced" | "Fragile" | "High Risk" | null;

export interface PortfolioAlertSnapshot {
  healthScore: number | null;
  concentrationScore?: number | null;
  correlationScore?: number | null;
  fragilityScore?: number | null;
  regime?: string | null;
  riskMetrics?: unknown;
}

export interface PortfolioAlertSummary {
  headline: string;
  body: string;
  missingInsight: string | null;
  stressHeadline: string;
  stressBody: string;
  shareText: string;
  tone: "neutral" | "warning" | "positive";
  priority: number;
  portfolioScore: number | null;
  portfolioScoreBand: string | null;
  portfolioScoreHeadline: string | null;
  portfolioScoreBody: string | null;
  portfolioScoreAction: string | null;
}


export function getPortfolioHealthBand(score: number | null): PortfolioHealthBand {
  if (score == null) return null;
  if (score >= 75) return "Strong";
  if (score >= 55) return "Balanced";
  if (score >= 40) return "Fragile";
  return "High Risk";
}

export function buildPortfolioAlertSummary(snapshot: PortfolioAlertSnapshot | null): PortfolioAlertSummary | null {
  if (!snapshot || snapshot.healthScore == null) return null;

  const concentration = snapshot.concentrationScore ?? 50;
  const correlation = snapshot.correlationScore ?? 50;
  const fragility = snapshot.fragilityScore ?? 50;
  const metrics: ParsedRiskMetricsWithFragility = parseRiskMetricsWithFragility(snapshot.riskMetrics);
  const regimeLabel = formatRegime(metrics.currentMarketRegime ?? snapshot.regime);

  let headline = metrics.portfolioScoreHeadline ?? "Portfolio risk looks contained";
  let body = metrics.portfolioScoreBody ?? "No major imbalance is standing out right now, but you should still keep checking for changes in concentration, overlap and fragility.";
  let missingInsight: string | null = null;
  let stressHeadline = metrics.portfolioScoreAction ?? "Stress test this portfolio before a shock";
  let stressBody = "Run a shock scenario to see which holdings would drive the downside if markets turn fast.";
  let tone: PortfolioAlertSummary["tone"] = "neutral";
  let priority = 35;

  if (metrics.portfolioScore != null) {
    const band = metrics.portfolioScoreBand ?? (metrics.portfolioScore >= 7 ? "Strong" : metrics.portfolioScore >= 5.5 ? "Balanced" : metrics.portfolioScore >= 4 ? "Fragile" : "High Risk");
    if (band === "Strong") {
      tone = "positive";
      priority = 48;
    } else if (band === "Balanced") {
      tone = "neutral";
      priority = 60;
    } else {
      tone = "warning";
      priority = 78;
    }
  }

  const highMismatch = metrics.regimeMismatchLabel === "High mismatch" || (metrics.averageCompatibilityScore ?? 100) < 45 || metrics.weakCompatibilityCount >= 2;
  const moderateMismatch = metrics.regimeMismatchLabel === "Moderate mismatch" || (metrics.averageCompatibilityScore ?? 100) < 60 || metrics.weakCompatibilityCount >= 1;

  if (highMismatch) {
    headline = "Your portfolio is leaning the wrong way for this market regime";
    body = metrics.regimeMismatchReason
      ?? (regimeLabel
        ? `The current ${regimeLabel} backdrop looks less supportive for a meaningful part of your portfolio than recent price action may suggest.`
        : "Several holdings look poorly matched to the current market backdrop, which can quietly increase downside risk.");
    missingInsight = regimeLabel
      ? `You may be positioned for a different regime than the engine sees right now, which can turn normal volatility into a sharper drawdown in a ${regimeLabel} tape.`
      : "You may be missing how quickly the market backdrop can make a familiar portfolio behave differently.";
    stressHeadline = "Regime mismatch alert: stress test this portfolio now";
    stressBody = regimeLabel
      ? `Use the shock simulator to see how this portfolio behaves if the ${regimeLabel} regime deepens or spreads across more assets.`
      : "Use the shock simulator to see how a tougher macro backdrop would affect your most exposed holdings.";
    tone = "warning";
    priority = 96;
  } else if (concentration < 45) {
    headline = "A small part of your portfolio is now carrying too much risk";
    body = metrics.dominantSector && metrics.concentrationWeight != null
      ? `${metrics.dominantSector} now drives about ${metrics.concentrationWeight.toFixed(0)}% of portfolio value, which can let one weak pocket dominate total outcomes.`
      : "Your concentration score suggests one cluster of holdings may now dominate outcomes more than you expect.";
    missingInsight = "You may be missing how much one sector or theme is driving overall portfolio behavior.";
    tone = "warning";
    priority = 90;
  } else if (correlation < 45) {
    headline = "Your holdings may be more overlapping than they look";
    body = "Several positions may still sell off together, even if they look diversified on the surface.";
    missingInsight = "You may be missing hidden overlap across holdings that share the same market drivers.";
    tone = "warning";
    priority = 84;
  } else if (fragility >= 65) {
    headline = "This portfolio could react sharply if markets turn hostile";
    body = metrics.fragilityTopDrivers.length > 0
      ? `${metrics.fragilityTopDrivers[0]} is the main fragility driver right now, which raises downside sensitivity in a tougher market.`
      : "Fragility is elevated, which means several holdings may weaken together in a market shock.";
    missingInsight = "You may be missing how quickly a regime shift could turn a healthy-looking portfolio into a stressed one.";
    stressHeadline = "Shock alert: this portfolio deserves a stress test";
    stressBody = "Use the shock simulator to see how a rate shock, recession-style selloff or crisis regime could affect your holdings.";
    tone = "warning";
    priority = 82;
  } else if (snapshot.healthScore < 55) {
    headline = "Portfolio health has slipped enough to deserve a closer look";
    body = "The portfolio still works, but the balance between diversification, concentration and resilience is weaker than it should be.";
    missingInsight = "You may be missing a gradual deterioration that did not come from one obvious holding.";
    tone = "warning";
    priority = 74;
  } else if (moderateMismatch) {
    headline = "This portfolio is only partly aligned with the current regime";
    body = metrics.regimeMismatchReason
      ?? (regimeLabel
        ? `The current ${regimeLabel} backdrop supports some holdings, but a few positions still look out of sync with the market engine.`
        : "Some holdings still look out of sync with the current market backdrop, even though the overall portfolio remains workable.");
    missingInsight = metrics.topCompatibilityDrag.length > 0
      ? `${metrics.topCompatibilityDrag.slice(0, 2).join(" and ")} look least aligned with the current backdrop.`
      : "You may be missing subtle regime mismatch inside an otherwise stable-looking portfolio.";
    tone = "neutral";
    priority = 58;
  } else if ((metrics.averageCompatibilityScore ?? 0) >= 72 && snapshot.healthScore >= 70) {
    headline = metrics.portfolioScoreHeadline ?? "Your portfolio still fits the current market backdrop";
    body = regimeLabel
      ? `Most holdings still look compatible with the current ${regimeLabel} regime, which supports the portfolio's resilience so far.`
      : "Most holdings still look broadly aligned with the current market backdrop, which supports portfolio resilience.";
    missingInsight = null;
    tone = "positive";
    priority = 42;
  }

  return {
    headline,
    body,
    missingInsight,
    stressHeadline,
    stressBody,
    shareText: normalizeShareText(
      `${headline}. ${body}${metrics.portfolioScore != null ? ` Portfolio score: ${metrics.portfolioScore.toFixed(1)} / 10.` : ""}`,
    ),
    tone,
    priority,
    portfolioScore: metrics.portfolioScore,
    portfolioScoreBand: metrics.portfolioScoreBand,
    portfolioScoreHeadline: metrics.portfolioScoreHeadline,
    portfolioScoreBody: metrics.portfolioScoreBody,
    portfolioScoreAction: metrics.portfolioScoreAction,
  };
}
