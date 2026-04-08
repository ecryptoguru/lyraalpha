"use client";

import { useState, useEffect } from "react";
import { Copy, Check, Users, Gift, Trophy } from "lucide-react";
import { ShareInsightButton } from "@/components/dashboard/share-insight-button";
import { buildReferralShareObject } from "@/lib/intelligence-share";

interface ReferralData {
  referralCode: string;
  referralLink: string;
  totalReferrals: number;
  activatedReferrals: number;
  pendingReferrals: number;
  totalCreditsEarned: number;
  currentTier: string;
  nextTier: { badge: string; referralsNeeded: number } | null;
}

export function ReferralPanel() {
  const [data, setData] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/referral")
      .then((res) => res.json())
      .then((data) => {
        if (!data.error) setData(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const copyLink = async () => {
    if (!data?.referralLink) return;
    await navigator.clipboard.writeText(data.referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const tierColors: Record<string, string> = {
    bronze: "from-amber-700 to-amber-900",
    silver: "from-gray-400 to-gray-600",
    gold: "from-yellow-400 to-yellow-600",
    platinum: "from-cyan-400 to-amber-500",
    none: "from-gray-400 to-gray-500",
  };

  const tierBadges: Record<string, string> = {
    bronze: "🥉",
    silver: "🥈",
    gold: "🥇",
    platinum: "💎",
    none: "❌",
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/5 bg-card/60 p-5 animate-pulse">
        <div className="h-6 w-32 bg-muted rounded mb-4"></div>
        <div className="h-20 bg-muted rounded"></div>
      </div>
    );
  }

  if (!data) return null;

  const referralShare = buildReferralShareObject({
    title: "Give a friend an LyraAlpha head start",
    href: "/",
    referralHref: data.referralLink,
    takeaway: "Share the product naturally first, then switch on invite mode when you want your personal referral link attached.",
    context: "Friends get 50 credits when they sign up. You get 75 credits after they start using the product.",
    inviteTakeaway: "Use my LyraAlpha link to start with 50 credits and explore the platform faster.",
    inviteContext: "Once you begin using LyraAlpha, I receive 75 credits. It is a simple way to unlock more portfolio reads, compare systems and shock simulations.",
    scoreValue: "+75 / +50 credits",
  });

  return (
    <div className="rounded-2xl border border-white/5 bg-card/60 p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <h3 className="font-bold text-foreground">Refer Friends, Earn Credits</h3>
        </div>
        <ShareInsightButton share={referralShare} label="Invite friends" />
      </div>

      {/* Referral Link */}
      <div className="mb-5">
        <p className="text-xs text-muted-foreground mb-2">Your referral link</p>
        <div className="flex gap-2">
            <input
              type="text"
              readOnly
              aria-label="Your referral link"
              value={data.referralLink}
            className="flex-1 h-10 px-3 text-xs bg-muted/50 border border-border rounded-2xl font-mono"
          />
          <button
            onClick={copyLink}
            className="h-10 px-4 bg-primary text-primary-foreground rounded-2xl flex items-center gap-2 hover:bg-primary/90 transition-colors"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            <span className="text-xs font-medium">{copied ? "Copied!" : "Copy"}</span>
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-muted/30 rounded-2xl p-3">
          <p className="text-[10px] uppercase text-muted-foreground font-bold">Total Referrals</p>
          <p className="text-2xl font-bold text-foreground">{data.totalReferrals}</p>
        </div>
        <div className="bg-muted/30 rounded-2xl p-3">
          <p className="text-[10px] uppercase text-muted-foreground font-bold">Credits Earned</p>
          <p className="text-2xl font-bold text-green-500">+{data.totalCreditsEarned}</p>
        </div>
      </div>

      {/* Tier Progress */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">{tierBadges[data.currentTier]}</span>
            <span className="text-sm font-bold text-foreground capitalize">{data.currentTier} Tier</span>
          </div>
          {data.nextTier && (
            <span className="text-xs text-muted-foreground">
              {data.nextTier.referralsNeeded} more for {data.nextTier.badge}
            </span>
          )}
        </div>
        <div className="h-2 bg-muted/50 rounded-full overflow-hidden">
          <div
            className={`h-full bg-linear-to-r ${tierColors[data.currentTier]} transition-all duration-500`}
            style={{ width: `${Math.min((data.totalReferrals / (data.nextTier?.referralsNeeded || 1)) * 100, 100)}%` }}
          />
        </div>
      </div>

      {/* How it works */}
      <div className="text-xs text-muted-foreground space-y-1">
        <p className="flex items-center gap-2">
          <Gift className="h-3 w-3 text-green-500" />
          Friend signs up → They get <span className="text-green-500 font-bold">50 credits</span>
        </p>
        <p className="flex items-center gap-2">
          <Trophy className="h-3 w-3 text-amber-500" />
          They use 10 credits → You get <span className="text-amber-500 font-bold">75 credits</span>
        </p>
      </div>
    </div>
  );
}
