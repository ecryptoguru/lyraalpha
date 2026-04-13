import { AssetType } from "../src/generated/prisma/client";
import { directPrisma as prisma } from "../src/lib/prisma";
import { blogPosts as staticBlogPosts } from "../src/lib/blog/posts";

// Crypto Sectors & Themes (Aligned with CoinGecko Categories)
const SECTORS = [
  {
    name: "Layer 1 Blockchains",
    slug: "layer-1",
    description:
      "Foundational blockchain networks providing the base layer for decentralized applications and digital assets.",
    drivers: "Institutional adoption, ETF approvals, network security upgrades, scalability improvements.",
    rationale:
      "Layer 1 blockchains form the infrastructure backbone of the crypto economy with proven security models.",
  },
  {
    name: "Layer 2 Scaling",
    slug: "layer-2",
    description:
      "Scaling solutions built on top of Layer 1 blockchains to improve transaction throughput and reduce fees.",
    drivers: "Ethereum congestion, gas optimization, DeFi growth, user experience improvements.",
    rationale:
      "Layer 2s are critical for mass adoption by enabling low-cost, high-speed transactions while inheriting L1 security.",
  },
  {
    name: "DeFi",
    slug: "defi",
    description:
      "Decentralized finance protocols for lending, borrowing, trading, and yield generation without intermediaries.",
    drivers: "Yield farming, institutional DeFi, cross-chain bridges, real-world asset tokenization.",
    rationale:
      "DeFi represents the financial layer of Web3, offering programmable money and permissionless financial services.",
  },
  {
    name: "Stablecoins",
    slug: "stablecoins",
    description:
      "Price-stable cryptocurrencies pegged to fiat currencies or commodities, enabling digital payments and hedging.",
    drivers: "Regulatory clarity, payment integration, institutional adoption, cross-border settlements.",
    rationale:
      "Stablecoins are the bridge between traditional finance and crypto, providing stability in volatile markets.",
  },
  {
    name: "Meme Coins",
    slug: "meme-coins",
    description:
      "Community-driven cryptocurrencies often inspired by internet culture and social media trends.",
    drivers: "Social sentiment, community engagement, celebrity endorsements, viral marketing.",
    rationale:
      "Meme coins demonstrate the power of community and social dynamics in driving crypto adoption and liquidity.",
  },
  {
    name: "NFTs",
    slug: "nft",
    description:
      "Non-fungible tokens representing unique digital assets, collectibles, and ownership on blockchain.",
    drivers: "Digital collectibles market, virtual real estate, art tokenization, creator economy.",
    rationale:
      "NFTs enable verifiable digital ownership and new monetization models for creators and collectors.",
  },
  {
    name: "Gaming (GameFi)",
    slug: "gaming",
    description:
      "Blockchain-based gaming platforms and play-to-earn games combining entertainment with token economics.",
    drivers: "Play-to-earn adoption, game studios entering Web3, in-game economies, virtual worlds.",
    rationale:
      "GameFi represents the convergence of gaming and finance, enabling players to earn from their gaming activities.",
  },
  {
    name: "Exchange Tokens",
    slug: "exchange-tokens",
    description:
      "Utility tokens issued by cryptocurrency exchanges providing trading fee discounts and ecosystem benefits.",
    drivers: "Exchange volume growth, token burns, ecosystem expansion, buyback programs.",
    rationale:
      "Exchange tokens capture value from trading activity and provide utility within their respective platforms.",
  },
  {
    name: "RWA Tokenization",
    slug: "rwa-tokenization",
    description:
      "Real-world asset tokenization bringing traditional financial assets like bonds, equities, and commodities on-chain.",
    drivers: "Regulatory frameworks, institutional interest, compliance solutions, liquidity expansion.",
    rationale:
      "RWA tokenization bridges traditional finance with DeFi, unlocking trillions in illiquid assets.",
  },
  {
    name: "Privacy Coins",
    slug: "privacy-coins",
    description:
      "Cryptocurrencies focused on transaction privacy and anonymity through advanced cryptographic techniques.",
    drivers: "Privacy concerns, surveillance resistance, regulatory scrutiny, technological advancements.",
    rationale:
      "Privacy coins address the fundamental right to financial privacy in an increasingly transparent digital world.",
  },
  {
    name: "Infrastructure",
    slug: "infrastructure",
    description:
      "Critical blockchain infrastructure including oracles, bridges, cross-chain protocols, and developer tools.",
    drivers: "Multi-chain ecosystem, oracle adoption, cross-chain interoperability, developer activity.",
    rationale:
      "Infrastructure protocols are the plumbing of crypto, enabling connectivity and data flow across the ecosystem.",
  },
  {
    name: "AI & Machine Learning",
    slug: "ai-crypto",
    description:
      "Cryptocurrency projects at the intersection of artificial intelligence and blockchain technology.",
    drivers: "AI model training, decentralized compute, data marketplaces, AI agent integration.",
    rationale:
      "AI crypto projects leverage blockchain for decentralized AI infrastructure, data sovereignty, and incentive alignment.",
  },
  {
    name: "Governance",
    slug: "governance",
    description:
      "Governance tokens that enable holders to vote on protocol decisions and influence project direction.",
    drivers: "DAO adoption, decentralized governance models, community voting, protocol upgrades.",
    rationale:
      "Governance tokens enable decentralized decision-making and community ownership of blockchain protocols.",
  },
  {
    name: "Zero Knowledge (ZK)",
    slug: "zero-knowledge",
    description:
      "Zero-knowledge proof technologies enabling privacy-preserving transactions and scaling solutions.",
    drivers: "ZK-rollup adoption, privacy enhancements, scalability breakthroughs, Ethereum integration.",
    rationale:
      "ZK technologies provide both privacy and scalability without compromising on security or decentralization.",
  },
  {
    name: "Decentralized Exchange (DEX)",
    slug: "dex",
    description:
      "Decentralized exchange protocols enabling peer-to-peer trading without intermediaries.",
    drivers: "DEX volume growth, liquidity mining, cross-chain DEXs, AMM innovation.",
    rationale:
      "DEXs enable trustless, permissionless trading and represent the future of crypto market infrastructure.",
  },
];

