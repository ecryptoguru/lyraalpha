import DOMPurify from "dompurify";
import { CryptoStructuralRiskCard } from "@/components/analytics/crypto-structural-risk-card";
import { AssetExternalLinks } from "@/components/dashboard/analytics/AssetExternalLinks";
import { cn, formatCompactNumber } from "@/lib/utils";
import type { RegionFormat } from "@/lib/utils";
import type { AssetAnalytics, AssetPageCryptoMeta } from "./asset-page-helpers";
import type {
  CryptoStructuralRisk,
  EnhancedCryptoTrust,
  HolderStabilityScore,
  LiquidityRiskScore,
  NetworkActivityScore,
} from "@/lib/engines/crypto-intelligence";

interface AssetCryptoProfileSectionProps {
  analyticsComputed: AssetAnalytics;
  cgMeta: AssetPageCryptoMeta | null;
}

export function AssetCryptoProfileSection({
  analyticsComputed,
  cgMeta,
}: AssetCryptoProfileSectionProps) {
  if (analyticsComputed.type !== "CRYPTO" || !cgMeta) return null;

  const hasProfileContent = !!(
    analyticsComputed.description ||
    (cgMeta.categories && cgMeta.categories.length > 0) ||
    cgMeta.genesisDate ||
    cgMeta.hashingAlgorithm ||
    (cgMeta.links && (
      cgMeta.links.homepage?.length ||
      cgMeta.links.github?.length ||
      cgMeta.links.twitter ||
      cgMeta.links.reddit ||
      cgMeta.links.whitepaper ||
      cgMeta.links.blockchain?.length ||
      cgMeta.links.telegram
    ))
  );

  if (!hasProfileContent) return null;

  return (
    <div className="space-y-4 pt-4">
      <h3 className="text-lg font-bold tracking-tight flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-emerald-500" />
        Crypto Profile & Ecosystem
      </h3>
      <div className="bg-card/60 backdrop-blur-2xl border border-border/30 dark:border-white/5 shadow-xl p-5 rounded-3xl space-y-6">
        {analyticsComputed.description ? (
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">About</p>
            <p
              className="text-sm text-muted-foreground leading-relaxed line-clamp-6"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(analyticsComputed.description || "") }}
            />
          </div>
        ) : null}

        {((cgMeta.categories && cgMeta.categories.length > 0) || cgMeta.genesisDate || cgMeta.hashingAlgorithm) ? (
          <div className="space-y-3">
            {cgMeta.categories && cgMeta.categories.length > 0 ? (
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Categories</p>
                <div className="flex flex-wrap gap-1.5">
                  {cgMeta.categories.slice(0, 6).map((category) => (
                    <span key={category} className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-bold text-emerald-500 uppercase tracking-wider">
                      {category}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
            {cgMeta.genesisDate ? (
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Genesis Date</p>
                <p className="text-sm font-bold text-foreground">
                  {new Date(cgMeta.genesisDate).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
                </p>
              </div>
            ) : null}
            {cgMeta.hashingAlgorithm ? (
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Hashing Algorithm</p>
                <p className="text-sm font-bold text-foreground">{cgMeta.hashingAlgorithm}</p>
              </div>
            ) : null}
          </div>
        ) : null}

        <AssetExternalLinks links={cgMeta.links} />
      </div>
    </div>
  );
}

interface AssetCryptoDiagnosticsSectionProps {
  analyticsComputed: AssetAnalytics;
  cgMeta: AssetPageCryptoMeta | null;
  currencyRegion: RegionFormat;
}

export function AssetCryptoDiagnosticsSection({
  analyticsComputed,
  cgMeta,
  currencyRegion,
}: AssetCryptoDiagnosticsSectionProps) {
  if (analyticsComputed.type !== "CRYPTO") return null;

  const intelligence = analyticsComputed.cryptoIntelligence as Record<string, unknown> | null;
  const networkActivity = intelligence?.networkActivity as Record<string, unknown> | undefined;
  const liquidityRisk = intelligence?.liquidityRisk as Record<string, unknown> | undefined;
  const structuralRisk = intelligence?.structuralRisk as Record<string, unknown> | undefined;
  const enhancedTrust = intelligence?.enhancedTrust as Record<string, unknown> | undefined;
  const holderStability = intelligence?.holderStability as Record<string, unknown> | undefined;
  const liquidity = liquidityRisk as Partial<LiquidityRiskScore> | undefined;
  const network = networkActivity as Partial<NetworkActivityScore> | undefined;

  const hasSentiment = !!(cgMeta && (cgMeta.sentimentVotesUpPercentage != null || cgMeta.sentimentVotesDownPercentage != null));
  const hasCommunity = !!(
    cgMeta && (
      (cgMeta.community?.redditSubscribers && cgMeta.community.redditSubscribers > 0) ||
      (cgMeta.community?.telegramUsers && cgMeta.community.telegramUsers > 0) ||
      (cgMeta.watchlistUsers && cgMeta.watchlistUsers > 0)
    )
  );
  const hasSocialPulse = hasSentiment || hasCommunity || !!liquidity;
  const networkScore = network?.score != null ? Number(network.score) : null;
  const networkLabel =
    (network as { label?: string } | undefined)?.label ??
    (networkScore == null
      ? "—"
      : networkScore >= 70
        ? "Strong"
        : networkScore >= 45
          ? "Moderate"
          : "Weak");
  const liquidityVolMcap = (liquidity as { volumeToMcap?: number; volumeMarketCapScore?: number } | undefined)?.volumeToMcap
    ?? (liquidity as { volumeToMcap?: number; volumeMarketCapScore?: number } | undefined)?.volumeMarketCapScore;
  const liquidityDexDepth = (liquidity as { dexLiquidity?: number; dexDepthScore?: number } | undefined)?.dexLiquidity
    ?? (liquidity as { dexLiquidity?: number; dexDepthScore?: number } | undefined)?.dexDepthScore;
  const liquidityExchange = (liquidity as { exchangePresence?: number; exchangePresenceScore?: number } | undefined)?.exchangePresence
    ?? (liquidity as { exchangePresence?: number; exchangePresenceScore?: number } | undefined)?.exchangePresenceScore;
  const liquidityPoolDist = (liquidity as { poolConcentration?: number; poolDistributionScore?: number } | undefined)?.poolConcentration
    ?? (liquidity as { poolConcentration?: number; poolDistributionScore?: number } | undefined)?.poolDistributionScore;
  const hasBuilderHealth = !!(
    network ||
    (cgMeta?.developer && (
      cgMeta.developer.commitCount4Weeks ||
      cgMeta.developer.stars ||
      cgMeta.developer.forks ||
      cgMeta.developer.pullRequestsMerged ||
      cgMeta.developer.totalIssues ||
      cgMeta.developer.subscribers
    ))
  );

  if (!hasSocialPulse && !hasBuilderHealth && !(structuralRisk && enhancedTrust && holderStability)) {
    return null;
  }

  return (
    <div className="space-y-4 pt-4">
      <h3 className="text-lg font-bold tracking-tight flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-emerald-500" />
        Crypto Diagnostics
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {hasSocialPulse ? (
          <div className="backdrop-blur-2xl border-border/30 dark:border-white/5 shadow-xl h-full min-h-[280px] p-5 rounded-3xl border bg-card/60 space-y-4">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Social Pulse</p>
            {hasSentiment ? (
              <div className="grid grid-cols-2 gap-3">
                <SentimentBar
                  label="Bullish"
                  tone="positive"
                  value={cgMeta?.sentimentVotesUpPercentage ?? 0}
                />
                <SentimentBar
                  label="Bearish"
                  tone="negative"
                  value={cgMeta?.sentimentVotesDownPercentage ?? 0}
                />
              </div>
            ) : null}
            {hasCommunity ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {cgMeta?.community?.redditSubscribers != null && cgMeta.community.redditSubscribers > 0 ? (
                  <MetricStat
                    label="Reddit Subscribers"
                    value={formatCompactNumber(cgMeta.community.redditSubscribers, { isCurrency: false, region: currencyRegion })}
                  />
                ) : null}
                {cgMeta?.community?.telegramUsers != null && cgMeta.community.telegramUsers > 0 ? (
                  <MetricStat
                    label="Telegram Users"
                    value={formatCompactNumber(cgMeta.community.telegramUsers, { isCurrency: false, region: currencyRegion })}
                  />
                ) : null}
                {cgMeta?.watchlistUsers != null && cgMeta.watchlistUsers > 0 ? (
                  <MetricStat
                    label="CoinGecko Watchlists"
                    value={formatCompactNumber(cgMeta.watchlistUsers, { isCurrency: false, region: currencyRegion })}
                  />
                ) : null}
              </div>
            ) : null}
            {liquidity ? (
              <div className="pt-2 border-t border-border/30 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Liquidity Risk</p>
                  <span
                    className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                      (liquidity.score ?? 0) >= 70
                        ? "text-red-400 border-red-500/30 bg-red-500/10"
                        : (liquidity.score ?? 0) >= 45
                          ? "text-amber-400 border-amber-500/30 bg-amber-500/10"
                          : "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
                    )}
                  >
                    {(liquidity.score ?? 0).toFixed(0)}/100
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <MetricStat label="Vol/MCap" value={liquidityVolMcap != null ? `${Math.round(Number(liquidityVolMcap))}` : "—"} compact />
                  <MetricStat label="DEX Depth" value={liquidityDexDepth != null ? `${Math.round(Number(liquidityDexDepth))}` : "—"} compact />
                  <MetricStat label="Exchange" value={liquidityExchange != null ? `${Math.round(Number(liquidityExchange))}` : "—"} compact />
                  <MetricStat label="Pool Dist" value={liquidityPoolDist != null ? `${Math.round(Number(liquidityPoolDist))}` : "—"} compact />
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {hasBuilderHealth ? (
          <div className="bg-card/60 backdrop-blur-2xl border-border/30 dark:border-white/5 shadow-xl h-full min-h-[280px] p-5 rounded-3xl border space-y-4">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Builder Health</p>
            {network ? (
              <div className="grid grid-cols-2 gap-3">
                <MetricStat label="Network Score" value={networkScore != null ? `${Math.round(networkScore)}/100` : "—"} compact />
                <MetricStat label="Network Label" value={networkLabel} compact />
                <MetricStat label="Dev Activity" value={network.devActivity != null ? `${Math.round(Number(network.devActivity))}` : "—"} compact />
                <MetricStat label="Community Engagement" value={network.communityEngagement != null ? `${Math.round(Number(network.communityEngagement))}` : "—"} compact />
              </div>
            ) : null}
            {cgMeta?.developer ? (
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/30">
                {cgMeta.developer.commitCount4Weeks != null && cgMeta.developer.commitCount4Weeks > 0 ? (
                  <MetricStat label="Commits (4w)" value={cgMeta.developer.commitCount4Weeks.toLocaleString()} compact />
                ) : null}
                {cgMeta.developer.stars != null && cgMeta.developer.stars > 0 ? (
                  <MetricStat label="GitHub Stars" value={cgMeta.developer.stars.toLocaleString()} compact />
                ) : null}
                {cgMeta.developer.forks != null && cgMeta.developer.forks > 0 ? (
                  <MetricStat label="Forks" value={cgMeta.developer.forks.toLocaleString()} compact />
                ) : null}
                {cgMeta.developer.pullRequestsMerged != null && cgMeta.developer.pullRequestsMerged > 0 ? (
                  <MetricStat label="PRs Merged" value={cgMeta.developer.pullRequestsMerged.toLocaleString()} compact />
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {structuralRisk && enhancedTrust && holderStability ? (
          <CryptoStructuralRiskCard
            structuralRisk={structuralRisk as unknown as CryptoStructuralRisk}
            enhancedTrust={enhancedTrust as unknown as EnhancedCryptoTrust}
            holderStability={holderStability as unknown as HolderStabilityScore}
            className="md:col-span-2"
          />
        ) : null}
      </div>
    </div>
  );
}

function SentimentBar({
  label,
  tone,
  value,
}: {
  label: string;
  tone: "positive" | "negative";
  value: number;
}) {
  const textClass = tone === "positive" ? "text-emerald-500" : "text-red-500";
  const barClass = tone === "positive" ? "bg-emerald-500" : "bg-red-500";

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className={cn("text-xs font-bold", textClass)}>{label}</span>
        <span className={cn("text-xs font-bold", textClass)}>{value.toFixed(0)}%</span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div className={cn("h-full rounded-full transition-all duration-1000", barClass)} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function MetricStat({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <div>
      <p className={cn(compact ? "text-lg" : "text-2xl", "font-bold text-foreground")}>{value}</p>
      <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider">{label}</p>
    </div>
  );
}
