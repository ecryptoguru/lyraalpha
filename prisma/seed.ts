import { AssetType, InclusionType } from "../src/generated/prisma/client";
import { directPrisma as prisma } from "../src/lib/prisma";

// Institutional Sectors & Themes
const SECTORS = [
  {
    name: "Artificial Intelligence",
    slug: "ai",
    description:
      "Companies driving the generative AI revolution through hardware, foundation models, and enterprise applications.",
    drivers: "LLM scaling laws, enterprise adoption, sovereign AI initiatives.",
    rationale:
      "Structural shift in computing architecture favoring parallel processing and semantic understanding.",
  },
  {
    name: "Fintech & Payments",
    slug: "fintech",
    description:
      "Disruptors in digital payments, lending, and financial infrastructure.",
    drivers: "Cashless transition, embedded finance, cross-border efficiency.",
    rationale:
      "Legacy banking unbundling continues with high-margin digital wallets and B2B platforms.",
  },
  {
    name: "Clean Energy",
    slug: "clean-energy",
    description:
      "Renewable energy generation, storage, and grid modernization infrastructure.",
    drivers:
      "Global net-zero mandates, energy security, declining storage costs.",
    rationale:
      "Multi-decade capex cycle replacing fossil fuel infrastructure with renewables.",
  },
  {
    name: "Semiconductors",
    slug: "semiconductors",
    description:
      "Foundries, designers, and equipment makers powering the digital economy.",
    drivers: "AI demand, automotive electrification, localized manufacturing.",
    rationale:
      "Strategic nature of silicon makes this the new oil of the digital era.",
  },
  {
    name: "Cybersecurity",
    slug: "cybersecurity",
    description:
      "Protection for enterprise data, cloud infrastructure, and critical networks.",
    drivers:
      "Ransomware threats, geopolitical cyberwarfare, SEC disclosure rules.",
    rationale: "Non-discretionary IT spend protecting digital sovereignty.",
  },
  {
    name: "Blockchain & Web3",
    slug: "blockchain",
    description:
      "Decentralized infrastructure, tokenization, and digital assets.",
    drivers:
      "Institutional adoption (ETFs), RWA tokenization, stablecoin payments.",
    rationale:
      "Financial layer of the internet reducing settlement times and counterparty risk.",
  },
  {
    name: "Cloud Computing",
    slug: "cloud-computing",
    description:
      "Hyperscalers and SaaS platforms enabling digital transformation.",
    drivers: "AI inference, data warehousing, hybrid cloud adoption.",
    rationale: "Utility-like dependence for modern enterprise operations.",
  },
  {
    name: "Biotech & Genomics",
    slug: "genomics",
    description: "CRISPR, gene editing, and precision medicine platforms.",
    drivers:
      "AI in drug discovery, aging demographics, personalized treatments.",
    rationale: "Convergence of biology and technology accelerating cure rates.",
  },
  {
    name: "Space Economy",
    slug: "space-tech",
    description:
      "Satellite constellations, launch services, and orbital infrastructure.",
    drivers:
      "Launch cost reduction (Starship), national security, global connectivity.",
    rationale:
      "Opening of low-earth orbit for commercial and defense applications.",
  },
  {
    name: "Robotics & Automation",
    slug: "robotics",
    description:
      "Industrial automation, humanoid robotics, and autonomous systems.",
    drivers:
      "Labor shortages, reshoring manufacturing, AI vision breakthroughs.",
    rationale: "Physical manifestation of AI addressing demographic cliffs.",
  },
  {
    name: "Digital Media & Gaming",
    slug: "digital-media",
    description: "Interactive entertainment, streaming, and content platforms.",
    drivers: "Attention economy, IP monetization, spatial computing.",
    rationale:
      "Media consumption shifting permanently to interactive and on-demand formats.",
  },
  {
    name: "EV & Mobility",
    slug: "electric-vehicles",
    description:
      "Electric vehicles, battery technology, and autonomous charging networks.",
    drivers:
      "Emission standards, battery density improvements, software-defined vehicles.",
    rationale:
      "Transport sector electrification is inevitable despite cyclical headwinds.",
  },
  {
    name: "Digital Payments",
    slug: "payments",
    description: "Modern payment networks and merchant services infrastructure.",
    drivers: "Contactless adoption, B2B digital transformation.",
    rationale: "Network effects in global money movement remain structural.",
  },
  {
    name: "E-Commerce",
    slug: "e-commerce",
    description: "Next-gen retail and digital marketplace leaders.",
    drivers: "Omnichannel integration, logistical efficiency.",
    rationale: "Scaling global consumer access through digital channels.",
  },
  {
    name: "Social Media",
    slug: "social-media",
    description: "Advertising and communication platforms in the attention economy.",
    drivers: "AI personalization, creator economy growth.",
    rationale: "Dominant engagement channels for generational demographics.",
  },
  {
    name: "Gaming & Esports",
    slug: "gaming-esports",
    description: "Interactive entertainment and spatial computing platforms.",
    drivers: "Cloud gaming, interactive IP monetization.",
    rationale: "Gaming becoming the primary social layer for younger cohorts.",
  },
  {
    name: "Batteries & Storage",
    slug: "batteries-storage",
    description: "Lithium supply chains and energy storage systems.",
    drivers: "Grid balancing requirements, battery chemistry shifts.",
    rationale: "Essential enabling technology for the renewable transition.",
  },
  {
    name: "Biotechnology",
    slug: "biotechnology",
    description: "Novel drug candidates and therapeutic platforms.",
    drivers: "FDA approval cycles, strategic M&A environment.",
    rationale: "Direct exposure to R&D breakthroughs in medical science.",
  },
  {
    name: "5G & Connectivity",
    slug: "5g-connectivity",
    description: "Low-latency network infrastructure and equipment.",
    drivers: "Edge computing integration, Open RAN adoption.",
    rationale: "Mission-critical infrastructure for the connected economy.",
  },
  {
    name: "Quantum Computing",
    slug: "quantum-computing",
    description: "Next-gen computing utilizing quantum mechanics.",
    drivers: "Materials science, cryptography breakthroughs.",
    rationale: "Exponential leaps in computational power for complex modeling.",
  },
  {
    name: "The Metaverse",
    slug: "metaverse",
    description: "Immersive 3D environments and virtual infrastructure.",
    drivers: "Spatial hardware (VR/AR), software-defined worlds.",
    rationale: "Convergence of social, gaming, and commercial industries and AI.",
  },
  // ── India-Specific Sectors ──
  {
    name: "Defence & Aerospace (India)",
    slug: "india-defence",
    description:
      "Indian defence manufacturing, shipbuilding, and aerospace companies benefiting from Atmanirbhar Bharat and rising defence budgets.",
    drivers: "₹6.2L Cr defence budget, Make in India policy, export orders from friendly nations.",
    rationale:
      "India's defence indigenization push creates a multi-decade capex cycle for domestic manufacturers.",
  },
  {
    name: "Digital India & IT Services",
    slug: "india-digital",
    description:
      "Indian IT giants, digital platforms, and new-age tech companies powering India's digital transformation.",
    drivers: "UPI adoption, Digital Public Infrastructure (DPI), AI services exports.",
    rationale:
      "India's IT services sector is the world's largest outsourcing destination with expanding AI capabilities.",
  },
  {
    name: "Indian Semiconductors & Electronics",
    slug: "india-semiconductors",
    description:
      "Companies in India's semiconductor ecosystem — chip design, PCB manufacturing, EMS, and electronic components.",
    drivers: "India Semiconductor Mission (₹76,000 Cr), PLI scheme for electronics, fab construction.",
    rationale:
      "India positioning as a global semiconductor hub with Tata-PSMC, Micron, and Tower fabs under construction.",
  },
  {
    name: "Indian EV & Green Energy",
    slug: "india-ev-green",
    description:
      "Electric vehicle manufacturers, renewable energy producers, and green hydrogen companies in India.",
    drivers: "FAME III subsidies, 500 GW renewable target by 2030, National Green Hydrogen Mission.",
    rationale:
      "India's energy transition creates massive opportunities in solar, wind, EV, and green hydrogen value chains.",
  },
  {
    name: "Indian Pharma & Healthcare",
    slug: "india-pharma",
    description:
      "India's pharmaceutical giants, hospital chains, and diagnostic companies — the pharmacy of the world.",
    drivers: "Generic drug exports, biosimilar pipeline, Ayushman Bharat expansion, medical tourism.",
    rationale:
      "India supplies 20% of global generic medicines with expanding margins from complex generics and biosimilars.",
  },
  {
    name: "Indian Real Estate & Infrastructure",
    slug: "india-realty-infra",
    description:
      "Real estate developers, construction companies, and infrastructure builders driving India's urbanization.",
    drivers: "PM Gati Shakti, NIP ₹111L Cr pipeline, housing demand from rising middle class.",
    rationale:
      "India's infrastructure buildout (highways, railways, airports, smart cities) is a generational investment theme.",
  },
  {
    name: "Indian FMCG & Consumer",
    slug: "india-consumer",
    description:
      "Fast-moving consumer goods, retail, and consumer discretionary companies riding India's consumption story.",
    drivers: "Rising per-capita income, premiumization, rural penetration, quick commerce.",
    rationale:
      "India's 1.4B population with rising disposable income creates the world's fastest-growing consumer market.",
  },
  {
    name: "Indian Banking & Financial Services",
    slug: "india-bfsi",
    description:
      "Banks, NBFCs, insurance companies, and fintech platforms powering India's credit and savings growth.",
    drivers: "Credit penetration (70% → 100% of GDP), digital lending, insurance underpenetration.",
    rationale:
      "India's financial sector is in a structural upcycle with improving asset quality and digital distribution.",
  },
];

