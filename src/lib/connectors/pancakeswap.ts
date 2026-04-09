import { SubgraphConnector, SubgraphConfig } from "./subgraph-base";

// ─── Pancakeswap Connector ─────────────────────────────────────────────────────────

export class PancakeswapConnector extends SubgraphConnector {
  constructor(chain: string = "bsc") {
    const subgraphUrls: Record<string, string> = {
      bsc: "https://api.thegraph.com/subgraphs/name/pancakeswap/exchange-v3-bsc",
      ethereum: "https://api.thegraph.com/subgraphs/name/pancakeswap/exchange-v3-eth",
    };

    const config: SubgraphConfig = {
      name: "pancakeswap",
      subgraphUrl: subgraphUrls[chain] || subgraphUrls.bsc,
      chain,
      exchange: "PANCAKESWAP",
    };

    super(config);
  }
}
