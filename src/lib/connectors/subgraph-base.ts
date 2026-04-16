import type {
  BrokerConnector,
  BrokerCredentials,
  BrokerAuthHandle,
  BrokerNormalizationResult,
  BrokerSyncScope,
  BrokerProvider,
} from "@/lib/types/broker";
import {
  BrokerConnectorError,
  withRetry,
  makeSourceRef,
  makeInstrumentIdentity,
  scoreConfidence,
  makeSnapshot,
  makeNormalizationResult,
  scopeEnabled,
} from "./base";
import { validateWalletAddress } from "@/lib/validation";

// ─── Subgraph Base Connector ───────────────────────────────────────────────────────

export interface SubgraphConfig {
  name: string;
  subgraphUrl: string;
  chain: string;
  exchange: string;
}

export class SubgraphConnector implements BrokerConnector {
  readonly provider: BrokerProvider;
  readonly region = "US" as const;
  readonly version = "1.0.0";
  readonly supportedScopes: BrokerSyncScope[] = ["holdings", "transactions", "orders", "balances"];
  
  protected config: SubgraphConfig;

  constructor(config: SubgraphConfig) {
    this.provider = config.name as BrokerProvider;
    this.config = config;
  }

  async authenticate(credentials: BrokerCredentials): Promise<BrokerAuthHandle> {
    const { walletAddress } = credentials;

    if (!walletAddress) {
      throw new BrokerConnectorError(
        "Wallet address is required for DEX authentication",
        "auth_failed",
        this.provider,
        false,
      );
    }

    try {
      const validatedAddress = validateWalletAddress(walletAddress, this.config.chain);

      // DEX uses wallet address for authentication
      return {
        provider: this.provider,
        accessToken: validatedAddress,
        meta: { chain: this.config.chain },
      };
    } catch (error) {
      throw new BrokerConnectorError(
        error instanceof Error ? error.message : "Invalid wallet address",
        "auth_failed",
        this.provider,
        false,
      );
    }
  }

  async fetchAndNormalize(
    auth: BrokerAuthHandle,
    scope?: BrokerSyncScope[],
  ): Promise<BrokerNormalizationResult> {
    const warnings: string[] = [];
    const sourcePayloads: Record<string, unknown>[] = [];

    // Fetch holdings if scope enabled
    const holdings = scopeEnabled(scope, "holdings")
      ? await this.fetchHoldings(auth, warnings, sourcePayloads)
      : [];

    // Fetch transactions if scope enabled
    const transactions = scopeEnabled(scope, "transactions")
      ? await this.fetchTransactions(auth, warnings, sourcePayloads)
      : [];

    // Fetch balances if scope enabled
    const cashBalances = scopeEnabled(scope, "balances")
      ? await this.fetchBalances(auth, warnings, sourcePayloads)
      : [];

    const snapshot = makeSnapshot(
      this.provider,
      this.region,
      holdings,
      [],
      sourcePayloads,
      warnings,
    );

    snapshot.transactions = transactions;
    snapshot.cashBalances = cashBalances;

    return makeNormalizationResult(
      this.provider,
      this.region,
      this.version,
      snapshot,
      warnings,
    );
  }

