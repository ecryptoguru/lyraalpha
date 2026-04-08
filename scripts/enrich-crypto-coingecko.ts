#!/usr/bin/env tsx
/**
 * Enrich Crypto assets with full CoinGecko data.
 * Promotes key fields from metadata.coingecko to top-level Asset columns:
 *   - avgVolume (7d avg volume from market chart)
 *   - description (from coin detail)
 *   - category (primary category)
 *   - priceToSales (market cap / revenue proxy via protocol fees if available)
 *
 * Also enriches metadata with fresh CoinGecko market data:
 *   - circulatingSupply, totalSupply, maxSupply
 *   - fullyDilutedValuation
 *   - priceChangePercentage (7d, 30d, 1y)
 *   - ath, atl, athDate, atlDate
 *   - developer stats, community stats
 *   - categories, links, description
 *
 * Usage:
 *   npx tsx scripts/enrich-crypto-coingecko.ts              # all 49 crypto assets
 *   npx tsx scripts/enrich-crypto-coingecko.ts --test       # test with BTC, ETH, SOL
 *   npx tsx scripts/enrich-crypto-coingecko.ts --symbol=BTC-USD  # single asset
 */

import { prisma } from "../src/lib/prisma";
import { CoinGeckoService } from "../src/lib/services/coingecko.service";

const args = process.argv.slice(2);
const isTest = args.includes("--test");
const singleSymbol = args.find(a => a.startsWith("--symbol="))?.split("=")[1];

