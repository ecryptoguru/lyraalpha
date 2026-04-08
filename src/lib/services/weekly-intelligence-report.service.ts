import type { PlanTier } from "@/lib/ai/config";
import type { IntelligenceShareObject } from "@/lib/intelligence-share";
import {
  buildWeeklyReportFallback,
  DashboardHomeService,
  type DashboardWeeklyReportPreview,
} from "@/lib/services/dashboard-home.service";

export interface WeeklyIntelligenceReport extends DashboardWeeklyReportPreview {
  generatedAt: string;
  region: string;
  share: IntelligenceShareObject;
}

export class WeeklyIntelligenceReportService {
  static async getReport(userId: string, region: string, plan: PlanTier): Promise<WeeklyIntelligenceReport> {
    const home = await DashboardHomeService.getHome(userId, region, plan);
    const weeklyReport = home.weeklyReport ?? buildWeeklyReportFallback();

    return {
      ...weeklyReport,
      generatedAt: home.generatedAt,
      region,
    };
  }
}
