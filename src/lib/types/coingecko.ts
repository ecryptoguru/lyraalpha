/**
 * CoinGecko API Response Types
 * Demo API v3 — https://docs.coingecko.com/v3.0.1/reference/endpoint-overview
 */

// /coins/markets response item
export interface CoinGeckoMarket {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
  fully_diluted_valuation: number | null;
  total_volume: number;
  high_24h: number;
  low_24h: number;
  price_change_24h: number;
  price_change_percentage_24h: number;
  market_cap_change_24h: number;
  market_cap_change_percentage_24h: number;
  circulating_supply: number;
  total_supply: number | null;
  max_supply: number | null;
  ath: number;
  ath_change_percentage: number;
  ath_date: string;
  atl: number;
  atl_change_percentage: number;
  atl_date: string;
  roi: { times: number; currency: string; percentage: number } | null;
  last_updated: string;
  sparkline_in_7d?: { price: number[] };
  price_change_percentage_7d_in_currency?: number;
  price_change_percentage_14d_in_currency?: number;
  price_change_percentage_30d_in_currency?: number;
  price_change_percentage_60d_in_currency?: number;
  price_change_percentage_200d_in_currency?: number;
  price_change_percentage_1y_in_currency?: number;
}

// /coins/{id} response (full detail)
export interface CoinGeckoDetail {
  id: string;
  symbol: string;
  name: string;
  web_slug: string;
  asset_platform_id: string | null;
  block_time_in_minutes: number;
  hashing_algorithm: string | null;
  categories: string[];
  preview_listing: boolean;
  public_notice: string | null;
  description: { en: string; [key: string]: string };
  links: {
    homepage: string[];
    whitepaper: string;
    blockchain_site: string[];
    official_forum_url: string[];
    chat_url: string[];
    announcement_url: string[];
    twitter_screen_name: string;
    facebook_username: string;
    telegram_channel_identifier: string;
    subreddit_url: string;
    repos_url: { github: string[]; bitbucket: string[] };
  };
  image: { thumb: string; small: string; large: string };
  country_origin: string;
  genesis_date: string | null;
  sentiment_votes_up_percentage: number;
  sentiment_votes_down_percentage: number;
  watchlist_portfolio_users: number;
  market_cap_rank: number;
  market_data: {
    current_price: Record<string, number>;
    total_value_locked: number | null;
    mcap_to_tvl_ratio: number | null;
    fdv_to_tvl_ratio: number | null;
    ath: Record<string, number>;
    ath_change_percentage: Record<string, number>;
    ath_date: Record<string, string>;
    atl: Record<string, number>;
    atl_change_percentage: Record<string, number>;
    atl_date: Record<string, string>;
    market_cap: Record<string, number>;
    market_cap_rank: number;
    fully_diluted_valuation: Record<string, number>;
    market_cap_fdv_ratio: number;
    total_volume: Record<string, number>;
    high_24h: Record<string, number>;
    low_24h: Record<string, number>;
    price_change_24h: number;
    price_change_percentage_24h: number;
    price_change_percentage_7d: number;
    price_change_percentage_14d: number;
    price_change_percentage_30d: number;
    price_change_percentage_60d: number;
    price_change_percentage_200d: number;
    price_change_percentage_1y: number;
    market_cap_change_24h: number;
    market_cap_change_percentage_24h: number;
    total_supply: number | null;
    max_supply: number | null;
    circulating_supply: number;
    last_updated: string;
  };
  community_data: {
    facebook_likes: number | null;
    twitter_followers: number | null;
    reddit_average_posts_48h: number;
    reddit_average_comments_48h: number;
    reddit_subscribers: number;
    reddit_accounts_active_48h: number;
    telegram_channel_user_count: number | null;
  };
  developer_data: {
    forks: number;
    stars: number;
    subscribers: number;
    total_issues: number;
    closed_issues: number;
    pull_requests_merged: number;
    pull_request_contributors: number;
    code_additions_deletions_4_weeks: { additions: number; deletions: number };
    commit_count_4_weeks: number;
    last_4_weeks_commit_activity_series: number[];
  };
  last_updated: string;
}

// /coins/{id}/ohlc response — array of [timestamp, open, high, low, close]
export type CoinGeckoOHLC = [number, number, number, number, number][];

// /coins/{id}/market_chart response
export interface CoinGeckoMarketChart {
  prices: [number, number][];
  market_caps: [number, number][];
  total_volumes: [number, number][];
}

// /simple/price response
export type CoinGeckoSimplePrice = Record<
  string,
  {
    usd: number;
    usd_market_cap?: number;
    usd_24h_vol?: number;
    usd_24h_change?: number;
    last_updated_at?: number;
  }
>;

// Normalized metadata structure stored in Asset.metadata.coingecko
export interface CoinGeckoMetadata {
  image: { thumb: string; small: string; large: string };
  categories: string[];
  genesisDate: string | null;
  hashingAlgorithm: string | null;

  marketCapRank: number;
  fullyDilutedValuation: number | null;
  circulatingSupply: number;
  totalSupply: number | null;
  maxSupply: number | null;

  ath: number;
  athDate: string;
  athChangePercentage: number;
  atl: number;
  atlDate: string;
  atlChangePercentage: number;

  priceChange24h: number;
  priceChangePercentage7d: number;
  priceChangePercentage14d: number;
  priceChangePercentage30d: number;
  priceChangePercentage60d: number;
  priceChangePercentage200d: number;
  priceChangePercentage1y: number;

  sentimentVotesUpPercentage: number;
  sentimentVotesDownPercentage: number;
  watchlistUsers: number;

  developer: {
    forks: number;
    stars: number;
    subscribers: number;
    totalIssues: number;
    closedIssues: number;
    pullRequestsMerged: number;
    commitCount4Weeks: number;
  } | null;

  community: {
    redditSubscribers: number;
    telegramUsers: number | null;
  } | null;

  links: {
    homepage: string[];
    whitepaper: string | null;
    blockchain: string[];
    twitter: string | null;
    reddit: string | null;
    github: string[];
    telegram: string | null;
  };

  description: string;
  lastDetailSync: string;
}