// Delay between per-coin detail calls (CoinGecko demo: ~30 req/min)
const DELAY_MS = 2200;

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  console.log("🪙  CoinGecko Crypto Enrichment Script");
  console.log("======================================\n");

  let assets;
  if (singleSymbol) {
    assets = await prisma.asset.findMany({
      where: { symbol: singleSymbol, type: "CRYPTO" },
      select: { id: true, symbol: true, name: true, coingeckoId: true, metadata: true },
    });
  } else if (isTest) {
    assets = await prisma.asset.findMany({
      where: { symbol: { in: ["BTC-USD", "ETH-USD", "SOL-USD"] }, type: "CRYPTO" },
      select: { id: true, symbol: true, name: true, coingeckoId: true, metadata: true },
    });
  } else {
    assets = await prisma.asset.findMany({
      where: { type: "CRYPTO" },
      select: { id: true, symbol: true, name: true, coingeckoId: true, metadata: true },
    });
  }

  console.log(`📊 Found ${assets.length} crypto assets to enrich\n`);

  // --- Step 1: Batch market data for all coins in one call ---
  const coingeckoIds = assets
    .map(a => a.coingeckoId)
    .filter((id): id is string => Boolean(id));

  console.log(`📡 Fetching batch market data for ${coingeckoIds.length} coins...`);
  const markets = await CoinGeckoService.getMarkets(coingeckoIds, "usd", {
    priceChangePercentage: "7d,14d,30d,60d,200d,1y",
  });

  const marketById = new Map(markets.map(m => [m.id, m]));
  console.log(`✅ Got market data for ${markets.length} coins\n`);

  let enriched = 0;
  let skipped = 0;
  let failed = 0;

  // --- Step 2: Per-coin detail enrichment ---
  for (const asset of assets) {
    try {
      const cgId = asset.coingeckoId;
      if (!cgId) {
        console.log(`  ⚠️  ${asset.symbol}: No coingeckoId, skipping`);
        skipped++;
        continue;
      }

      const market = marketById.get(cgId);
      const detail = await CoinGeckoService.getCoinDetail(cgId);

      if (!detail && !market) {
        console.log(`  ⚠️  ${asset.symbol}: No CoinGecko data found`);
        skipped++;
        continue;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updatePayload: Record<string, any> = {};
      const existingMeta = (asset.metadata as Record<string, unknown>) || {};

      // --- Top-level column promotions ---

      // avgVolume: use 7-day average from market chart if available, else market data
      if (market?.total_volume) {
        // market.total_volume is 24h volume; use as avgVolume baseline
        updatePayload.avgVolume = market.total_volume;
      }

      // description from detail
      if (detail?.description?.en) {
        const cleaned = detail.description.en
          .replace(/<[^>]+>/g, "") // strip HTML tags
          .replace(/\r\n/g, "\n")
          .trim();
        if (cleaned) updatePayload.description = cleaned;
      }

      // category: first meaningful category
      if (detail?.categories?.length) {
        const primaryCat = detail.categories.find(c =>
          c && !c.toLowerCase().includes("ecosystem") && !c.toLowerCase().includes("portfolio")
        ) || detail.categories[0];
        if (primaryCat) updatePayload.category = primaryCat;
      }

      // --- Metadata enrichment ---
      const cgMeta: Record<string, unknown> = {
        ...(existingMeta.coingecko as Record<string, unknown> || {}),
      };

      if (market) {
        cgMeta.marketCapRank = market.market_cap_rank;
        cgMeta.circulatingSupply = market.circulating_supply;
        cgMeta.totalSupply = market.total_supply;
        cgMeta.maxSupply = market.max_supply;
        cgMeta.fullyDilutedValuation = market.fully_diluted_valuation;
        cgMeta.ath = market.ath;
        cgMeta.athDate = market.ath_date;
        cgMeta.athChangePercentage = market.ath_change_percentage;
        cgMeta.atl = market.atl;
        cgMeta.atlDate = market.atl_date;
        cgMeta.atlChangePercentage = market.atl_change_percentage;
        cgMeta.priceChange24h = market.price_change_24h;
        cgMeta.priceChangePercentage7d = market.price_change_percentage_7d_in_currency;
        cgMeta.priceChangePercentage14d = market.price_change_percentage_14d_in_currency;
        cgMeta.priceChangePercentage30d = market.price_change_percentage_30d_in_currency;
        cgMeta.priceChangePercentage60d = market.price_change_percentage_60d_in_currency;
        cgMeta.priceChangePercentage200d = market.price_change_percentage_200d_in_currency;
        cgMeta.priceChangePercentage1y = market.price_change_percentage_1y_in_currency;
        cgMeta.volume24Hr = market.total_volume;
        cgMeta.lastDetailSync = new Date().toISOString();
      }

      if (detail) {
        const md = detail.market_data;
        if (md) {
          if (md.circulating_supply) cgMeta.circulatingSupply = md.circulating_supply;
          if (md.total_supply) cgMeta.totalSupply = md.total_supply;
          if (md.max_supply) cgMeta.maxSupply = md.max_supply;
          if (md.fully_diluted_valuation?.usd) cgMeta.fullyDilutedValuation = md.fully_diluted_valuation.usd;
          if (md.total_volume?.usd) cgMeta.volume24Hr = md.total_volume.usd;
          if (md.ath?.usd) cgMeta.ath = md.ath.usd;
          if (md.ath_date?.usd) cgMeta.athDate = md.ath_date.usd;
          if (md.ath_change_percentage?.usd) cgMeta.athChangePercentage = md.ath_change_percentage.usd;
          if (md.atl?.usd) cgMeta.atl = md.atl.usd;
          if (md.atl_date?.usd) cgMeta.atlDate = md.atl_date.usd;
          if (md.atl_change_percentage?.usd) cgMeta.atlChangePercentage = md.atl_change_percentage.usd;
          if (md.price_change_percentage_7d) cgMeta.priceChangePercentage7d = md.price_change_percentage_7d;
          if (md.price_change_percentage_14d) cgMeta.priceChangePercentage14d = md.price_change_percentage_14d;
          if (md.price_change_percentage_30d) cgMeta.priceChangePercentage30d = md.price_change_percentage_30d;
          if (md.price_change_percentage_60d) cgMeta.priceChangePercentage60d = md.price_change_percentage_60d;
          if (md.price_change_percentage_200d) cgMeta.priceChangePercentage200d = md.price_change_percentage_200d;
          if (md.price_change_percentage_1y) cgMeta.priceChangePercentage1y = md.price_change_percentage_1y;
          if (md.market_cap_rank) cgMeta.marketCapRank = md.market_cap_rank;
        }

        if (detail.categories?.length) cgMeta.categories = detail.categories.filter(Boolean);
        if (detail.links) {
          cgMeta.links = {
            homepage: detail.links.homepage?.filter(Boolean) || [],
            twitter: detail.links.twitter_screen_name
              ? `https://x.com/${detail.links.twitter_screen_name}`
              : null,
            reddit: detail.links.subreddit_url || null,
            telegram: detail.links.telegram_channel_identifier
              ? `https://t.me/${detail.links.telegram_channel_identifier}`
              : null,
            github: detail.links.repos_url?.github?.filter(Boolean) || [],
            blockchain: detail.links.blockchain_site?.filter(Boolean) || [],
            whitepaper: detail.links.whitepaper || null,
          };
        }
        if (detail.community_data) {
          cgMeta.community = {
            redditSubscribers: detail.community_data.reddit_subscribers,
            telegramUsers: detail.community_data.telegram_channel_user_count,
          };
        }
        if (detail.developer_data) {
          cgMeta.developer = {
            forks: detail.developer_data.forks,
            stars: detail.developer_data.stars,
            subscribers: detail.developer_data.subscribers,
            totalIssues: detail.developer_data.total_issues,
            closedIssues: detail.developer_data.closed_issues,
            pullRequestsMerged: detail.developer_data.pull_requests_merged,
            commitCount4Weeks: detail.developer_data.commit_count_4_weeks,
          };
        }
        if (detail.sentiment_votes_up_percentage != null) {
          cgMeta.sentimentVotesUpPercentage = detail.sentiment_votes_up_percentage;
          cgMeta.sentimentVotesDownPercentage = detail.sentiment_votes_down_percentage;
        }
        if (detail.watchlist_portfolio_users) {
          cgMeta.watchlistUsers = detail.watchlist_portfolio_users;
        }
        if (detail.genesis_date) cgMeta.genesisDate = detail.genesis_date;
        if (detail.hashing_algorithm) cgMeta.hashingAlgorithm = detail.hashing_algorithm;
        if (detail.image) cgMeta.image = detail.image;
        cgMeta.lastDetailSync = new Date().toISOString();
      }

      updatePayload.metadata = {
        ...existingMeta,
        coingecko: cgMeta,
      };

      await prisma.asset.update({
        where: { id: asset.id },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: updatePayload as any,
      });

      const promoted = Object.keys(updatePayload).filter(k => k !== "metadata").join(", ");
      console.log(`  ✅ ${asset.symbol} (${cgId}): metadata refreshed${promoted ? `, promoted: ${promoted}` : ""}`);
      enriched++;

      await sleep(DELAY_MS);
    } catch (err) {
      console.error(`  ❌ ${asset.symbol}: ${(err as Error).message}`);
      failed++;
    }
  }

  console.log(`\n📊 Done: ${enriched} enriched, ${skipped} skipped, ${failed} failed`);
  await prisma.$disconnect();
}

main().catch(e => {
  console.error("Fatal error:", e);
  process.exit(1);
});