// Stock Mappings (At least 3 per sector)
const MAPPINGS = {
  ai: ["NVDA", "MSFT", "GOOGL", "PLTR", "AMD"],
  fintech: ["V", "MA", "PYPL", "COIN"],
  "clean-energy": ["TSLA", "ENPH", "FSLR", "NEE"],
  semiconductors: ["AVGO", "TSM", "QCOM", "INTC", "MU"],
  cybersecurity: ["PANW", "CRWD", "FTNT", "ZS", "OKTA"],
  blockchain: ["COIN", "MSTR", "MARA"],
  "cloud-computing": ["AMZN", "CRM", "NOW", "SNOW", "DDOG"],
  genomics: ["ILMN", "VRTX", "MRNA", "BNTX"],
  "space-tech": ["RKLB", "LMT", "BA", "NOC"],
  robotics: ["ISRG", "TER", "PATH", "DE", "CAT"],
  "digital-media": ["NFLX", "DIS", "EA", "TTWO", "GOOGL"],
  "electric-vehicles": ["TSLA", "RIVN", "LCID", "ON", "ALB"],

  // New Complete Mappings
  payments: ["V", "MA", "AXP", "DFS", "COF"],
  "e-commerce": ["AMZN", "BABA", "SHOP", "MELI", "JD"],
  "social-media": ["META", "SNAP", "PINS", "RDDT"],
  "gaming-esports": ["EA", "TTWO", "RBLX"],
  "batteries-storage": ["ALB", "SQM", "ENVX", "FLNC"],
  biotechnology: ["AMGN", "GILD", "REGN", "BIIB", "VRTX"],
  "5g-connectivity": ["TMUS", "VZ", "T", "NOK", "ERIC"],
  "quantum-computing": ["IBM", "GOOGL"],
  metaverse: ["META", "RBLX", "NVDA", "MSFT"],

  // India-Specific Sector Mappings
  "india-defence": ["HAL.NS", "BEL.NS", "MAZAGON.NS", "COCHINSHIP.NS", "BDL.NS", "GRSE.NS", "DATAPATTNS.NS"],
  "india-digital": ["TCS.NS", "INFY.NS", "HCLTECH.NS", "WIPRO.NS", "TECHM.NS", "LTIM.NS", "ZOMATO.NS", "NYKAA.NS", "PAYTM.NS", "POLICYBZR.NS"],
  "india-semiconductors": ["DIXON.NS", "KAYNES.NS", "TATAELXSI.NS", "COFORGE.NS", "PERSISTENT.NS", "HAPPSTMNDS.NS"],
  "india-ev-green": ["TATAMOTORS.NS", "TATAPOWER.NS", "ADANIGREEN.NS", "ADANIENSOL.NS", "NHPC.NS", "SJVN.NS", "TVSMOTOR.NS", "HEROMOTOCO.NS"],
  "india-pharma": ["SUNPHARMA.NS", "DRREDDY.NS", "CIPLA.NS", "DIVISLAB.NS", "LUPIN.NS", "BIOCON.NS", "AUROPHARMA.NS", "FORTIS.NS", "APOLLOHOSP.NS", "MAXHEALTH.NS"],
  "india-realty-infra": ["DLF.NS", "GODREJPROP.NS", "OBEROIRLTY.NS", "PRESTIGE.NS", "LODHA.NS", "LT.NS", "ADANIPORTS.NS", "IRB.NS", "RVNL.NS"],
  "india-consumer": ["HINDUNILVR.NS", "ITC.NS", "NESTLEIND.NS", "DABUR.NS", "MARICO.NS", "COLPAL.NS", "BRITANNIA.NS", "TRENT.NS", "JUBLFOOD.NS", "BATAINDIA.NS"],
  "india-bfsi": ["HDFCBANK.NS", "ICICIBANK.NS", "SBIN.NS", "KOTAKBANK.NS", "AXISBANK.NS", "BAJFINANCE.NS", "BAJAJFINSV.NS", "HDFCLIFE.NS", "SBILIFE.NS", "ICICIPRULI.NS", "CHOLAFIN.NS"],
};

