/**
 * API endpoint configuration for broker connectors
 * Only base URLs can be overridden via environment variables to prevent SSRF
 */

export const API_ENDPOINTS = {
  // KoinX
  KOINX_API_URL: process.env.KOINX_API_URL || "https://api.koinx.com/v1",
  KOINX_PORTFOLIO_HOLDINGS: "/portfolio/holdings",
  KOINX_PORTFOLIO_TRANSACTIONS: "/portfolio/transactions",
  KOINX_BALANCES: "/balances",
  KOINX_TAX_REPORT: "/tax-report",

  // Binance
  BINANCE_API_URL: process.env.BINANCE_API_URL || "https://api.binance.com",
  BINANCE_ACCOUNT_SNAPSHOT: "/sapi/v1/accountSnapshot",
  BINANCE_TRADES: "/api/v3/myTrades",
  BINANCE_ACCOUNT: "/api/v3/account",

  // Coinbase
  COINBASE_API_URL: process.env.COINBASE_API_URL || "https://api.coinbase.com",
  COINBASE_ACCOUNTS: "/v2/accounts",

  // WazirX
  WAZIRX_API_URL: process.env.WAZIRX_API_URL || "https://api.wazirx.com",
  WAZIRX_ACCOUNT: "/api/v2/account",
  WAZIRX_ORDERS: "/api/v2/orders",

  // CoinDCX
  COINDCX_API_URL: process.env.COINDCX_API_URL || "https://api.coindcx.com",
  COINDCX_BALANCES: "/exchange/v1/users/balances",
  COINDCX_FILLED_ORDERS: "/exchange/v1/orders/filled_orders",

  // Kraken
  KRAKEN_API_URL: process.env.KRAKEN_API_URL || "https://api.kraken.com",
  KRAKEN_BALANCE: "/0/private/Balance",
  KRAKEN_TRADES_HISTORY: "/0/private/TradesHistory",

  // Uniswap Subgraph
  UNISWAP_ETHEREUM_SUBGRAPH: process.env.UNISWAP_ETHEREUM_SUBGRAPH || "https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3",
  UNISWAP_POLYGON_SUBGRAPH: process.env.UNISWAP_POLYGON_SUBGRAPH || "https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3-polygon",
  UNISWAP_ARBITRUM_SUBGRAPH: process.env.UNISWAP_ARBITRUM_SUBGRAPH || "https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3-arbitrum",
  UNISWAP_OPTIMISM_SUBGRAPH: process.env.UNISWAP_OPTIMISM_SUBGRAPH || "https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3-optimism",
  UNISWAP_BSC_SUBGRAPH: process.env.UNISWAP_BSC_SUBGRAPH || "https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3-bsc",
  UNISWAP_AVALANCHE_SUBGRAPH: process.env.UNISWAP_AVALANCHE_SUBGRAPH || "https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3-avalanche",

  // Pancakeswap Subgraph
  PANCAKESWAP_BSC_SUBGRAPH: process.env.PANCAKESWAP_BSC_SUBGRAPH || "https://api.thegraph.com/subgraphs/name/pancakeswap/exchange-v3-bsc",
  PANCAKESWAP_ETH_SUBGRAPH: process.env.PANCAKESWAP_ETH_SUBGRAPH || "https://api.thegraph.com/subgraphs/name/pancakeswap/exchange-v3-eth",

  // Sushiswap Subgraph
  SUSHISWAP_ETHEREUM_SUBGRAPH: process.env.SUSHISWAP_ETHEREUM_SUBGRAPH || "https://api.thegraph.com/subgraphs/name/sushiswap/exchange",
  SUSHISWAP_POLYGON_SUBGRAPH: process.env.SUSHISWAP_POLYGON_SUBGRAPH || "https://api.thegraph.com/subgraphs/name/sushiswap/exchange-polygon",
  SUSHISWAP_ARBITRUM_SUBGRAPH: process.env.SUSHISWAP_ARBITRUM_SUBGRAPH || "https://api.thegraph.com/subgraphs/name/sushiswap/exchange-arbitrum",
  SUSHISWAP_OPTIMISM_SUBGRAPH: process.env.SUSHISWAP_OPTIMISM_SUBGRAPH || "https://api.thegraph.com/subgraphs/name/sushiswap/exchange-optimism",
  SUSHISWAP_BSC_SUBGRAPH: process.env.SUSHISWAP_BSC_SUBGRAPH || "https://api.thegraph.com/subgraphs/name/sushiswap/exchange-bsc",
  SUSHISWAP_AVALANCHE_SUBGRAPH: process.env.SUSHISWAP_AVALANCHE_SUBGRAPH || "https://api.thegraph.com/subgraphs/name/sushiswap/exchange-avalanche",
  SUSHISWAP_FANTOM_SUBGRAPH: process.env.SUSHISWAP_FANTOM_SUBGRAPH || "https://api.thegraph.com/subgraphs/name/sushiswap/exchange-fantom",
} as const;

// Retry configuration
export const RETRY_CONFIG = {
  MAX_ATTEMPTS: 3,
  BASE_DELAY_MS: 400,
  MAX_DELAY_MS: 10000,
  JITTER_MS: 100,
} as const;

// Cache configuration
export const CACHE_CONFIG = {
  DEFAULT_TTL_MS: 5 * 60 * 1000, // 5 minutes
  HOLDINGS_TTL_MS: 5 * 60 * 1000, // 5 minutes
  TRANSACTIONS_TTL_MS: 10 * 60 * 1000, // 10 minutes
  BALANCES_TTL_MS: 2 * 60 * 1000, // 2 minutes
} as const;

// Pagination configuration
export const PAGINATION_CONFIG = {
  DEFAULT_PAGE_SIZE: 100,
  MAX_PAGE_SIZE: 1000,
  MAX_TOTAL_ITEMS: 10000,
} as const;
