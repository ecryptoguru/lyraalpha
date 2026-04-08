/**
 * Seed KnowledgeDoc with crypto fundamentals for Lyra RAG.
 * Addresses crypto quality gap (85.5 avg vs 88-89 for other categories).
 * Run: SKIP_CREDITS=true tsx --env-file=.env scripts/seed-crypto-rag.ts
 */
import { prisma } from "@/lib/prisma";
import { getEmbeddingClient } from "@/lib/ai/config";

interface DocInput {
  content: string;
  metadata: Record<string, string>;
}

const CRYPTO_DOCS: DocInput[] = [
  {
    content: `Bitcoin (BTC) Fundamentals: Fixed supply 21M BTC, ~19.7M circulating. Halving every ~4 years (next ~2028), reward now 3.125 BTC/block. Key on-chain metrics: MVRV ratio >3.5 = overheated, <1 = undervalued. NUPL tracks cycle phase. 200-week MA is the macro bull/bear threshold. Bitcoin dominance rising = risk-off rotation to BTC; falling = altseason. Network hashrate is the primary security metric. Exchange net flow negative (coins leaving) = HODLing signal (bullish). Stock-to-flow ratio measures scarcity. Realized cap = sum of all BTC valued at last-moved price.`,
    metadata: { category: "crypto", asset: "BTC", topic: "fundamentals" },
  },
  {
    content: `Ethereum (ETH) Fundamentals: Proof-of-Stake since The Merge (Sep 2022), 99.95% less energy. Net issuance ~0.5-1% annually, deflationary during high usage via EIP-1559 base fee burn. Staking yield ~3-4% APY; ~28M ETH staked (~23% supply). ETH/BTC ratio tracks Ethereum's relative strength vs Bitcoin. DeFi TVL above $50B signals strong utility demand. Gas fees (Gwei) spike during congestion. Layer-2s (Arbitrum, Optimism, Base) reduce fees 10-100x. Near-full token dilution means minimal future unlock sell pressure vs newer tokens.`,
    metadata: { category: "crypto", asset: "ETH", topic: "fundamentals" },
  },
  {
    content: `Crypto Market Cycles: 4-year cycles anchored to Bitcoin halvings. Phases: Accumulation (low prices, smart money buying) → Bull Run (price discovery, retail FOMO) → Distribution (insiders selling to retail) → Bear/Capitulation (forced selling, HODLer accumulation). Key indicators: MVRV Z-Score (>7 sell zone, <0 buy zone), Puell Multiple (>4 sell, <0.5 buy), Long-Term Holder Supply rising in bear = accumulation phase. Average bear duration: 12-18 months post-peak. Bull market peak: typically 12-18 months post-halving. Crypto Fear & Greed Index below 20 = historically strong buying zone.`,
    metadata: { category: "crypto", topic: "market-cycles" },
  },
  {
    content: `Crypto On-Chain Analysis: On-chain data provides real-time market transparency unavailable in traditional finance. Key metrics: (1) Exchange Net Flow: positive (coins entering) = selling intent bearish; negative (coins leaving) = HODLing bullish. (2) SOPR (Spent Output Profit Ratio): above 1 = holders selling in profit; below 1 = capitulation selling at loss. (3) Active Addresses: proxy for network adoption and usage growth. (4) NVT Ratio: crypto equivalent of P/E — high NVT = overvalued vs on-chain transaction volume. (5) Funding Rates: perpetual futures mechanism — positive = longs paying shorts (overcrowded), negative = short squeeze setup. (6) Open Interest rising with price = trend confirmation; rising OI with falling price = short buildup.`,
    metadata: { category: "crypto", topic: "on-chain-analysis" },
  },
  {
    content: `DeFi (Decentralized Finance) Fundamentals: DeFi replaces financial intermediaries with smart contracts on blockchain. Total Value Locked (TVL): peak ~$180B (Nov 2021), trough ~$37B (Dec 2022), recovery ~$90-100B. Key metrics: TVL/MCap ratio (lower = undervalued vs usage), Protocol Revenue (fees to treasury and token holders), Revenue/TVL (capital efficiency). Top protocols: Lido (liquid staking ~$30B+), AAVE (lending), Uniswap (DEX), MakerDAO (stablecoins). Yield sources: lending interest, AMM trading fees, liquidity mining, staking. Impermanent Loss: AMM LP risk when pooled asset prices diverge — must be weighed against fee income. L2s make small DeFi positions economical (10-100x cheaper than Ethereum mainnet).`,
    metadata: { category: "crypto", topic: "defi-tvl" },
  },
  {
    content: `Crypto Tokenomics Framework: (1) Supply Schedule: fixed cap (BTC), inflationary, deflationary via burn (ETH). Watch VC/team unlock schedules — cliff unlocks create predictable sell pressure. (2) FDV/MCap Ratio: FDV uses max supply. Ratio above 5x means heavy future dilution — structural headwind. (3) Token Utility: gas/fee token (ETH, SOL), governance (UNI, AAVE), staking/security (ETH, DOT), collateral. Pure governance tokens with no fee accrual have structurally weak value capture. (4) Annual Emission Rate: above 20% = structural sell pressure unless demand offsets. (5) Whale Concentration: top 10 wallets above 40% of supply = manipulation risk. (6) Vesting: 1-year cliff unlocks for team/VC create predictable sell dates.`,
    metadata: { category: "crypto", topic: "tokenomics" },
  },
  {
    content: `India Crypto Tax Treatment (Budget 2022+): (1) 30% flat tax on all crypto gains — no short-term vs long-term distinction. (2) No loss offset: crypto losses cannot be offset against any other income or other crypto gains in same year. (3) 1% TDS on transactions above ₹10,000 (₹50,000 for specified persons). (4) Mining income taxed as "income from other sources" at slab rate. (5) Staking rewards taxable as income at receipt at fair market value. (6) Each DeFi swap is a separate taxable event. (7) Cost basis: FIFO. Effective rate including surcharge can reach 42.74% for high earners. India has one of the harshest crypto tax regimes globally — has driven trading volume offshore. USDT holdings in India also subject to 30% on trades.`,
    metadata: { category: "crypto", topic: "india-tax" },
  },
  {
    content: `Bitcoin Halving History and Price Impact: Halvings reduce miner block reward 50% every ~4 years. History: (1) Nov 2012 (50→25 BTC): $12 → $1,100 over 12 months (+9,000%). (2) Jul 2016 (25→12.5 BTC): $650 → $20,000 over 17 months (+2,900%). (3) May 2020 (12.5→6.25 BTC): $8,700 → $69,000 over 18 months (+693%). (4) Apr 2024 (6.25→3.125 BTC): current cycle. Pattern: bull market peak 12-18 months post-halving; diminishing % returns each cycle as market cap base grows. Post-halving miner economics: revenue halved unless BTC price rises to compensate — near-term sell pressure from miners covering costs. Hash Ribbon indicator (miner capitulation then recovery) is a historical buy signal.`,
    metadata: { category: "crypto", asset: "BTC", topic: "halving-cycles" },
  },
  {
    content: `Stablecoins and Crypto Monetary Dynamics: Stablecoins = crypto pegged 1:1 to fiat. Market caps: USDT ~$110B, USDC ~$35B, DAI/USDS ~$5B. Types: (1) Fiat-backed (USDT, USDC): 1:1 backed by USD/treasuries — issuer counterparty risk. (2) Crypto-collateralized (DAI): over-collateralized with ETH/BTC — decentralized but capital-inefficient. (3) Algorithmic (UST/LUNA): catastrophically failed May 2022 — $40B wiped in 72 hours. Stablecoin Dominance rising = capital on sidelines = cautious near-term but bullish medium-term as dry powder. Stablecoin Supply Ratio (BTC MCap / stablecoin supply): low ratio = high buying power available = bullish signal. India note: stablecoins subject to same 30% tax on trades as other crypto.`,
    metadata: { category: "crypto", topic: "stablecoins" },
  },
  {
    content: `Altcoin Framework and Altseason Signals: Altcoins (all crypto except BTC) carry higher volatility and beta vs Bitcoin. Key signals: (1) BTC Dominance falling = altseason — defined as >75% of top-100 alts outperforming BTC over 90 days. (2) ETH/BTC ratio rising = Ethereum ecosystem alts tend to follow. (3) Categories: Layer-1 (SOL, AVAX), Layer-2 (ARB, OP), DeFi (UNI, AAVE), AI/Data (FET, RNDR), Meme (DOGE, SHIB). Quality filters to avoid: FDV/MCap >5x, age <6 months, no security audits, anonymous teams, emission rate >20% annual. Liquidity threshold: 24h volume >1% of market cap required for meaningful position. India: only ~10-15 altcoins have sufficient INR liquidity on CoinDCX/WazirX for sizeable positions without material slippage.`,
    metadata: { category: "crypto", topic: "altcoins" },
  },
  {
    content: `Crypto DCA (Dollar Cost Averaging) Strategy: DCA = buying fixed INR/USD amount at regular intervals regardless of price. Evidence: DCA into BTC monthly from Jan 2018 (post-ATH bear entry) for 4 years produced average cost ~$12,000 vs $65,000+ current price — 5x+ return despite buying at the prior cycle peak. Indian platforms with SIP-equivalent: CoinDCX and CoinSwitch offer automated recurring purchases. Key parameters: (1) Weekly beats monthly in volatile assets — more price averaging. (2) BTC/ETH as core DCA assets; altcoin DCA only with high conviction. (3) Pause DCA only on material regulatory risk, NOT on price action alone. (4) Lump sum statistically outperforms DCA in bull markets; DCA outperforms in bear/sideways. Tax note: each DCA purchase is a separate cost-basis lot under FIFO.`,
    metadata: { category: "crypto", topic: "dca-strategy" },
  },
  {
    content: `Crypto Spot vs Futures Trading: Spot: buying actual cryptocurrency, immediate settlement, no expiry, no liquidation risk, no funding cost. Futures: derivative contracts — can go long or short, often with leverage. Perpetual futures (perps): no expiry, anchored to spot via funding rate. Funding Rate positive = longs paying shorts = overcrowded longs = liquidation cascade risk. Basis (futures - spot): positive = contango (bullish sentiment); negative = backwardation (bearish). Open Interest rising with price = trend confirmation; rising OI with falling price = short buildup. High OI + high funding rate = maximum cascade risk. Leverage risk: 10x leverage means 10% adverse move = total loss. India: no mainstream Indian exchange offers crypto futures with deep liquidity. Global platforms: Binance, Bybit, OKX, CME (institutional BTC/ETH contracts).`,
    metadata: { category: "crypto", topic: "spot-vs-futures" },
  },
  {
    content: `Layer-1 Blockchain Comparison — ETH, SOL, AVAX, ADA: Ethereum: 900,000+ validators (most decentralized), ~30 TPS mainnet (unlimited via L2s), $60B+ TVL, 4,000+ monthly active developers. Solana (SOL): 65,000 TPS theoretical, ~2,000-4,000 TPS actual, $0.001 tx fees, 1,700 validators (less decentralized), 7+ historical outages, strong institutional traction (Visa, Stripe, PayPal integrations), ~$6B TVL. Avalanche (AVAX): 4,500 TPS, subnet architecture for custom blockchains, lower TVL. Cardano (ADA): academic/peer-reviewed, UTXO-based, ~250 TPS, slower development pace. ETH earns 10-50x more in daily fees than SOL in bull markets. Blockchain trilemma: cannot simultaneously maximize security, decentralization, AND scalability — each chain makes explicit trade-offs defining its character.`,
    metadata: { category: "crypto", topic: "layer1-comparison" },
  },
  {
    content: `Blockchain Technology Fundamentals: A blockchain is a distributed ledger stored across thousands of nodes — immutable and censorship-resistant. Consensus: Proof of Work (BTC) — miners solve hash puzzles, energy-intensive, most battle-tested. Proof of Stake (ETH, SOL) — validators stake tokens, 99.9% more energy efficient. Block times: BTC ~10 min, ETH ~12 sec, SOL ~0.4 sec. Finality: BTC ~60 min (6 confirmations), ETH ~12 min (2 epochs), SOL ~0.4 sec (single slot). Smart contracts: self-executing code, no intermediary — enables DeFi, NFTs, DAOs. Gas fees: transaction fees paid to validators, market-priced. EIP-1559 introduced base fee burn — fees paid to Ethereum are destroyed, making ETH deflationary during congestion. Each blockchain interaction is a public on-chain transaction permanently recorded.`,
    metadata: { category: "crypto", topic: "blockchain-basics" },
  },
  {
    content: `Crypto Security and Self-Custody: Exchange failures: Mt. Gox 2014 ($450M), Bitfinex 2016 ($72M), FTX Nov 2022 ($8B customer funds lost). Self-custody tiers: (1) Hardware wallets: Ledger Nano X (~$150), Trezor Model T (~$200) — private keys stored completely offline. Mandatory for holdings above $10K. (2) Software wallets: MetaMask, Trust Wallet — internet-connected, convenient but vulnerable. (3) Multi-sig: M-of-N signatures required — institutional standard (e.g. 2-of-3). Seed phrase (12 or 24 words) = full wallet access — never store digitally, never photograph, store physical copies in 2 separate locations. Proof-of-Reserves: Coinbase and Kraken publish monthly. India: CoinDCX and CoinSwitch are FIU-IND registered, no major hacks to date, but custodial risk remains non-zero.`,
    metadata: { category: "crypto", topic: "security-custody" },
  },
  {
    content: `Crypto Regulatory Landscape — India and Global: India: legal to own and trade, 30% tax + 1% TDS, FIU-IND registration mandatory for exchanges, VDA (Virtual Digital Asset) classification, no ban despite early signals, e-Rupee CBDC launched as complement not replacement. USA: Bitcoin and Ethereum spot ETFs approved Jan 2024 (BlackRock IBIT $20B+ AUM, Fidelity FBTC); SEC ongoing enforcement on altcoins as unregistered securities; Coinbase, Kraken face regulatory pressure. EU: MiCA (Markets in Crypto Assets) regulation effective 2024 — comprehensive licensing, most progressive major jurisdiction. UAE: zero crypto tax, major exchange hub. El Salvador: BTC legal tender since 2021. China: complete ban on trading and mining since 2021. Key 2024-2025 positive catalysts: institutional ETF flows ($10B+ year one), potential spot altcoin ETFs, clearer global frameworks.`,
    metadata: { category: "crypto", topic: "regulation" },
  },
  {
    content: `Crypto Portfolio Construction and Risk Management: Position sizing: risk-based approach — size each holding so maximum loss (assuming -80% drawdown, historically typical for bear markets) equals acceptable portfolio loss. Formula: Position = (Portfolio × Max Loss%) / 80%. Risk tiers: Tier 1 (BTC, ETH) — 60-70% of crypto allocation, highest liquidity and security. Tier 2 (SOL, BNB, established L1s) — 20-30%, higher volatility but proven. Tier 3 (DeFi, emerging protocols) — max 10-15%, high risk/reward. Total crypto allocation: institutional consensus 1-5% of total portfolio for risk-tolerant investors. Rebalancing: quarterly rebalancing captures volatility premium. Correlation note: during macro stress events (2020 COVID crash, 2022 Fed tightening) all crypto correlates to ~1.0 — crypto does NOT provide crisis diversification vs equities.`,
    metadata: { category: "crypto", topic: "portfolio-construction" },
  },
  {
    content: `Gas Fees and Ethereum Network Economics: Gas fees compensate validators for computation and storage. Gas price = Base Fee (burned via EIP-1559) + Priority Tip (to validator). During high demand, base fee spikes algorithmically — can reach 100-500 Gwei ($5-50 per simple transfer). Gas limit: maximum gas a transaction can consume. Complex DeFi operations: 100,000-500,000 gas units vs 21,000 for simple ETH transfer. Layer-2 solutions solve gas cost problem: Arbitrum, Optimism, Base charge $0.01-0.10 per transaction. Gas fee tracking tools: Etherscan Gas Tracker, Gas Now. Gas fee patterns: lowest on weekends and US off-hours (UTC 2-8am). High gas fee periods signal peak network demand — correlates with bull market activity. Base fee burning creates deflationary pressure: in Nov 2021 peak, ETH net issuance was -3% annualized.`,
    metadata: { category: "crypto", topic: "gas-fees" },
  },
  {
    content: `Impermanent Loss in DeFi Liquidity Provision: Impermanent Loss (IL) occurs when a liquidity provider (LP) in an Automated Market Maker (AMM) experiences loss vs simply holding the assets. Mechanism: AMMs maintain constant product formula (x*y=k). When one asset price rises, the pool automatically sells it for the other — LP ends up holding less of the appreciated asset. IL calculation examples: 25% price change = 0.6% IL, 50% price change = 2% IL, 100% price change = 5.7% IL, 200% price change = 13.4% IL, 500% price change = 25.5% IL. IL is only "impermanent" if prices return to entry ratio — if they do not, losses are permanent. IL is offset by trading fee income: Uniswap v3 concentrated liquidity earns higher fees but requires active management. Stable/stable pairs (USDC/USDT) have near-zero IL. High-correlation pairs (ETH/stETH) have minimal IL.`,
    metadata: { category: "crypto", topic: "impermanent-loss" },
  },
  {
    content: `Crypto Market Cap, TVL, and Valuation Metrics: Total crypto market cap: peak ~$3T (Nov 2021), trough ~$800B (Dec 2022), typical range $1.5-2.5T in current cycle. BTC market cap ~$1.3T at cycle high = 43-45% of total (BTC dominance). Valuation frameworks: (1) NVT Ratio (Network Value / Daily Transaction Volume): high NVT = overvalued vs usage, low NVT = undervalued. (2) Metcalfe's Law: network value scales with square of active users — models BTC price vs active addresses. (3) Stock-to-Flow (S2F): models BTC scarcity — ratio of existing supply to annual new supply. Historically predictive but increasingly debated at scale. (4) MVRV Ratio: market cap / realized cap — above 3.5 historically signals overheating. (5) For DeFi protocols: P/S ratio (protocol market cap / annualized revenue) equivalent to traditional P/S. (6) TVL-to-MCap: measures how much real capital a protocol attracts per dollar of token value.`,
    metadata: { category: "crypto", topic: "valuation-metrics" },
  },
];