// Asset Metadata (to ensure we have names)
const ASSET_NAMES: Record<string, string> = {
  NVDA: "NVIDIA Corp",
  MSFT: "Microsoft Corp",
  GOOGL: "Alphabet Inc",
  PLTR: "Palantir Technologies",
  AMD: "Advanced Micro Devices",
  V: "Visa Inc",
  MA: "Mastercard Inc",
  PYPL: "PayPal Holdings",
  COIN: "Coinbase Global",
  TSLA: "Tesla Inc",
  ENPH: "Enphase Energy",
  FSLR: "First Solar",
  NEE: "NextEra Energy",
  SEDG: "SolarEdge Technologies",
  AVGO: "Broadcom Inc",
  TSM: "Taiwan Semiconductor",
  QCOM: "Qualcomm Inc",
  INTC: "Intel Corp",
  MU: "Micron Technology",
  PANW: "Palo Alto Networks",
  CRWD: "CrowdStrike Holdings",
  FTNT: "Fortinet Inc",
  ZS: "Zscaler Inc",
  OKTA: "Okta Inc",
  MSTR: "MicroStrategy",
  AMZN: "Amazon.com",
  CRM: "Salesforce",
  NOW: "ServiceNow",
  SNOW: "Snowflake Inc",
  DDOG: "Datadog Inc",
  ILMN: "Illumina Inc",
  VRTX: "Vertex Pharmaceuticals",
  MRNA: "Moderna Inc",
  BNTX: "BioNTech SE",
  RKLB: "Rocket Lab USA",
  LMT: "Lockheed Martin",
  BA: "Boeing Co",
  NOC: "Northrop Grumman",
  PL: "Planet Labs",
  ISRG: "Intuitive Surgical",
  TER: "Teradyne Inc",
  PATH: "UiPath Inc",
  DE: "Deere & Company",
  CAT: "Caterpillar Inc",
  NFLX: "Netflix Inc",
  DIS: "Walt Disney Co",
  EA: "Electronic Arts",
  TTWO: "Take-Two Interactive",
  RIVN: "Rivian Automotive",
  LCID: "Lucid Group",
  ON: "ON Semiconductor",
  ALB: "Albemarle Corp",

  // New Metadata
  AXP: "American Express",
  DFS: "Discover Financial",
  COF: "Capital One",
  AFRM: "Affirm Holdings",
  UPST: "Upstart Holdings",
  BABA: "Alibaba Group",
  SHOP: "Shopify Inc",
  MELI: "MercadoLibre",
  JD: "JD.com",
  META: "Meta Platforms",
  SNAP: "Snap Inc",
  PINS: "Pinterest",
  RDDT: "Reddit Inc",
  MTCH: "Match Group",
  ATVI: "Activision Blizzard",
  RBLX: "Roblox Corp",
  NTDOY: "Nintendo Co",
  SQM: "Sociedad Quimica",
  QS: "QuantumScape",
  ENVX: "Enovix Corp",
  FLNC: "Fluence Energy",
  AMGN: "Amgen Inc",
  GILD: "Gilead Sciences",
  REGN: "Regeneron Pharma",
  BIIB: "Biogen Inc",
  TMUS: "T-Mobile US",
  VZ: "Verizon",
  T: "AT&T Inc",
  NOK: "Nokia Oyj",
  ERIC: "Ericsson",
  IONQ: "IonQ Inc",
  RGTI: "Rigetti Computing",
  QUBT: "Quantum Computing Inc",
  IBM: "IBM Corp",
  U: "Unity Software",
};

// Commodity Metadata (All 20)
const COMMODITY_NAMES: Record<string, string> = {
  "GC=F": "Gold Futures",
  "SI=F": "Silver Futures",
  "CL=F": "Crude Oil (WTI)",
  "NG=F": "Natural Gas",
  "BZ=F": "Brent Crude Oil",
  "HG=F": "Copper Futures",
  "PL=F": "Platinum Futures",
  "ZC=F": "Corn Futures",
  "ZS=F": "Soybean Futures",
  "ZW=F": "Wheat Futures",
  "CC=F": "Cocoa Futures",
  "CT=F": "Cotton Futures",
  "HE=F": "Lean Hog Futures",
  "HO=F": "Heating Oil Futures",
  "KC=F": "Coffee Futures",
  "LE=F": "Live Cattle Futures",
  "OJ=F": "Orange Juice Futures",
  "PA=F": "Palladium Futures",
  "RB=F": "RBOB Gasoline Futures",
  "SB=F": "Sugar Futures",
};

const COMMODITY_SYMBOLS = Object.keys(COMMODITY_NAMES);

