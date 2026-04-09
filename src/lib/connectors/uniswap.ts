import { SubgraphConnector, SubgraphConfig } from "./subgraph-base";

// ─── Uniswap Connector ─────────────────────────────────────────────────────────────

export class UniswapConnector extends SubgraphConnector {
  constructor(chain: string = "ethereum") {
    const subgraphUrls: Record<string, string> = {
      ethereum: "https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3",
      polygon: "https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3-polygon",
      arbitrum: "https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3-arbitrum",
      optimism: "https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3-optimism",
      bsc: "https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3-bsc",
      avalanche: "https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3-avalanche",
    };

    const config: SubgraphConfig = {
      name: "uniswap",
      subgraphUrl: subgraphUrls[chain] || subgraphUrls.ethereum,
      chain,
      exchange: "UNISWAP",
    };

    super(config);
  }
}