// Crypto Asset Mappings (At least 5 per sector, aligned with CoinGecko)
const MAPPINGS = {
  "layer-1": ["BTC-USD", "ETH-USD", "SOL-USD", "ADA-USD", "AVAX-USD", "DOT-USD", "NEAR-USD", "ATOM-USD"],
  "layer-2": ["ARB-USD", "OP-USD", "POL-USD", "MATIC-USD", "IMX-USD"],
  defi: ["UNI-USD", "AAVE-USD", "SUSHI-USD", "CRV-USD", "MKR-USD", "COMP-USD", "YFI-USD"],
  stablecoins: ["USDT-USD", "USDC-USD", "DAI-USD", "USDD-USD", "FRAX-USD", "TUSD-USD"],
  "meme-coins": ["DOGE-USD", "SHIB-USD", "PEPE-USD", "BONK-USD", "WIF-USD", "FLOKI-USD"],
  nft: ["SAND-USD", "MANA-USD", "ENJ-USD", "APE-USD", "BLUR-USD", "LOOKS-USD"],
  gaming: ["AXS-USD", "IMX-USD", "GALA-USD", "SAND-USD", "MANA-USD", "RON-USD"],
  "exchange-tokens": ["BNB-USD", "KCS-USD", "GT-USD", "BGB-USD", "HT-USD", "CRO-USD"],
  "rwa-tokenization": ["ONDO-USD", "TRU-USD", "RWA-USD", "PENDLE-USD", "STX-USD", "CFG-USD"],
  "privacy-coins": ["XMR-USD", "ZEC-USD", "SCRT-USD", "XVG-USD", "DASH-USD", "BEAM-USD"],
  infrastructure: ["LINK-USD", "DOT-USD", "ATOM-USD", "NEAR-USD", "QNT-USD", "BAND-USD"],
  "ai-crypto": ["FET-USD", "RNDR-USD", "AGIX-USD", "TAO-USD", "OCEAN-USD", "NMR-USD"],
  governance: ["UNI-USD", "AAVE-USD", "MKR-USD", "COMP-USD", "CRV-USD", "YFI-USD"],
  "zero-knowledge": ["ZK-USD", "STX-USD", "IMX-USD", "MATIC-USD", "MINA-USD"],
  dex: ["UNI-USD", "SUSHI-USD", "CRV-USD", "1INCH-USD", "JUP-USD", "DYDX-USD"],
};

