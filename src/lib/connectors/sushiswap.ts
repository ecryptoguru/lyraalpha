import { SubgraphConnector, SubgraphConfig } from "./subgraph-base";

// ─── Sushiswap Connector ───────────────────────────────────────────────────────────

export class SushiswapConnector extends SubgraphConnector {
  constructor(chain: string = "ethereum") {
    const subgraphUrls: Record<string, string> = {
      ethereum: "https://api.thegraph.com/subgraphs/name/sushiswap/exchange",
      polygon: "https://api.thegraph.com/subgraphs/name/sushiswap/exchange-polygon",
      arbitrum: "https://api.thegraph.com/subgraphs/name/sushiswap/exchange-arbitrum",
      optimism: "https://api.thegraph.com/subgraphs/name/sushiswap/exchange-optimism",
      bsc: "https://api.thegraph.com/subgraphs/name/sushiswap/exchange-bsc",
      avalanche: "https://api.thegraph.com/subgraphs/name/sushiswap/exchange-avalanche",
      fantom: "https://api.thegraph.com/subgraphs/name/sushiswap/exchange-fantom",
    };

    const config: SubgraphConfig = {
      name: "sushiswap",
      subgraphUrl: subgraphUrls[chain] || subgraphUrls.ethereum,
      chain,
      exchange: "SUSHISWAP",
    };

    super(config);
  }
}
