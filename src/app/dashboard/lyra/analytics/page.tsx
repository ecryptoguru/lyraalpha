"use client";

import { useEffect, useState } from "react";
import { ThumbsUp, ThumbsDown, TrendingUp, Activity, BarChart3, MessageSquare, Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { PageHeader, StatChip } from "@/components/dashboard/page-header";
import { getFriendlySymbol } from "@/lib/format-utils";

interface FeedbackAnalytics {
  summary: { total: number; thumbsUp: number; thumbsDown: number; satisfactionRate: number | null };
  byModel: { model: string; count: number; avgVote: number }[];
  byTier: { tier: string; count: number; avgVote: number }[];
  recent: {
    id: string;
    vote: number;
    query: string;
    responseSnippet?: string;
    symbol?: string;
    queryTier?: string;
    model?: string;
    createdAt: string;
    user: { email: string };
  }[];
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
  index = 0,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
  index?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.4, ease: "easeOut" }}
      className="rounded-4xl border border-white/10 bg-card/70 p-6 shadow-[0_24px_80px_-36px_rgba(2,6,23,0.72)] backdrop-blur-xl flex flex-col gap-3"
    >
      <div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center", color ?? "bg-primary/10")}>
        <Icon className="w-5 h-5 text-primary" />
      </div>
      <div>
        <div className="text-2xl font-bold text-foreground">{value}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
        {sub && <div className="text-[10px] text-muted-foreground/50 mt-1">{sub}</div>}
      </div>
    </motion.div>
  );
}

function VoteBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, ((value + 1) / 2) * 100));
  return (
    <div className="h-1.5 bg-muted/30 rounded-full overflow-hidden w-full">
      <div
        className={cn("h-full rounded-full transition-all", pct >= 60 ? "bg-success" : pct >= 40 ? "bg-warning" : "bg-danger")}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/** Shows first 2 chars + masked middle, e.g. ankit@ecryptoguru.com → an***@e***.com */
function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  const maskedLocal = local.slice(0, 2) + "***";
  const maskedDomain = domain.slice(0, 1) + "***" + domain.slice(domain.lastIndexOf("."));
  return `${maskedLocal}@${maskedDomain}`;
}

export default function LyraAnalyticsPage() {
  const [data, setData] = useState<FeedbackAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/lyra/feedback/analytics")
      .then((r) => {
        if (!r.ok) throw new Error(r.status === 403 ? "Access denied" : `HTTP ${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch((e: Error) => setError(e.message ?? "Failed to load analytics"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground">{error ?? "No data"}</div>
    );
  }

  const { summary, byModel, byTier, recent } = data;

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-3 sm:p-4 md:p-6 pb-6">
      <PageHeader
        icon={<Bot className="h-5 w-5" />}
        title="Lyra Feedback Analytics"
        eyebrow="Quality telemetry"
        chips={
          <>
            <StatChip value={summary.total} label="Rated" variant="gold" />
            <StatChip value={summary.thumbsUp} label="Positive" variant="green" />
            <StatChip
              value={summary.satisfactionRate != null ? `${summary.satisfactionRate}%` : "—"}
              label="Satisfaction"
              variant={summary.satisfactionRate != null && summary.satisfactionRate >= 70 ? "green" : summary.satisfactionRate != null && summary.satisfactionRate >= 50 ? "gold" : "red"}
            />
          </>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard index={0} icon={Activity} label="Total Responses Rated" value={summary.total} />
        <StatCard
          index={1}
          icon={TrendingUp}
          label="Satisfaction Rate"
          value={summary.satisfactionRate != null ? `${summary.satisfactionRate}%` : "—"}
          sub="Thumbs Up / Total"
          color={
            summary.satisfactionRate == null
              ? "bg-muted/10"
              : summary.satisfactionRate >= 70
              ? "bg-success/10"
              : summary.satisfactionRate >= 50
              ? "bg-warning/10"
              : "bg-danger/10"
          }
        />
        <StatCard index={2} icon={ThumbsUp} label="Positive Votes" value={summary.thumbsUp} color="bg-success/10" />
        <StatCard index={3} icon={ThumbsDown} label="Negative Votes" value={summary.thumbsDown} color="bg-danger/10" />
      </div>

      {/* By Model & By Tier */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-4xl border border-white/10 bg-card/70 p-6 shadow-[0_24px_80px_-36px_rgba(2,6,23,0.72)] backdrop-blur-xl space-y-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">By Model</h3>
          </div>
          {byModel.length === 0 ? (
            <p className="text-xs text-muted-foreground">No data yet</p>
          ) : (
            byModel.map((item) => (
              <div key={item.model} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono text-foreground/80 truncate max-w-[200px]">{item.model}</span>
                  <span className="text-muted-foreground">{item.count} votes · avg {item.avgVote > 0 ? "+" : ""}{item.avgVote}</span>
                </div>
                <VoteBar value={item.avgVote} />
              </div>
            ))
          )}
        </div>

        <div className="rounded-4xl border border-white/10 bg-card/70 p-6 shadow-[0_24px_80px_-36px_rgba(2,6,23,0.72)] backdrop-blur-xl space-y-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">By Query Tier</h3>
          </div>
          {byTier.length === 0 ? (
            <p className="text-xs text-muted-foreground">No data yet</p>
          ) : (
            byTier.map((item) => (
              <div key={item.tier} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-foreground/80">{item.tier ?? "Unknown"}</span>
                  <span className="text-muted-foreground">{item.count} votes · avg {item.avgVote > 0 ? "+" : ""}{item.avgVote}</span>
                </div>
                <VoteBar value={item.avgVote} />
              </div>
            ))
          )}
        </div>
      </div>

      {/* Recent Feedback */}
      <div className="rounded-4xl border border-white/10 bg-card/70 p-6 shadow-[0_24px_80px_-36px_rgba(2,6,23,0.72)] backdrop-blur-xl space-y-4">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Recent Feedback</h3>
        </div>
        {recent.length === 0 ? (
          <p className="text-xs text-muted-foreground">No feedback yet — responses will appear here after users rate them.</p>
        ) : (
          <div className="space-y-3">
            {recent.map((item) => (
              <div
                key={item.id}
                className={cn(
                  "p-4 rounded-2xl border text-sm transition-colors",
                  item.vote === 1
                    ? "border-success/20 bg-success/5"
                    : "border-danger/20 bg-danger/5",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground line-clamp-1">{item.query}</p>
                    {item.responseSnippet && (
                      <p className="text-xs text-muted-foreground/60 mt-1 line-clamp-1 italic">{item.responseSnippet}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      {item.symbol && (
                        <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-lg">{getFriendlySymbol(item.symbol)}</span>
                      )}
                      {item.queryTier && (
                        <span className="text-[10px] text-muted-foreground/50 font-mono">{item.queryTier}</span>
                      )}
                      <span className="text-[10px] text-muted-foreground/40">{maskEmail(item.user.email)}</span>
                      <span className="text-[10px] text-muted-foreground/30 ml-auto">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  {item.vote === 1 ? (
                    <ThumbsUp className="w-4 h-4 text-success shrink-0 mt-0.5" />
                  ) : (
                    <ThumbsDown className="w-4 h-4 text-danger shrink-0 mt-0.5" />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
