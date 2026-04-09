import type { BrokerConnector, BrokerProvider } from "@/lib/types/broker";

import { KoinxConnector } from "./koinx";
import { BinanceConnector } from "./binance";
import { CoinbaseConnector } from "./coinbase";
import { WazirxConnector } from "./wazirx";
import { CoinDCXConnector } from "./coindcx";
import { KrakenConnector } from "./kraken";
import { UniswapConnector } from "./uniswap";
import { PancakeswapConnector } from "./pancakeswap";
import { SushiswapConnector } from "./sushiswap";

// ─── Registry ────────────────────────────────────────────────────────────────

const REGISTRY = new Map<BrokerProvider, BrokerConnector>([
  ["koinx", new KoinxConnector()],
  ["binance", new BinanceConnector()],
  ["coinbase", new CoinbaseConnector()],
  ["wazirx", new WazirxConnector()],
  ["coindcx", new CoinDCXConnector()],
  ["kraken", new KrakenConnector()],
  ["uniswap", new UniswapConnector()],
  ["pancakeswap", new PancakeswapConnector()],
  ["sushiswap", new SushiswapConnector()],
]);

export function getConnector(provider: BrokerProvider): BrokerConnector {
  const connector = REGISTRY.get(provider);
  if (!connector) {
    throw new Error(`No connector registered for provider: ${provider}`);
  }
  return connector;
}

export function listConnectors(): BrokerConnector[] {
  return Array.from(REGISTRY.values());
}

export { KoinxConnector };

export { BrokerConnectorError, withRetry } from "./base";