// ETF Universe — 50 High-Quality US ETFs
const ETF_DATA: { symbol: string; name: string; category: string }[] = [
  // Broad Market (8)
  { symbol: "SPY", name: "SPDR S&P 500 ETF Trust", category: "Large Blend" },
  { symbol: "QQQ", name: "Invesco QQQ Trust", category: "Large Growth" },
  { symbol: "IWM", name: "iShares Russell 2000 ETF", category: "Small Blend" },
  { symbol: "DIA", name: "SPDR Dow Jones Industrial Average ETF", category: "Large Value" },
  { symbol: "VOO", name: "Vanguard S&P 500 ETF", category: "Large Blend" },
  { symbol: "VTI", name: "Vanguard Total Stock Market ETF", category: "Large Blend" },
  { symbol: "IVV", name: "iShares Core S&P 500 ETF", category: "Large Blend" },
  { symbol: "RSP", name: "Invesco S&P 500 Equal Weight ETF", category: "Large Blend" },
  // Sector (11)
  { symbol: "XLK", name: "Technology Select Sector SPDR", category: "Technology" },
  { symbol: "XLF", name: "Financial Select Sector SPDR", category: "Financial" },
  { symbol: "XLE", name: "Energy Select Sector SPDR", category: "Energy" },
  { symbol: "XLV", name: "Health Care Select Sector SPDR", category: "Health" },
  { symbol: "XLI", name: "Industrial Select Sector SPDR", category: "Industrials" },
  { symbol: "XLC", name: "Communication Services Select Sector SPDR", category: "Communication" },
  { symbol: "XLY", name: "Consumer Discretionary Select Sector SPDR", category: "Consumer Cyclical" },
  { symbol: "XLP", name: "Consumer Staples Select Sector SPDR", category: "Consumer Defensive" },
  { symbol: "XLU", name: "Utilities Select Sector SPDR", category: "Utilities" },
  { symbol: "XLRE", name: "Real Estate Select Sector SPDR", category: "Real Estate" },
  { symbol: "XLB", name: "Materials Select Sector SPDR", category: "Basic Materials" },
  // Fixed Income (7)
  { symbol: "TLT", name: "iShares 20+ Year Treasury Bond ETF", category: "Long Government" },
  { symbol: "BND", name: "Vanguard Total Bond Market ETF", category: "Intermediate Core Bond" },
  { symbol: "AGG", name: "iShares Core U.S. Aggregate Bond ETF", category: "Intermediate Core Bond" },
  { symbol: "HYG", name: "iShares iBoxx $ High Yield Corporate Bond ETF", category: "High Yield Bond" },
  { symbol: "LQD", name: "iShares iBoxx $ Investment Grade Corporate Bond ETF", category: "Corporate Bond" },
  { symbol: "TIP", name: "iShares TIPS Bond ETF", category: "Inflation-Protected Bond" },
  { symbol: "SHY", name: "iShares 1-3 Year Treasury Bond ETF", category: "Short Government" },
  // International (5)
  { symbol: "EFA", name: "iShares MSCI EAFE ETF", category: "Foreign Large Blend" },
  { symbol: "EEM", name: "iShares MSCI Emerging Markets ETF", category: "Diversified Emerging" },
  { symbol: "VWO", name: "Vanguard FTSE Emerging Markets ETF", category: "Diversified Emerging" },
  { symbol: "VXUS", name: "Vanguard Total International Stock ETF", category: "Foreign Large Blend" },
  { symbol: "INDA", name: "iShares MSCI India ETF", category: "India Equity" },
  // Thematic (8)
  { symbol: "ARKK", name: "ARK Innovation ETF", category: "Mid-Cap Growth" },
  { symbol: "ARKG", name: "ARK Genomic Revolution ETF", category: "Health" },
  { symbol: "BOTZ", name: "Global X Robotics & AI ETF", category: "Technology" },
  { symbol: "HACK", name: "ETFMG Prime Cyber Security ETF", category: "Technology" },
  { symbol: "ICLN", name: "iShares Global Clean Energy ETF", category: "Miscellaneous Sector" },
  { symbol: "TAN", name: "Invesco Solar ETF", category: "Miscellaneous Sector" },
  { symbol: "LIT", name: "Global X Lithium & Battery Tech ETF", category: "Miscellaneous Sector" },
  { symbol: "KWEB", name: "KraneShares CSI China Internet ETF", category: "China Region" },
  // Commodity-Backed (5)
  { symbol: "GLD", name: "SPDR Gold Shares", category: "Commodities Precious Metals" },
  { symbol: "SLV", name: "iShares Silver Trust", category: "Commodities Precious Metals" },
  { symbol: "USO", name: "United States Oil Fund", category: "Commodities Energy" },
  { symbol: "UNG", name: "United States Natural Gas Fund", category: "Commodities Energy" },
  { symbol: "DBA", name: "Invesco DB Agriculture Fund", category: "Commodities Agriculture" },
  // Volatility & Leverage (3)
  { symbol: "SQQQ", name: "ProShares UltraPro Short QQQ", category: "Trading--Inverse Equity" },
  { symbol: "TQQQ", name: "ProShares UltraPro QQQ", category: "Trading--Leveraged Equity" },
  { symbol: "UVXY", name: "ProShares Ultra VIX Short-Term Futures ETF", category: "Trading--Miscellaneous" },
  // Dividend & Income (4)
  { symbol: "VYM", name: "Vanguard High Dividend Yield ETF", category: "Large Value" },
  { symbol: "SCHD", name: "Schwab U.S. Dividend Equity ETF", category: "Large Value" },
  { symbol: "DVY", name: "iShares Select Dividend ETF", category: "Mid-Cap Value" },
  { symbol: "HDV", name: "iShares Core High Dividend ETF", category: "Large Value" },
];