  protected async querySubgraph(query: string, variables?: Record<string, unknown>): Promise<Record<string, unknown>> {
    const response = await withRetry(
      () =>
        fetch(this.config.subgraphUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query, variables }),
        }),
      { maxAttempts: 3 },
    );

    if (!response.ok) {
      throw new Error(`Subgraph query failed: ${response.statusText}`);
    }

    const data = await response.json();
    if (data.errors) {
      throw new Error(`Subgraph query errors: ${JSON.stringify(data.errors)}`);
    }

    return data.data as Record<string, unknown>;
  }

  private async fetchHoldings(
    auth: BrokerAuthHandle,
    warnings: string[],
    sourcePayloads: Record<string, unknown>[],
  ) {
    try {
      const walletAddress = auth.accessToken;
      
      // Query for user's liquidity positions
      const query = `
        query GetUserPositions($user: String!) {
          liquidityPositions(where: { user: $user }, first: 100) {
            id
            liquidityTokenBalance
            pool {
              id
              token0 {
                symbol
                name
                decimals
              }
              token1 {
                symbol
                name
                decimals
              }
            }
          }
        }
      `;

      const response = await this.querySubgraph(query, { user: walletAddress.toLowerCase() });
      sourcePayloads.push({ holdings: response });

      const sourceRef = makeSourceRef(this.provider, this.region, this.config.chain);
      const positions = response.liquidityPositions as Record<string, unknown>[] || [];
      
      return positions.map((p) => {
        const pool = p.pool as Record<string, unknown>;
        const token0 = pool.token0 as Record<string, unknown>;
        const token1 = pool.token1 as Record<string, unknown>;
        
        // Return two holdings for the two tokens in the pool
        const holdings = [];
        for (const [token, name] of [[token0, token0.symbol], [token1, token1.symbol]]) {
          const tokenRecord = token as Record<string, unknown>;
          const instrument = makeInstrumentIdentity({
            symbol: String(name),
            name: String(name),
            chain: this.config.chain,
            contractAddress: String(tokenRecord.id),
            tokenStandard: "ERC20",
            exchange: this.config.exchange,
            assetClass: "CRYPTO",
            region: this.region,
            sector: null,
          });

          holdings.push({
            source: sourceRef,
            instrument,
            quantity: Number(p.liquidityTokenBalance) / 2, // Simplified - actual calculation needed
            averagePrice: 0,
            marketPrice: null,
            marketValue: null,
            costBasis: null,
            unrealizedPnl: null,
            unrealizedPnlPercent: null,
            dayChange: null,
            dayChangePercent: null,
            confidence: scoreConfidence({
              contractAddress: instrument.contractAddress,
              exchange: instrument.exchange,
              marketPrice: null,
              costBasis: null,
              unrealizedPnl: null,
            }),
            raw: p,
          });
        }
        
        return holdings;
      }).flat();
    } catch (error) {
      warnings.push(`Failed to fetch holdings: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  private async fetchTransactions(
    auth: BrokerAuthHandle,
    warnings: string[],
    sourcePayloads: Record<string, unknown>[],
  ) {
    try {
      const walletAddress = auth.accessToken;
      
      // Query for user's swap transactions
      const query = `
        query GetUserSwaps($user: String!) {
          swaps(where: { sender: $user }, orderBy: timestamp, orderDirection: desc, first: 100) {
            id
            timestamp
            amount0In
            amount0Out
            amount1In
            amount1Out
            amountUSD
            pool {
              token0 {
                symbol
                id
              }
              token1 {
                symbol
                id
              }
            }
          }
        }
      `;

      const response = await this.querySubgraph(query, { user: walletAddress.toLowerCase() });
      sourcePayloads.push({ transactions: response });

      const sourceRef = makeSourceRef(this.provider, this.region, this.config.chain);
      const swaps = response.swaps as Record<string, unknown>[] || [];
      
      return swaps.map((s) => {
        const pool = s.pool as Record<string, unknown>;
        const token0 = pool.token0 as Record<string, unknown>;
        const token1 = pool.token1 as Record<string, unknown>;
        
        const isSwap0In = s.amount0In && Number(s.amount0In) > 0;
        const tokenIn = isSwap0In ? token0 : token1;
        const tokenOut = isSwap0In ? token1 : token0;
        const amountIn = isSwap0In ? s.amount0In : s.amount1In;

        return {
          source: sourceRef,
          instrument: makeInstrumentIdentity({
            symbol: String(tokenIn.symbol),
            name: String(tokenIn.symbol),
            chain: this.config.chain,
            contractAddress: String(tokenIn.id),
            tokenStandard: "ERC20",
            exchange: this.config.exchange,
            assetClass: "CRYPTO",
            region: this.region,
          }),
          transactionType: "swap" as const,
          quantity: Number(amountIn),
          price: Number(s.amountUSD) / Number(amountIn),
          amount: Number(s.amountUSD),
          tradeDate: s.timestamp ? new Date(Number(s.timestamp) * 1000).toISOString() : new Date().toISOString(),
          settlementDate: null,
          orderId: s.id ? String(s.id) : null,
          tradeId: s.id ? String(s.id) : null,
          status: "completed",
          fees: null,
          taxes: null,
          notes: `Swapped ${String(tokenIn.symbol)} for ${String(tokenOut.symbol)}`,
          raw: s,
        };
      });
    } catch (error) {
      warnings.push(`Failed to fetch transactions: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  private async fetchBalances(
    auth: BrokerAuthHandle,
    warnings: string[],
    _sourcePayloads: Record<string, unknown>[],
  ) {
    try {
      // For DEX, balances are fetched from the blockchain directly
      // This is a placeholder - actual implementation would use RPC endpoints
      warnings.push("DEX balance fetching requires blockchain RPC integration");
      return [];
    } catch (error) {
      warnings.push(`Failed to fetch balances: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }
}
