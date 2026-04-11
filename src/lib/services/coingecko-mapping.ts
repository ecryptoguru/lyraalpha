/**
 * CoinGecko Symbol Mapping
 * Maps our internal symbol format (BTC-USD) to CoinGecko API IDs (bitcoin).
 * Top 100+ by market cap as of Apr 2026.
 */

// Bidirectional mapping: symbol (BTC-USD) ↔ CoinGecko ID (bitcoin)
const SYMBOL_TO_COINGECKO: Record<string, string> = {
  "BTC-USD": "bitcoin",
  "ETH-USD": "ethereum",
  "XRP-USD": "ripple",
  "SOL-USD": "solana",
  "BNB-USD": "binancecoin",
  "DOGE-USD": "dogecoin",
  "ADA-USD": "cardano",
  "TRX-USD": "tron",
  "AVAX-USD": "avalanche-2",
  "LINK-USD": "chainlink",
  "XLM-USD": "stellar",
  "SUI-USD": "sui",
  "SHIB-USD": "shiba-inu",
  "HBAR-USD": "hedera-hashgraph",
  "DOT-USD": "polkadot",
  "BCH-USD": "bitcoin-cash",
  "TON-USD": "the-open-network",
  "LTC-USD": "litecoin",
  "UNI-USD": "uniswap",
  "NEAR-USD": "near",
  "APT-USD": "aptos",
  "ICP-USD": "internet-computer",
  "AAVE-USD": "aave",
  "ETC-USD": "ethereum-classic",
  "RENDER-USD": "render-token",
  "FIL-USD": "filecoin",
  "ARB-USD": "arbitrum",
  "ATOM-USD": "cosmos",
  "VET-USD": "vechain",
  "OP-USD": "optimism",
  "INJ-USD": "injective-protocol",
  "FET-USD": "fetch-ai",
  "ALGO-USD": "algorand",
  "GRT-USD": "the-graph",
  "FTM-USD": "fantom",
  "SAND-USD": "the-sandbox",
  "MANA-USD": "decentraland",
  "THETA-USD": "theta-token",
  "AXS-USD": "axie-infinity",
  "RUNE-USD": "thorchain",
  "TIA-USD": "celestia",
  "SEI-USD": "sei-network",
  "STX-USD": "blockstack",
  "IMX-USD": "immutable-x",
  "MKR-USD": "maker",
  "LDO-USD": "lido-dao",
  "CRV-USD": "curve-dao-token",
  "PEPE-USD": "pepe",
  "WIF-USD": "dogwifcoin",
  // Additional assets from database
  "ASTER-USD": "aster-2",
  "BCAP-USD": "blockchain-capital",
  "BDX-USD": "beldex",
  "BFUSD-USD": "bfusd",
  "BGB-USD": "bitget-token",
  "BUIDL-USD": "blackrock-usd-institutional-digital-liquidity-fund",
  "CC-USD": "canton-network",
  "CRO-USD": "crypto-com-chain",
  "DAI-USD": "dai",
  "ENA-USD": "ethena",
  "EUTBL-USD": "eutbl",
  "FIGR_HELOC-USD": "figure-heloc",
  "FLR-USD": "flare-networks",
  "GHO-USD": "gho",
  "GT-USD": "gatechain-token",
  "HASH-USD": "hash-2",
  "HTX-USD": "htx-dao",
  "HYPE-USD": "hyperliquid",
  "JST-USD": "just",
  "JTRSY-USD": "janus-henderson-anemoy-treasury-fund",
  "KAS-USD": "kaspa",
  "KCS-USD": "kucoin-shares",
  "LEO-USD": "leo-token",
  "M-USD": "memecore",
  "MNT-USD": "mantle",
  "MORPHO-USD": "morpho",
  "NEXO-USD": "nexo",
  "NIGHT-USD": "midnight-3",
  "OKB-USD": "okb",
  "ONDO-USD": "ondo-finance",
  "OUSG-USD": "ousg",
  "PAXG-USD": "pax-gold",
  "PI-USD": "pi-network",
  "POL-USD": "polygon-ecosystem-token",
  "PUMP-USD": "pump-fun",
  "PYUSD-USD": "paypal-usd",
  "QNT-USD": "quant-network",
  "RAIN-USD": "rain",
  "RLUSD-USD": "ripple-usd",
  "SKY-USD": "sky",
  "TAO-USD": "bittensor",
  "TRUMP-USD": "official-trump",
  "USD1-USD": "usd1-wlfi",
  "USDC-USD": "usd-coin",
  "USDD-USD": "usdd",
  "USDE-USD": "ethena-usde",
  "USDF-USD": "falcon-finance",
  "USDG-USD": "global-dollar",
  "USDS-USD": "usds",
  "USDT-USD": "tether",
  "USDTB-USD": "usdtb",
  "USDY-USD": "ondo-us-dollar-yield",
  "USTB-USD": "superstate-short-duration-us-government-securities-fund-ustb",
  "USYC-USD": "hashnote-usyc",
  "WBT-USD": "whitebit",
  "WLD-USD": "worldcoin-wld",
  "WLFI-USD": "world-liberty-financial",
  "XAUT-USD": "tether-gold",
  "XDC-USD": "xdce-crowd-sale",
  "XMR-USD": "monero",
  "YLDS-USD": "ylds",
  "ZEC-USD": "zcash",
};