async function getEmbedding(text: string): Promise<number[]> {
  const client = getEmbeddingClient();
  const response = await client.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return response.data[0].embedding;
}

async function seedCryptoRag() {
  console.log(`Seeding ${CRYPTO_DOCS.length} crypto RAG documents...`);

  let inserted = 0;
  let skipped = 0;

  for (const doc of CRYPTO_DOCS) {
    const topic = doc.metadata.topic;

    const existing = await prisma.knowledgeDoc.findFirst({
      where: {
        metadata: {
          path: ["topic"],
          equals: topic,
        },
      },
    });

    if (existing) {
      console.log(`  SKIP (exists): ${topic}`);
      skipped++;
      continue;
    }

    const embedding = await getEmbedding(doc.content);
    const vectorLiteral = `[${embedding.join(",")}]`;

    await prisma.$executeRaw`
      INSERT INTO "KnowledgeDoc" (id, content, metadata, embedding, "createdAt")
      VALUES (
        gen_random_uuid()::text,
        ${doc.content},
        ${doc.metadata}::jsonb,
        ${vectorLiteral}::vector,
        NOW()
      )
    `;

    console.log(`  OK: ${topic}`);
    inserted++;
  }

  console.log(`\nDone. Inserted: ${inserted} | Skipped (already exist): ${skipped}`);
}

seedCryptoRag()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
