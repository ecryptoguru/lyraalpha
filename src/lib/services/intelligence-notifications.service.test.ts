import { describe, expect, it } from "vitest";
import { buildDashboardNotificationEvents, buildWeeklyReportReadyEvent } from "./intelligence-notifications.service";
import type { DashboardHomeData } from "@/lib/services/dashboard-home.service";
import type { WeeklyIntelligenceReport } from "@/lib/services/weekly-intelligence-report.service";
import { createShareObject } from "@/lib/intelligence-share";

const weeklyReport: WeeklyIntelligenceReport = {
  generatedAt: "2026-03-10T00:00:00.000Z",
  region: "US",
  headline: "Shock Simulator flags fragile portfolio risk",
  summary: "Biggest risk: Fragile concentration. Best opportunity to investigate: SOL-USD — momentum is rebuilding.",
  topOpportunity: "SOL-USD — momentum is rebuilding",
  biggestRisk: "Fragile concentration",
  topNarrative: "AI capex is setting the market tone",
  href: "/dashboard?view=weekly-report",
  share: createShareObject({
    kind: "weekly_report",
    title: "Shock Simulator flags fragile portfolio risk",
    eyebrow: "Weekly intelligence report",
    takeaway: "Fragile concentration",
    context: "SOL-USD — momentum is rebuilding",
    href: "/dashboard?view=weekly-report",
    scoreLabel: "Region",
    scoreValue: "US",
  }),
};

describe("intelligence-notifications.service", () => {
  it("builds a weekly report ready event", () => {
    const event = buildWeeklyReportReadyEvent(weeklyReport);

    expect(event.type).toBe("weekly_report_ready");
    expect(event.href).toBe("/dashboard?view=weekly-report");
    expect(event.emailSubject).toContain("Weekly intelligence report");
    expect(event.dedupeKey).toContain("weekly-report:US:2026-03-10");
  });

  it("builds normalized dashboard notification events", () => {
    const home: DashboardHomeData = {
      generatedAt: "2026-03-10T00:00:00.000Z",
      region: "US",
      plan: "PRO",
      dailyBriefing: {
        region: "US",
        generatedAt: "2026-03-10T00:00:00.000Z",
        marketOverview: "The market is repricing AI leaders.",
        keyInsights: ["AI leaders regained momentum"],
        risksToWatch: ["Rate sensitivity is rising"],
        topMovers: { gainers: [], losers: [] },
        discoveryHighlight: "SOL-USD surfaced again",
        regimeLabel: "RISK_ON",
        regimeSentence: "Risk appetite is improving.",
      },
      personalBriefing: null,
      portfolioPreview: {
        id: "portfolio_1",
        name: "Main",
        holdingCount: 4,
        healthScore: 52,
        healthBand: "Fragile",
        portfolioScore: 5.8,
        portfolioScoreBand: "Fragile",
        alertHeadline: "Fragility is rising",
        alertBody: "Your portfolio is more correlated than usual.",
        missingInsight: null,
        stressHeadline: "A shock scenario deserves attention",
        stressBody: "A growth shock would hit your top holdings together.",
        shareText: "share",
        share: createShareObject({
          kind: "portfolio",
          title: "Fragility is rising",
          eyebrow: "Portfolio intelligence",
          takeaway: "Your portfolio is more correlated than usual.",
          context: "A growth shock would hit your top holdings together.",
          href: "/dashboard/portfolio",
        }),
        updatedAt: "2026-03-10T00:00:00.000Z",
      },
      discoveryPreview: [{
        id: "disc_1",
        symbol: "SOL-USD",
        name: "Solana",
        type: "CRYPTO",
        archetype: "score_inflection",
        headline: "Momentum is rebuilding",
        whySurfaced: "A key score changed quickly enough to deserve a fresh look.",
        driversLabel: "Drivers: score momentum",
        radarScore: 81,
        newToday: true,
        shareText: "share",
        share: createShareObject({
          kind: "discovery",
          title: "NVIDIA is on the radar",
          eyebrow: "Multibagger radar",
          takeaway: "Momentum is rebuilding",
          context: "A key score changed quickly enough to deserve a fresh look. Drivers: score momentum.",
          href: "/dashboard/discovery",
        }),
        changePercent: 2.4,
        computedAt: "2026-03-10T00:00:00.000Z",
        locked: false,
      }],
      narrativePreview: {
        title: "AI capex is setting the market tone",
        summary: "Capex leadership is broadening.",
        signal: "Semis are confirming the move.",
        strengthLabel: "Accelerating",
        shareText: "share",
        share: createShareObject({
          kind: "narrative",
          title: "AI capex is setting the market tone",
          eyebrow: "Narrative tracker",
          takeaway: "Capex leadership is broadening.",
          context: "Semis are confirming the move.",
          href: "/dashboard#market-intelligence",
        }),
        divergences: [],
      },
      weeklyReport: {
        headline: weeklyReport.headline,
        summary: weeklyReport.summary,
        topOpportunity: weeklyReport.topOpportunity,
        biggestRisk: weeklyReport.biggestRisk,
        topNarrative: weeklyReport.topNarrative,
        href: weeklyReport.href,
        share: weeklyReport.share,
      },
      insightFeed: [],
    };

    const events = buildDashboardNotificationEvents(home);

    expect(events.map((event) => event.type)).toEqual([
      "morning_intelligence",
      "portfolio_risk",
      "opportunity_alert",
      "narrative_change",
      "shock_warning",
      "weekly_report_ready",
    ]);
    expect(events[1]?.severity).toBe("high");
    expect(events[2]?.href).toBe("/dashboard/discovery");
    expect(events[5]?.emailSubject).toContain("Weekly intelligence report");
  });
});