// Asset Metadata (to ensure we have names)
const ASSET_NAMES: Record<string, string> = {
  "BTC-USD": "Bitcoin",
  "ETH-USD": "Ethereum",
  "SOL-USD": "Solana",
  "ADA-USD": "Cardano",
  "AVAX-USD": "Avalanche",
  "DOT-USD": "Polkadot",
  "NEAR-USD": "NEAR Protocol",
  "ATOM-USD": "Cosmos",
  "ARB-USD": "Arbitrum",
  "OP-USD": "Optimism",
  "POL-USD": "Polygon",
  "MATIC-USD": "Polygon (Legacy)",
  "IMX-USD": "Immutable X",
  "UNI-USD": "Uniswap",
  "AAVE-USD": "Aave",
  "SUSHI-USD": "SushiSwap",
  "CRV-USD": "Curve DAO",
  "MKR-USD": "Maker",
  "COMP-USD": "Compound",
  "YFI-USD": "yearn.finance",
  "USDT-USD": "Tether",
  "USDC-USD": "USD Coin",
  "DAI-USD": "Dai",
  "USDD-USD": "USDD",
  "FRAX-USD": "Frax",
  "TUSD-USD": "TrueUSD",
  "DOGE-USD": "Dogecoin",
  "SHIB-USD": "Shiba Inu",
  "PEPE-USD": "Pepe",
  "BONK-USD": "Bonk",
  "WIF-USD": "dogwifhat",
  "FLOKI-USD": "FLOKI",
  "SAND-USD": "The Sandbox",
  "MANA-USD": "Decentraland",
  "ENJ-USD": "Enjin Coin",
  "APE-USD": "ApeCoin",
  "BLUR-USD": "Blur",
  "LOOKS-USD": "LooksRare",
  "AXS-USD": "Axie Infinity",
  "GALA-USD": "Gala",
  "RON-USD": "Ronin",
  "BNB-USD": "BNB",
  "KCS-USD": "KuCoin Token",
  "GT-USD": "GateToken",
  "BGB-USD": "Bitget Token",
  "HT-USD": "Huobi Token",
  "CRO-USD": "Cronos",
  "ONDO-USD": "Ondo",
  "TRU-USD": "TrueFi",
  "RWA-USD": "Real World Assets",
  "PENDLE-USD": "Pendle",
  "STX-USD": "Stacks",
  "CFG-USD": "Centrifuge",
  "XMR-USD": "Monero",
  "ZEC-USD": "Zcash",
  "SCRT-USD": "Secret",
  "XVG-USD": "Verge",
  "DASH-USD": "Dash",
  "BEAM-USD": "Beam",
  "LINK-USD": "Chainlink",
  "QNT-USD": "Quant",
  "BAND-USD": "Band Protocol",
  "FET-USD": "Fetch.ai",
  "RNDR-USD": "Render",
  "AGIX-USD": "SingularityNET",
  "TAO-USD": "Bittensor",
  "OCEAN-USD": "Ocean Protocol",
  "NMR-USD": "Numeraire",
  "ZK-USD": "ZkSync",
  "MINA-USD": "Mina",
  "1INCH-USD": "1inch",
  "JUP-USD": "Jupiter",
  "DYDX-USD": "dYdX",
};