async function main() {
  console.log("🌱 Seeding Discovery Universe...");

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

    // 2. Map Stocks
    const symbols = MAPPINGS[sector.slug as keyof typeof MAPPINGS];
    if (symbols) {
      for (const symbol of symbols) {
        // Ensure Asset Exists
        const asset = await prisma.asset.upsert({
          where: { symbol },
          update: {
            region: "US",
             lastPriceUpdate: new Date(),
             price: Math.floor(Math.random() * 500) + 50,
             changePercent: (Math.random() * 6) - 3,
             avgTrendScore: 75,
             avgMomentumScore: 80,
             avgVolatilityScore: 30,
             avgLiquidityScore: 95,
             compatibilityScore: 88,
             compatibilityLabel: "Regime Aligned",
             assetGroup: "Regime-Aligned",
          },
          create: {
            symbol,
            name: ASSET_NAMES[symbol] || symbol,
            type: AssetType.STOCK,
            region: "US",
            sector: sector.name,
            lastPriceUpdate: new Date(),
            price: Math.floor(Math.random() * 500) + 50,
            changePercent: (Math.random() * 6) - 3,
            avgTrendScore: 75,
            avgMomentumScore: 80,
            avgVolatilityScore: 30,
            avgLiquidityScore: 95,
            compatibilityScore: 88,
            compatibilityLabel: "Regime Aligned",
            assetGroup: "Regime-Aligned",
          },
        });

        // Create Mapping
        await prisma.stockSector.upsert({
          where: {
            assetId_sectorId: {
              assetId: asset.id,
              sectorId: dbSector.id,
            },
          },
          update: {
            isActive: true,
            inclusionType: InclusionType.CORE_BUSINESS,
            eligibilityScore: symbol === "AMD" || symbol === "PLTR" || symbol === "COIN" || symbol === "RDDT" ? 65 : 95,
          },
          create: {
            assetId: asset.id,
            sectorId: dbSector.id,
            isActive: true,
            inclusionType: InclusionType.CORE_BUSINESS,
            eligibilityScore: symbol === "AMD" || symbol === "PLTR" || symbol === "COIN" || symbol === "RDDT" ? 65 : 95,
            inclusionReason: `Core holding in ${sector.name} theme.`,
          },
        });
      }
    }
  }

  // Seed Commodities (10 Key Benchmarks)
  console.log("🌾 Seeding Commodities...");
  for (const symbol of COMMODITY_SYMBOLS) {
    await prisma.asset.upsert({
      where: { symbol },
      update: {},
      create: {
        symbol,
        name: COMMODITY_NAMES[symbol],
        type: AssetType.COMMODITY,
        region: "US",
        sector: "Commodities",
      },
    });
  }
  console.log("✅ Commodities Seeded Successfully.");

  // Seed ETFs (50 High-Quality US ETFs)
  console.log("📊 Seeding ETFs...");
  for (const etf of ETF_DATA) {
    await prisma.asset.upsert({
      where: { symbol: etf.symbol },
      update: {
        type: AssetType.ETF,
        region: "US",
        category: etf.category,
      },
      create: {
        symbol: etf.symbol,
        name: etf.name,
        type: AssetType.ETF,
        region: "US",
        category: etf.category,
        sector: etf.category,
        lastPriceUpdate: new Date(),
        price: Math.floor(Math.random() * 400) + 20,
        changePercent: (Math.random() * 4) - 2,
        avgTrendScore: 70,
        avgMomentumScore: 65,
        avgVolatilityScore: 35,
        avgLiquidityScore: 90,
        compatibilityScore: 85,
        compatibilityLabel: "Regime Aligned",
        assetGroup: "ETF Universe",
      },
    });
  }
  console.log("✅ ETFs Seeded Successfully.");

  // Seed Indian Assets for E2E
  console.log("🇮🇳 Seeding Indian Assets...");
  interface IndianAssetSeed {
    symbol: string;
    name: string;
    type: AssetType;
    region: string;
    currency: string;
    nav?: number | null;
  }

  const INDIAN_ASSETS: IndianAssetSeed[] = [
    // ── Stocks (96) ──
    { symbol: "ABB.NS", name: "ABB India Limited", type: AssetType.STOCK, region: "IN", currency: "INR" },
    { symbol: "ACC.NS", name: "ACC Limited", type: AssetType.STOCK, region: "IN", currency: "INR" },
    { symbol: "ADANIENSOL.NS", name: "Adani Energy Solutions Limited", type: AssetType.STOCK, region: "IN", currency: "INR" },
    { symbol: "ADANIENT.NS", name: "Adani Enterprises Limited", type: AssetType.STOCK, region: "IN", currency: "INR" },
    { symbol: "ADANIGREEN.NS", name: "Adani Green Energy Limited", type: AssetType.STOCK, region: "IN", currency: "INR" },
    { symbol: "ADANIPORTS.NS", name: "Adani Ports and Special Economic Zone Limited", type: AssetType.STOCK, region: "IN", currency: "INR" },
    { symbol: "ATGL.NS", name: "Adani Total Gas Limited", type: AssetType.STOCK, region: "IN", currency: "INR" },
    { symbol: "AMBUJACEM.NS", name: "Ambuja Cements Limited", type: AssetType.STOCK, region: "IN", currency: "INR" },
    { symbol: "APOLLOHOSP.NS", name: "Apollo Hospitals Enterprise Limited", type: AssetType.STOCK, region: "IN", currency: "INR" },
    { symbol: "ASIANPAINT.NS", name: "Asian Paints Limited", type: AssetType.STOCK, region: "IN", currency: "INR" },
    { symbol: "DMART.NS", name: "Avenue Supermarts Limited", type: AssetType.STOCK, region: "IN", currency: "INR" },
    { symbol: "AXISBANK.NS", name: "Axis Bank Limited", type: AssetType.STOCK, region: "IN", currency: "INR" },
    { symbol: "BAJAJ-AUTO.NS", name: "Bajaj Auto Limited", type: AssetType.STOCK, region: "IN", currency: "INR" },
    { symbol: "BAJFINANCE.NS", name: "Bajaj Finance Limited", type: AssetType.STOCK, region: "IN", currency: "INR" },
    { symbol: "BERGEPAINT.NS", name: "Berger Paints India Limited", type: AssetType.STOCK, region: "IN", currency: "INR" },
    { symbol: "BEL.NS", name: "Bharat Electronics Limited", type: AssetType.STOCK, region: "IN", currency: "INR" },
    { symbol: "BPCL.NS", name: "Bharat Petroleum Corporation Limited", type: AssetType.STOCK, region: "IN", currency: "INR" },
    { symbol: "BHARTIARTL.NS", name: "Bharti Airtel Limited", type: AssetType.STOCK, region: "IN", currency: "INR" },
    { symbol: "BOSCHLTD.NS", name: "Bosch Limited", type: AssetType.STOCK, region: "IN", currency: "INR" },
    { symbol: "BRITANNIA.NS", name: "Britannia Industries Limited", type: AssetType.STOCK, region: "IN", currency: "INR" },
    { symbol: "CHOLAFIN.NS", name: "Cholamandalam Investment and Finance Company Limited", type: AssetType.STOCK, region: "IN", currency: "INR" },
    { symbol: "CIPLA.NS", name: "Cipla Limited", type: AssetType.STOCK, region: "IN", currency: "INR" },
    { symbol: "COALINDIA.NS", name: "Coal India Limited", type: AssetType.STOCK, region: "IN", currency: "INR" },
    { symbol: "COLPAL.NS", name: "Colgate-Palmolive (India) Limited", type: AssetType.STOCK, region: "IN", currency: "INR" },
    { symbol: "CONCOR.NS", name: "Container Corporation of India Limited", type: AssetType.STOCK, region: "IN", currency: "INR" },
    { symbol: "DABUR.NS", name: "Dabur India Limited", type: AssetType.STOCK, region: "IN", currency: "INR" },
    { symbol: "DIVISLAB.NS", name: "Divi's Laboratories Limited", type: AssetType.STOCK, region: "IN", currency: "INR" },
    { symbol: "DLF.NS", name: "DLF Limited", type: AssetType.STOCK, region: "IN", currency: "INR" },
    { symbol: "DRREDDY.NS", name: "Dr. Reddy's Laboratories Limited", type: AssetType.STOCK, region: "IN", currency: "INR" },
    { symbol: "EICHERMOT.NS", name: "Eicher Motors Limited", type: AssetType.STOCK, region: "IN", currency: "INR" },
    { symbol: "GAIL.NS", name: "GAIL (India) Limited", type: AssetType.STOCK, region: "IN", currency: "INR" },
    { symbol: "GODREJCP.NS", name: "Godrej Consumer Products Limited", type: AssetType.STOCK, region: "IN", currency: "INR" },
    { symbol: "GODREJPROP.NS", name: "Godrej Properties Limited", type: AssetType.STOCK, region: "IN", currency: "INR" },
    { symbol: "GRASIM.NS", name: "Grasim Industries Limited", type: AssetType.STOCK, region: "IN", currency: "INR" },
    { symbol: "HAVELLS.NS", name: "Havells India Limited", type: AssetType.STOCK, region: "IN", currency: "INR" },
    { symbol: "HCLTECH.NS", name: "HCL Technologies Limited", type: AssetType.STOCK, region: "IN", currency: "INR" },
    { symbol: "HDFCAMC.NS", name: "HDFC Asset Management Company Limited", type: AssetType.STOCK, region: "IN", currency: "INR" },
    { symbol: "HDFCBANK.NS", name: "HDFC Bank Limited", type: AssetType.STOCK, region: "IN", currency: "INR" },
    { symbol: "HDFCLIFE.NS", name: "HDFC Life Insurance Company Limited", type: AssetType.STOCK, region: "IN", currency: "INR" },
    { symbol: "HINDALCO.NS", name: "Hindalco Industries Limited", type: AssetType.STOCK, region: "IN", currency: "INR" },
    { symbol: "HAL.NS", name: "Hindustan Aeronautics Limited", type: AssetType.STOCK, region: "IN", currency: "INR" },
    { symbol: "HINDUNILVR.NS", name: "Hindustan Unilever Limited", type: AssetType.STOCK, region: "IN", currency: "INR" },
    { symbol: "HINDZINC.NS", name: "Hindustan Zinc Limited", type: AssetType.STOCK, region: "IN", currency: "INR" },
    { symbol: "ICICIBANK.NS", name: "ICICI Bank Limited", type: AssetType.STOCK, region: "IN", currency: "INR" },
    { symbol: "ICICIPRULI.NS", name: "ICICI Prudential Life Insurance Company Limited", type: AssetType.STOCK, region: "IN", currency: "INR" },
    { symbol: "IOC.NS", name: "Indian Oil Corporation Limited", type: AssetType.STOCK, region: "IN", currency: "INR" },
    { symbol: "IRCTC.NS", name: "Indian Railway Catering & Tourism Corporation Limited", type: AssetType.STOCK, region: "IN", currency: "INR" },
    { symbol: "IRFC.NS", name: "Indian Railway Finance Corporation Limited", type: AssetType.STOCK, region: "IN", currency: "INR" },
    { symbol: "NAUKRI.NS", name: "Info Edge (India) Limited", type: AssetType.STOCK, region: "IN", currency: "INR" },
    { symbol: "INFY.NS", name: "Infosys Limited", type: AssetType.STOCK, region: "IN", currency: "INR" },
    { symbol: "INDIGO.NS", name: "InterGlobe Aviation Limited", type: AssetType.STOCK, region: "IN", currency: "INR" },
    { symbol: "ITC.NS", name: "ITC Limited", type: AssetType.STOCK, region: "IN", currency: "INR" },
    { symbol: "JINDALSTEL.NS", name: "Jindal Steel Limited", type: AssetType.STOCK, region: "IN", currency: "INR" },
    { symbol: "JIOFIN.NS", name: "Jio Financial Services Limited", type: AssetType.STOCK, region: "IN", currency: "INR" },
    { symbol: "JSWSTEEL.NS", name: "JSW Steel Limited", type: AssetType.STOCK, region: "IN", currency: "INR" },
    { symbol: "KOTAKBANK.NS", name: "Kotak Mahindra Bank Limited", type: AssetType.STOCK, region: "IN", currency: "INR" },
    { symbol: "LT.NS", name: "Larsen & Toubro Limited", type: AssetType.STOCK, region: "IN", currency: "INR" },
    { symbol: "LTIM.NS", name: "LTIMindtree Limited", type: AssetType.STOCK, region: "IN", currency: "INR" },
    { symbol: "LUPIN.NS", name: "Lupin Limited", type: AssetType.STOCK, region: "IN", currency: "INR" },
    { symbol: "M&M.NS", name: "Mahindra & Mahindra Limited", type: AssetType.STOCK, region: "IN", currency: "INR" },
    { symbol: "MARUTI.NS", name: "Maruti Suzuki India Limited", type: AssetType.STOCK, region: "IN", currency: "INR" },
    { symbol: "MAXHEALTH.NS", name: "Max Healthcare Institute Limited", type: AssetType.STOCK, region: "IN", currency: "INR" },
    { symbol: "NESTLEIND.NS", name: "Nestle India Limited", type: AssetType.STOCK, region: "IN", currency: "INR" },
    { symbol: "NTPC.NS", name: "NTPC Limited", type: AssetType.STOCK, region: "IN", currency: "INR" },
    { symbol: "ONGC.NS", name: "Oil and Natural Gas Corporation Limited", type: AssetType.STOCK, region: "IN", currency: "INR" },
    { symbol: "PAGEIND.NS", name: "Page Industries Limited", type: AssetType.STOCK, region: "IN", currency: "INR" },
    { symbol: "PIIND.NS", name: "PI Industries Limited", type: AssetType.STOCK, region: "IN", currency: "INR" },
    { symbol: "PFC.NS", name: "Power Finance Corporation Limited", type: AssetType.STOCK, region: "IN", currency: "INR" },
    { symbol: "POWERGRID.NS", name: "Power Grid Corporation of India Limited", type: AssetType.STOCK, region: "IN", currency: "INR" },
    { symbol: "RECLTD.NS", name: "REC Limited", type: AssetType.STOCK, region: "IN", currency: "INR" },
    { symbol: "RELIANCE.NS", name: "Reliance Industries Limited", type: AssetType.STOCK, region: "IN", currency: "INR" },
    { symbol: "MOTHERSON.NS", name: "Samvardhana Motherson International Limited", type: AssetType.STOCK, region: "IN", currency: "INR" },
    { symbol: "SBILIFE.NS", name: "SBI Life Insurance Company Limited", type: AssetType.STOCK, region: "IN", currency: "INR" },
    { symbol: "SHREECEM.NS", name: "Shree Cement Limited", type: AssetType.STOCK, region: "IN", currency: "INR" },
    { symbol: "SHRIRAMFIN.NS", name: "Shriram Finance Limited", type: AssetType.STOCK, region: "IN", currency: "INR" },
    { symbol: "SIEMENS.NS", name: "Siemens Limited", type: AssetType.STOCK, region: "IN", currency: "INR" },
    { symbol: "SRF.NS", name: "SRF Limited", type: AssetType.STOCK, region: "IN", currency: "INR" },
    { symbol: "SBIN.NS", name: "State Bank of India", type: AssetType.STOCK, region: "IN", currency: "INR" },
    { symbol: "SUNPHARMA.NS", name: "Sun Pharmaceutical Industries Limited", type: AssetType.STOCK, region: "IN", currency: "INR" },
    { symbol: "TATACOMM.NS", name: "Tata Communications Limited", type: AssetType.STOCK, region: "IN", currency: "INR" },
    { symbol: "TCS.NS", name: "Tata Consultancy Services Limited", type: AssetType.STOCK, region: "IN", currency: "INR" },
    { symbol: "TATACONSUM.NS", name: "Tata Consumer Products Limited", type: AssetType.STOCK, region: "IN", currency: "INR" },
    { symbol: "TATASTEEL.NS", name: "Tata Steel Limited", type: AssetType.STOCK, region: "IN", currency: "INR" },
    { symbol: "TECHM.NS", name: "Tech Mahindra Limited", type: AssetType.STOCK, region: "IN", currency: "INR" },
    { symbol: "RAMCOCEM.NS", name: "The Ramco Cements Limited", type: AssetType.STOCK, region: "IN", currency: "INR" },
    { symbol: "TITAN.NS", name: "Titan Company Limited", type: AssetType.STOCK, region: "IN", currency: "INR" },
    { symbol: "TORNTPHARM.NS", name: "Torrent Pharmaceuticals Limited", type: AssetType.STOCK, region: "IN", currency: "INR" },
    { symbol: "TRENT.NS", name: "Trent Limited", type: AssetType.STOCK, region: "IN", currency: "INR" },
    { symbol: "TIINDIA.NS", name: "Tube Investments of India Limited", type: AssetType.STOCK, region: "IN", currency: "INR" },
    { symbol: "ULTRACEMCO.NS", name: "UltraTech Cement Limited", type: AssetType.STOCK, region: "IN", currency: "INR" },
    { symbol: "UNITDSPR.NS", name: "United Spirits Limited", type: AssetType.STOCK, region: "IN", currency: "INR" },
    { symbol: "VBL.NS", name: "Varun Beverages Limited", type: AssetType.STOCK, region: "IN", currency: "INR" },
    { symbol: "VEDL.NS", name: "Vedanta Limited", type: AssetType.STOCK, region: "IN", currency: "INR" },
    { symbol: "WIPRO.NS", name: "Wipro Limited", type: AssetType.STOCK, region: "IN", currency: "INR" },
    { symbol: "ZYDUSLIFE.NS", name: "Zydus Lifesciences Limited", type: AssetType.STOCK, region: "IN", currency: "INR" },
    // ── Mutual Funds (35) ──
    { symbol: "MF-103135", name: "Aditya Birla Sun Life Frontline Equity Fund - Growth", type: AssetType.MUTUAL_FUND, region: "IN", currency: "INR" },
    { symbol: "MF-139000", name: "Axis Flexi Cap Fund - Growth", type: AssetType.MUTUAL_FUND, region: "IN", currency: "INR" },
    { symbol: "MF-122000", name: "Bank of India Large Cap Fund - Growth", type: AssetType.MUTUAL_FUND, region: "IN", currency: "INR" },
    { symbol: "MF-120468", name: "Canara Robeco Bluechip Equity Fund - Growth", type: AssetType.MUTUAL_FUND, region: "IN", currency: "INR" },
    { symbol: "MF-142000", name: "Canara Robeco Flexi Cap Fund - Growth", type: AssetType.MUTUAL_FUND, region: "IN", currency: "INR" },
    { symbol: "MF-143000", name: "DSP Flexi Cap Fund - Growth", type: AssetType.MUTUAL_FUND, region: "IN", currency: "INR" },
    { symbol: "MF-118000", name: "Edelweiss Large Cap Fund - Growth", type: AssetType.MUTUAL_FUND, region: "IN", currency: "INR" },
    { symbol: "MF-112000", name: "Franklin India Bluechip Fund - Growth", type: AssetType.MUTUAL_FUND, region: "IN", currency: "INR" },
    { symbol: "MF-144000", name: "Franklin India Flexi Cap Fund - Growth", type: AssetType.MUTUAL_FUND, region: "IN", currency: "INR" },
    { symbol: "MF-136000", name: "HDFC Flexi Cap Fund - Growth", type: AssetType.MUTUAL_FUND, region: "IN", currency: "INR" },
    { symbol: "MF-148000", name: "HDFC Index Fund Nifty 50 Plan - Growth", type: AssetType.MUTUAL_FUND, region: "IN", currency: "INR" },
    { symbol: "MF-102594", name: "HDFC Top 100 Fund - Growth", type: AssetType.MUTUAL_FUND, region: "IN", currency: "INR" },
    { symbol: "MF-119000", name: "HSBC Large Cap Fund - Growth", type: AssetType.MUTUAL_FUND, region: "IN", currency: "INR" },
    { symbol: "MF-149000", name: "ICICI Prudential Nifty 50 Index Fund - Growth", type: AssetType.MUTUAL_FUND, region: "IN", currency: "INR" },
    { symbol: "MF-129000", name: "JM Large Cap Fund - Growth", type: AssetType.MUTUAL_FUND, region: "IN", currency: "INR" },
    { symbol: "MF-100234", name: "Kotak Bluechip Fund - Growth", type: AssetType.MUTUAL_FUND, region: "IN", currency: "INR" },
    { symbol: "MF-115000", name: "L&T India Large Cap Fund - Growth", type: AssetType.MUTUAL_FUND, region: "IN", currency: "INR" },
    { symbol: "MF-141000", name: "Mirae Asset Flexi Cap Fund - Growth", type: AssetType.MUTUAL_FUND, region: "IN", currency: "INR" },
    { symbol: "MF-118834", name: "Mirae Asset Large Cap Fund - Growth", type: AssetType.MUTUAL_FUND, region: "IN", currency: "INR" },
    { symbol: "MF-125000", name: "Motilal Oswal Large Cap Fund - Growth", type: AssetType.MUTUAL_FUND, region: "IN", currency: "INR" },
    { symbol: "MF-146000", name: "Motilal Oswal Nasdaq 100 ETF - Growth", type: AssetType.MUTUAL_FUND, region: "IN", currency: "INR" },
    { symbol: "MF-200000", name: "Nifty 50 Index Fund - Growth", type: AssetType.MUTUAL_FUND, region: "IN", currency: "INR" },
    { symbol: "MF-140000", name: "Nippon India Flexi Cap Fund - Growth", type: AssetType.MUTUAL_FUND, region: "IN", currency: "INR" },
    { symbol: "MF-134000", name: "Parag Parikh Flexi Cap Fund - Growth", type: AssetType.MUTUAL_FUND, region: "IN", currency: "INR" },
    { symbol: "MF-133000", name: "PPFAS Flexi Cap Fund - Growth", type: AssetType.MUTUAL_FUND, region: "IN", currency: "INR" },
    { symbol: "MF-120000", name: "Principal Large Cap Fund - Growth", type: AssetType.MUTUAL_FUND, region: "IN", currency: "INR" },
    { symbol: "MF-127000", name: "Quant Large Cap Fund - Growth", type: AssetType.MUTUAL_FUND, region: "IN", currency: "INR" },
    { symbol: "MF-102885", name: "SBI Bluechip Fund - Growth", type: AssetType.MUTUAL_FUND, region: "IN", currency: "INR" },
    { symbol: "MF-135000", name: "SBI Flexi Cap Fund - Growth", type: AssetType.MUTUAL_FUND, region: "IN", currency: "INR" },
    { symbol: "MF-147000", name: "SBI Nifty Index Fund - Growth", type: AssetType.MUTUAL_FUND, region: "IN", currency: "INR" },
    { symbol: "MF-116000", name: "Tata Large Cap Fund - Growth", type: AssetType.MUTUAL_FUND, region: "IN", currency: "INR" },
    { symbol: "MF-128000", name: "Taurus Largecap Equity Fund - Growth", type: AssetType.MUTUAL_FUND, region: "IN", currency: "INR" },
    { symbol: "MF-117000", name: "Union Largecap Fund - Growth", type: AssetType.MUTUAL_FUND, region: "IN", currency: "INR" },
    { symbol: "MF-145000", name: "UTI Flexi Cap Fund - Growth", type: AssetType.MUTUAL_FUND, region: "IN", currency: "INR" },
    { symbol: "MF-100523", name: "UTI Mastershare Unit Scheme - Growth", type: AssetType.MUTUAL_FUND, region: "IN", currency: "INR" },
    // ── ETFs (6) ──
    { symbol: "NIFTYBEES.NS", name: "Nippon India ETF Nifty 50 BeES", type: AssetType.ETF, region: "IN", currency: "INR" },
    { symbol: "SENSEXBEES.NS", name: "Mirae Asset BSE Sensex ETF", type: AssetType.ETF, region: "IN", currency: "INR" },
    { symbol: "JUNIORBEES.NS", name: "Nippon India ETF Nifty Next 50 Junior BeES", type: AssetType.ETF, region: "IN", currency: "INR" },
    { symbol: "BANKBEES.NS", name: "Nippon India ETF Bank BeES", type: AssetType.ETF, region: "IN", currency: "INR" },
    { symbol: "GOLDBEES.NS", name: "Nippon India ETF Gold BeES", type: AssetType.ETF, region: "IN", currency: "INR" },
    { symbol: "ICICIB22.NS", name: "ICICI Prudential BSE Sensex ETF", type: AssetType.ETF, region: "IN", currency: "INR" },
  ];

  for (const asset of INDIAN_ASSETS) {
    const isETF = asset.type === AssetType.ETF;
    const defaultPrice = isETF ? Math.floor(Math.random() * 300) + 200 : (asset.nav || Math.floor(Math.random() * 5000) + 100);
    const category = isETF ? "Indian Index ETF" : undefined;
    const sector = isETF ? "Indian Index ETF" : undefined;
    const assetGroup = isETF ? "ETF Universe" : "Market Leaders";

    await prisma.asset.upsert({
      where: { symbol: asset.symbol },
      update: {
        region: "IN",
        type: asset.type,
        nav: asset.nav || null,
        currency: "INR",
        price: defaultPrice,
        changePercent: (Math.random() * 4) - 2,
        lastPriceUpdate: new Date(),
        avgTrendScore: 85,
        avgMomentumScore: 70,
        avgVolatilityScore: 40,
        avgLiquidityScore: 90,
        compatibilityScore: 92,
        compatibilityLabel: "Strong Alignment",
        assetGroup,
        ...(category && { category }),
        ...(sector && { sector }),
      },
      create: {
        symbol: asset.symbol,
        name: asset.name,
        type: asset.type,
        region: "IN",
        currency: "INR",
        nav: asset.nav || null,
        price: defaultPrice,
        changePercent: (Math.random() * 4) - 2,
        lastPriceUpdate: new Date(),
        avgTrendScore: 85,
        avgMomentumScore: 70,
        avgVolatilityScore: 40,
        avgLiquidityScore: 90,
        compatibilityScore: 92,
        compatibilityLabel: "Strong Alignment",
        assetGroup,
        ...(category && { category }),
        ...(sector && { sector }),
      },
    });
  }
  console.log("✅ Indian Assets Seeded Successfully.");

  // Seed Lyra Trending Questions
  try {
    const { seedTrendingQuestions } = await import("./seed-questions");
    await seedTrendingQuestions();
  } catch (e) {
    console.error("Failed to seed Lyra Trending Questions:", e);
  }

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
