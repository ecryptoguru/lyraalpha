/**
 * CoinGecko Symbol Mapping
 * Maps our internal symbol format (BTC-USD) to CoinGecko API IDs (bitcoin).
 * Top 50 by market cap as of Feb 2026.
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
  "ATOM-USD": "Cosmos",
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