// Reverse map: CoinGecko ID → symbol
const COINGECKO_TO_SYMBOL: Record<string, string> = Object.fromEntries(
  Object.entries(SYMBOL_TO_COINGECKO).map(([sym, id]) => [id, sym]),
);

// Display name overrides for crypto assets
export const CRYPTO_DISPLAY_NAMES: Record<string, string> = {
  "BTC-USD": "Bitcoin",
  "ETH-USD": "Ethereum",
  "XRP-USD": "XRP",
  "SOL-USD": "Solana",
  "BNB-USD": "BNB",
  "DOGE-USD": "Dogecoin",
  "ADA-USD": "Cardano",
  "TRX-USD": "TRON",
  "AVAX-USD": "Avalanche",
  "LINK-USD": "Chainlink",
  "XLM-USD": "Stellar",
  "SUI-USD": "Sui",
  "SHIB-USD": "Shiba Inu",
  "HBAR-USD": "Hedera",
  "DOT-USD": "Polkadot",
  "BCH-USD": "Bitcoin Cash",
  "TON-USD": "Toncoin",
  "LTC-USD": "Litecoin",
  "UNI-USD": "Uniswap",
  "NEAR-USD": "NEAR Protocol",
  "APT-USD": "Aptos",
  "ICP-USD": "Internet Computer",
  "AAVE-USD": "Aave",
  "ETC-USD": "Ethereum Classic",
  "RENDER-USD": "Render",
  "FIL-USD": "Filecoin",
  "ARB-USD": "Arbitrum",
  "ATOM-USD": "Cosmos Hub",
  "VET-USD": "VeChain",
  "OP-USD": "Optimism",
  "INJ-USD": "Injective",
  "FET-USD": "Artificial Superintelligence Alliance",
  "ALGO-USD": "Algorand",
  "GRT-USD": "The Graph",
  "FTM-USD": "Fantom",
  "SAND-USD": "The Sandbox",
  "MANA-USD": "Decentraland",
  "THETA-USD": "Theta Network",
  "AXS-USD": "Axie Infinity",
  "RUNE-USD": "THORChain",
  "TIA-USD": "Celestia",
  "SEI-USD": "Sei",
  "STX-USD": "Stacks",
  "IMX-USD": "Immutable",
  "MKR-USD": "Maker",
  "LDO-USD": "Lido DAO",
  "CRV-USD": "Curve DAO",
  "PEPE-USD": "Pepe",
  "WIF-USD": "dogwifhat",
  // Additional assets from database
  "ASTER-USD": "Aster",
  "BCAP-USD": "Blockchain Capital",
  "BDX-USD": "Beldex",
  "BFUSD-USD": "BFUSD",
  "BGB-USD": "Bitget Token",
  "BUIDL-USD": "BlackRock USD Institutional Digital Liquidity Fund",
  "CC-USD": "Canton",
  "CRO-USD": "Cronos",
  "DAI-USD": "Dai",
  "ENA-USD": "Ethena",
  "EUTBL-USD": "Spiko EU T-Bills Money Market Fund",
  "FIGR_HELOC-USD": "Figure Heloc",
  "FLR-USD": "Flare",
  "GHO-USD": "GHO",
  "GT-USD": "Gate",
  "HASH-USD": "Provenance Blockchain",
  "HTX-USD": "HTX DAO",
  "HYPE-USD": "Hyperliquid",
  "JST-USD": "JUST",
  "JTRSY-USD": "Janus Henderson Anemoy Treasury Fund",
  "KAS-USD": "Kaspa",
  "KCS-USD": "KuCoin",
  "LEO-USD": "LEO Token",
  "M-USD": "MemeCore",
  "MNT-USD": "Mantle",
  "MORPHO-USD": "Morpho",
  "NEXO-USD": "NEXO",
  "NIGHT-USD": "Midnight",
  "OKB-USD": "OKB",
  "ONDO-USD": "Ondo",
  "OUSG-USD": "OUSG",
  "PAXG-USD": "PAX Gold",
  "PI-USD": "Pi Network",
  "POL-USD": "POL (ex-MATIC)",
  "PUMP-USD": "Pump.fun",
  "PYUSD-USD": "PayPal USD",
  "QNT-USD": "Quant",
  "RAIN-USD": "Rain",
  "RLUSD-USD": "Ripple USD",
  "SKY-USD": "Sky",
  "TAO-USD": "Bittensor",
  "TRUMP-USD": "Official Trump",
  "USD1-USD": "USD1",
  "USDC-USD": "USDC",
  "USDD-USD": "USDD",
  "USDE-USD": "Ethena USDe",
  "USDF-USD": "Falcon USD",
  "USDG-USD": "Global Dollar",
  "USDS-USD": "USDS",
  "USDT-USD": "Tether",
  "USDTB-USD": "USDtb",
  "USDY-USD": "Ondo US Dollar Yield",
  "USTB-USD": "Superstate Short Duration U.S. Government Securities Fund",
  "USYC-USD": "Circle USYC",
  "WBT-USD": "WhiteBIT Coin",
  "WLD-USD": "Worldcoin",
  "WLFI-USD": "World Liberty Financial",
  "XAUT-USD": "Tether Gold",
  "XDC-USD": "XDC Network",
  "XMR-USD": "Monero",
  "YLDS-USD": "YLDS",
  "ZEC-USD": "Zcash",
};

