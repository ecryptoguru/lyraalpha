
export const OFFICIAL_NAME_MAP: Record<string, string> = {
  // Crypto
  "BTC-USD": "BITCOIN",
  "ETH-USD": "ETHEREUM",
  "SOL-USD": "SOLANA",
  "USDT-USD": "TETHER",
  "USDC-USD": "USDC",
  "XRP-USD": "RIPPLE",
  "ADA-USD": "CARDANO",
  "AVAX-USD": "AVALANCHE",
  "DOGE-USD": "DOGECOIN",
  "DOT-USD": "POLKADOT",
  "LINK-USD": "CHAINLINK",
  "NEAR-USD": "NEAR PROTOCOL",
  "ATOM-USD": "COSMOS",
  "LTC-USD": "LITECOIN",
  "UNI7083-USD": "UNISWAP",
  "MATIC-USD": "POLYGON",
  "SUI-USD": "SUI",
  "APT-USD": "APTOS",
  "ARB-USD": "ARBITRUM",
  "MNT-USD": "MANTLE",
  "FTM-USD": "FANTOM",
  "GRT-USD": "THE GRAPH",
  "IMX-USD": "IMMUTABLE X",
  "THETA-USD": "THETA",
  "CRV-USD": "CURVE",
  "COMP-USD": "COMPOUND",
  "SNX-USD": "SYNTHETIX",
  "1INCH-USD": "1INCH",
  "KAS-USD": "KASPA",
  "ALGO-USD": "ALGORAND",
  "HBAR-USD": "HEDERA",
  "FIL-USD": "FILECOIN",
  "ICP-USD": "INTERNET COMPUTER",
  "RENDER-USD": "RENDER",
  "INJ-USD": "INJECTIVE",
  "OP-USD": "OPTIMISM",
  "SEI-USD": "SEI",
  "TIA-USD": "CELESTIA",
  "SHIB-USD": "SHIBA INU",
  "PEPE-USD": "PEPE",
  "WIF-USD": "DOGWIFHAT",
  "BONK-USD": "BONK",
};

export function getFriendlyAssetName(symbol: string, name?: string): string {
  const upperSymbol = symbol.toUpperCase();
  
  // 1. Check if it's a known mapping
  if (OFFICIAL_NAME_MAP[upperSymbol]) {
    return OFFICIAL_NAME_MAP[upperSymbol];
  }

  if (name && name !== symbol) {
    if (upperSymbol.endsWith("-USD")) {
      return name.split("/")[0].split("-")[0].replace(/ USD$/i, "").trim();
    }
    return name.trim();
  }

  if (upperSymbol.endsWith("-USD")) {
    return symbol.replace(/-USD$/i, "");
  }

  return name || symbol;
}

export function getFriendlySymbol(symbol: string, type?: string, name?: string): string {
  const upperSymbol = symbol.toUpperCase();
  
  // 1. Check if it's a known mapping
  if (OFFICIAL_NAME_MAP[upperSymbol]) {
    return OFFICIAL_NAME_MAP[upperSymbol];
  }

  // 2. Crypto formatting
  return name || getFriendlyAssetName(symbol, name);
}

export function getFriendlyAssetSubtitle(symbol: string, type?: string, name?: string): string {
  const compactLabel = getFriendlySymbol(symbol, type, name);
  const fullLabel = getFriendlyAssetName(symbol, name);
  if (fullLabel && fullLabel !== compactLabel) {
    return fullLabel;
  }

  const cleanedSymbol = symbol
    .replace(/-USD$/i, "");

  if (cleanedSymbol && cleanedSymbol !== compactLabel) {
    return cleanedSymbol;
  }

  return type ? type.replace(/_/g, " ") : symbol;
}

export function velocityDelta(
  scoreDynamics: Record<string, unknown> | null | undefined,
  key: string,
): number | null {
  if (!scoreDynamics) return null;
  const entry = scoreDynamics[key] as Record<string, unknown> | undefined;
  if (!entry || typeof entry.momentum !== "number") return null;
  return entry.momentum;
}

export function cleanAssetText(text: string, assets: Array<{ symbol: string; name?: string }> = []): string {
  if (!text) return text;

  const normalized = text
    .replace(/\b([A-Z0-9.-]+-USD)'s\b/g, (_, symbol: string) => `${getFriendlyAssetName(symbol, symbol)}'s`)
    .replace(/\b([A-Z0-9.-]+-USD)\b/g, (_, symbol: string) => getFriendlyAssetName(symbol, symbol))
    .replace(/\s+/g, " ")
    .trim();

  return assets.reduce((result, asset) => {
    const rawName = asset.name?.trim();
    const friendlyName = getFriendlyAssetName(asset.symbol, asset.name);
    if (!rawName || rawName === friendlyName) {
      return result;
    }

    const escaped = rawName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return result
      .replace(new RegExp(`${escaped}'s`, "g"), `${friendlyName}'s`)
      .replace(new RegExp(escaped, "g"), friendlyName);
  }, normalized);
}
