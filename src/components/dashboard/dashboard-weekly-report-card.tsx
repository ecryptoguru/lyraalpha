import Link from "next/link";
import { FileText, ArrowRight } from "lucide-react";
import { ShareInsightButton } from "@/components/dashboard/share-insight-button";
import type { DashboardWeeklyReportPreview } from "@/lib/services/dashboard-home.service";

export function DashboardWeeklyReportCard({ report }: { report: DashboardWeeklyReportPreview | null }) {
  if (!report) {
    return (
      <div className="rounded-2xl border border-white/10 bg-card/60 backdrop-blur-xl shadow-xl p-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Weekly intelligence</p>
        <h2 className="mt-2 text-xl font-bold tracking-tight text-foreground">Your weekly report will appear here</h2>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          Once your market, narrative and portfolio loops are active, this report will summarize the biggest risk, best opportunity and the market story that mattered most.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-primary/20 bg-primary/5 backdrop-blur-xl shadow-xl p-5 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Weekly intelligence report</p>
          <h2 className="mt-2 text-xl md:text-2xl font-bold tracking-tight text-foreground">{report.headline}</h2>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed max-w-3xl">{report.summary}</p>
        </div>
        <div className="h-10 w-10 rounded-2xl border border-primary/20 bg-primary/10 flex items-center justify-center text-primary shrink-0">
          <FileText className="h-4 w-4" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-white/10 bg-background/60 p-4">
          <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Biggest risk</p>
          <p className="mt-2 text-sm font-semibold text-foreground leading-relaxed">{report.biggestRisk ?? "No major risk surfaced this week."}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-background/60 p-4">
          <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Top opportunity</p>
          <p className="mt-2 text-sm font-semibold text-foreground leading-relaxed">{report.topOpportunity ?? "No standout opportunity yet."}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-background/60 p-4">
          <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Top narrative</p>
          <p className="mt-2 text-sm font-semibold text-foreground leading-relaxed">{report.topNarrative ?? "No dominant narrative change detected."}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={report.href}
          className="inline-flex items-center gap-2 rounded-2xl border border-primary/25 bg-primary/10 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-primary hover:bg-primary/15 transition-colors"
        >
          Review weekly report
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
        <ShareInsightButton share={report.share} label="Share weekly view" />
      </div>
    </div>
  );
}