/**
 * Convert our symbol format (BTC-USD) to CoinGecko API ID (bitcoin).
 * Returns null if not a known crypto symbol.
 */
export function symbolToCoingeckoId(symbol: string): string | null {
  return SYMBOL_TO_COINGECKO[symbol.toUpperCase()] ?? null;
}

/**
 * Convert CoinGecko API ID (bitcoin) to our symbol format (BTC-USD).
 */
export function coingeckoIdToSymbol(id: string): string | null {
  return COINGECKO_TO_SYMBOL[id.toLowerCase()] ?? null;
}

/**
 * Check if a symbol is a cryptocurrency (uses -USD suffix convention).
 */
export function isCryptoSymbol(symbol: string): boolean {
  return symbol.toUpperCase().endsWith("-USD");
}

/**
 * Get all known CoinGecko IDs for batch API calls.
 */
export function getAllCoingeckoIds(): string[] {
  return Object.values(SYMBOL_TO_COINGECKO);
}

/**
 * Get all crypto symbols for the default universe.
 */
export function getDefaultCryptoSymbols(): string[] {
  return Object.keys(SYMBOL_TO_COINGECKO);
}

/**
 * Get the CoinGecko ID for a symbol, or derive it from the symbol if not in the static map.
 * Fallback: strips -USD suffix and lowercases (works for many coins).
 */
export function resolveCoingeckoId(symbol: string): string | null {
  const upper = symbol.toUpperCase();
  if (!isCryptoSymbol(upper)) return null;
  const mapped = SYMBOL_TO_COINGECKO[upper];
  if (mapped) return mapped;
  // Fallback: BTC-USD → btc (won't always work, but covers simple cases)
  return upper.replace("-USD", "").toLowerCase();
}

/**
 * Build a symbol from CoinGecko market data.
 * Uses the CoinGecko symbol field (e.g., "btc") → "BTC-USD"
 */
export function buildSymbolFromCoinGecko(cgSymbol: string): string {
  return `${cgSymbol.toUpperCase()}-USD`;
}