async function main() {
  console.log("🌱 Seeding Crypto Discovery Universe...");

  for (const sector of SECTORS) {
    console.log(`Processing Sector: ${sector.name}`);

    // 1. Create/Update Sector
    const dbSector = await prisma.sector.upsert({
      where: { slug: sector.slug },
      update: {
        name: sector.name,
        description: sector.description,
        drivers: sector.drivers,
        rationale: sector.rationale,
      },
      create: {
        name: sector.name,
        slug: sector.slug,
        description: sector.description,
        drivers: sector.drivers,
        rationale: sector.rationale,
      },
    });

    // 2. Map Crypto Assets
    const symbols = MAPPINGS[sector.slug as keyof typeof MAPPINGS];
    if (symbols) {
      for (const symbol of symbols) {
        // Ensure Asset Exists
        const asset = await prisma.asset.upsert({
          where: { symbol },
          update: {
            region: "US",
             lastPriceUpdate: new Date(),
             price: Math.floor(Math.random() * 50000) + 100,
             changePercent: (Math.random() * 20) - 10,
             avgTrendScore: 70,
             avgMomentumScore: 75,
             avgVolatilityScore: 50,
             avgLiquidityScore: 80,
             compatibilityScore: 85,
             compatibilityLabel: "Regime Aligned",
             assetGroup: "Crypto Universe",
          },
          create: {
            symbol,
            name: ASSET_NAMES[symbol] || symbol,
            type: AssetType.CRYPTO,
            region: "US",
            sector: sector.name,
            lastPriceUpdate: new Date(),
            price: Math.floor(Math.random() * 50000) + 100,
            changePercent: (Math.random() * 20) - 10,
            avgTrendScore: 70,
            avgMomentumScore: 75,
            avgVolatilityScore: 50,
            avgLiquidityScore: 80,
            compatibilityScore: 85,
            compatibilityLabel: "Regime Aligned",
            assetGroup: "Crypto Universe",
          },
        });

        // Create Mapping
        await prisma.assetSector.upsert({
          where: {
            assetId_sectorId: {
              assetId: asset.id,
              sectorId: dbSector.id,
            },
          },
          update: {
            isActive: true,
            eligibilityScore: 85,
          },
          create: {
            assetId: asset.id,
            sectorId: dbSector.id,
            isActive: true,
            eligibilityScore: 85,
            inclusionReason: `Core holding in ${sector.name} sector.`,
          },
        });
      }
    }
  }


  // Seed Lyra Trending Questions
  try {
    const { seedTrendingQuestions } = await import("./seed-questions");
    await seedTrendingQuestions();
  } catch (e) {
    console.error("Failed to seed Lyra Trending Questions:", e);
  }

  // Seed Blog Posts from the static content source so the blog stays database-backed.
  console.log("📝 Seeding Blog Posts...");
  for (const post of staticBlogPosts) {
    await prisma.blogPost.upsert({
      where: { slug: post.slug },
      update: {
        title: post.title,
        description: post.description,
        content: post.content,
        author: post.author,
        category: post.category,
        tags: post.tags,
        featured: post.featured ?? false,
        status: "PUBLISHED",
        publishedAt: new Date(post.date),
        metaDescription: post.metaDescription ?? null,
        keywords: post.keywords ?? [],
        heroImageUrl: post.heroImageUrl ?? null,
        sourceAgent: post.sourceAgent ?? null,
        sourceContentId: post.slug,
      },
      create: {
        slug: post.slug,
        title: post.title,
        description: post.description,
        content: post.content,
        author: post.author,
        category: post.category,
        tags: post.tags,
        featured: post.featured ?? false,
        status: "PUBLISHED",
        publishedAt: new Date(post.date),
        metaDescription: post.metaDescription ?? null,
        keywords: post.keywords ?? [],
        heroImageUrl: post.heroImageUrl ?? null,
        sourceAgent: post.sourceAgent ?? null,
        sourceContentId: post.slug,
      },
    });
  }
  console.log("✅ Blog Posts Seeded Successfully.");

  console.log("✅ Discovery Universe Seeded Successfully.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
