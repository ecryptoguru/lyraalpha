
import { prisma } from "../src/lib/prisma";
import { createLogger } from "../src/lib/logger";

// const prisma = new PrismaClient(); // Don't use new instance
const logger = createLogger({ service: "reset-db" });

// Baseline Asset List (~130 Assets)
const BASELINE_ASSETS = [
  // --- ETFs (50 — Broad, Sector, Fixed Income, Intl, Thematic, Commodity-Backed, Leverage, Dividend) ---
  { symbol: "SPY", name: "SPDR S&P 500 ETF Trust", type: "ETF" },
  { symbol: "QQQ", name: "Invesco QQQ Trust", type: "ETF" },
  { symbol: "IWM", name: "iShares Russell 2000 ETF", type: "ETF" },
  { symbol: "DIA", name: "SPDR Dow Jones Industrial Average ETF", type: "ETF" },
  { symbol: "VOO", name: "Vanguard S&P 500 ETF", type: "ETF" },
  { symbol: "VTI", name: "Vanguard Total Stock Market ETF", type: "ETF" },
  { symbol: "IVV", name: "iShares Core S&P 500 ETF", type: "ETF" },
  { symbol: "RSP", name: "Invesco S&P 500 Equal Weight ETF", type: "ETF" },
  { symbol: "XLK", name: "Technology Select Sector SPDR", type: "ETF" },
  { symbol: "XLF", name: "Financial Select Sector SPDR", type: "ETF" },
  { symbol: "XLE", name: "Energy Select Sector SPDR", type: "ETF" },
  { symbol: "XLV", name: "Health Care Select Sector SPDR", type: "ETF" },
  { symbol: "XLI", name: "Industrial Select Sector SPDR", type: "ETF" },
  { symbol: "XLC", name: "Communication Services Select Sector SPDR", type: "ETF" },
  { symbol: "XLY", name: "Consumer Discretionary Select Sector SPDR", type: "ETF" },
  { symbol: "XLP", name: "Consumer Staples Select Sector SPDR", type: "ETF" },
  { symbol: "XLU", name: "Utilities Select Sector SPDR", type: "ETF" },
  { symbol: "XLRE", name: "Real Estate Select Sector SPDR", type: "ETF" },
  { symbol: "XLB", name: "Materials Select Sector SPDR", type: "ETF" },
  { symbol: "TLT", name: "iShares 20+ Year Treasury Bond ETF", type: "ETF" },
  { symbol: "BND", name: "Vanguard Total Bond Market ETF", type: "ETF" },
  { symbol: "AGG", name: "iShares Core U.S. Aggregate Bond ETF", type: "ETF" },
  { symbol: "HYG", name: "iShares iBoxx $ High Yield Corporate Bond ETF", type: "ETF" },
  { symbol: "LQD", name: "iShares iBoxx $ Investment Grade Corporate Bond ETF", type: "ETF" },
  { symbol: "TIP", name: "iShares TIPS Bond ETF", type: "ETF" },
  { symbol: "SHY", name: "iShares 1-3 Year Treasury Bond ETF", type: "ETF" },
  { symbol: "EFA", name: "iShares MSCI EAFE ETF", type: "ETF" },
  { symbol: "EEM", name: "iShares MSCI Emerging Markets ETF", type: "ETF" },
  { symbol: "VWO", name: "Vanguard FTSE Emerging Markets ETF", type: "ETF" },
  { symbol: "VXUS", name: "Vanguard Total International Stock ETF", type: "ETF" },
  { symbol: "INDA", name: "iShares MSCI India ETF", type: "ETF" },
  { symbol: "ARKK", name: "ARK Innovation ETF", type: "ETF" },
  { symbol: "ARKG", name: "ARK Genomic Revolution ETF", type: "ETF" },
  { symbol: "BOTZ", name: "Global X Robotics & AI ETF", type: "ETF" },
  { symbol: "HACK", name: "ETFMG Prime Cyber Security ETF", type: "ETF" },
  { symbol: "ICLN", name: "iShares Global Clean Energy ETF", type: "ETF" },
  { symbol: "TAN", name: "Invesco Solar ETF", type: "ETF" },
  { symbol: "LIT", name: "Global X Lithium & Battery Tech ETF", type: "ETF" },
  { symbol: "KWEB", name: "KraneShares CSI China Internet ETF", type: "ETF" },
  { symbol: "GLD", name: "SPDR Gold Shares", type: "ETF" },
  { symbol: "SLV", name: "iShares Silver Trust", type: "ETF" },
  { symbol: "USO", name: "United States Oil Fund", type: "ETF" },
  { symbol: "UNG", name: "United States Natural Gas Fund", type: "ETF" },
  { symbol: "DBA", name: "Invesco DB Agriculture Fund", type: "ETF" },
  { symbol: "SQQQ", name: "ProShares UltraPro Short QQQ", type: "ETF" },
  { symbol: "TQQQ", name: "ProShares UltraPro QQQ", type: "ETF" },
  { symbol: "UVXY", name: "ProShares Ultra VIX Short-Term Futures ETF", type: "ETF" },
  { symbol: "VYM", name: "Vanguard High Dividend Yield ETF", type: "ETF" },
  { symbol: "SCHD", name: "Schwab U.S. Dividend Equity ETF", type: "ETF" },
  { symbol: "DVY", name: "iShares Select Dividend ETF", type: "ETF" },
  { symbol: "HDV", name: "iShares Core High Dividend ETF", type: "ETF" },

  // --- MEGA CAP TECH (MAG 7+) ---
  { symbol: "AAPL", name: "Apple Inc.", type: "STOCK" },
  { symbol: "MSFT", name: "Microsoft Corporation", type: "STOCK" },
  { symbol: "GOOGL", name: "Alphabet Inc.", type: "STOCK" },
  { symbol: "AMZN", name: "Amazon.com Inc.", type: "STOCK" },
  { symbol: "NVDA", name: "NVIDIA Corporation", type: "STOCK" },
  { symbol: "TSLA", name: "Tesla Inc.", type: "STOCK" },
  { symbol: "META", name: "Meta Platforms Inc.", type: "STOCK" },
  { symbol: "NFLX", name: "Netflix Inc.", type: "STOCK" },
  { symbol: "AMD", name: "Advanced Micro Devices Inc.", type: "STOCK" },
  { symbol: "AVGO", name: "Broadcom Inc.", type: "STOCK" },

  // --- KEY BENCHMARK STOCKS ---
  { symbol: "JPM", name: "JPMorgan Chase & Co.", type: "STOCK" },
  { symbol: "BAC", name: "Bank of America Corp", type: "STOCK" },
  { symbol: "V", name: "Visa Inc.", type: "STOCK" },
  { symbol: "MA", name: "Mastercard Inc.", type: "STOCK" },
  { symbol: "WMT", name: "Walmart Inc.", type: "STOCK" },
  { symbol: "PG", name: "Procter & Gamble Co.", type: "STOCK" },
  { symbol: "JNJ", name: "Johnson & Johnson", type: "STOCK" },
  { symbol: "UNH", name: "UnitedHealth Group Inc.", type: "STOCK" },
  { symbol: "LLY", name: "Eli Lilly and Company", type: "STOCK" },
  { symbol: "XOM", name: "Exxon Mobil Corporation", type: "STOCK" },
  { symbol: "CVX", name: "Chevron Corporation", type: "STOCK" },
  { symbol: "HD", name: "The Home Depot Inc.", type: "STOCK" },
  { symbol: "COST", name: "Costco Wholesale Corporation", type: "STOCK" },
  { symbol: "KO", name: "The Coca-Cola Company", type: "STOCK" },
  { symbol: "PEP", name: "PepsiCo Inc.", type: "STOCK" },
  { symbol: "DIS", name: "The Walt Disney Company", type: "STOCK" },
  { symbol: "MCD", name: "McDonald's Corporation", type: "STOCK" },
  { symbol: "NKE", name: "NIKE Inc.", type: "STOCK" },
  { symbol: "BA", name: "The Boeing Company", type: "STOCK" },
  { symbol: "CAT", name: "Caterpillar Inc.", type: "STOCK" },
  { symbol: "DE", name: "Deere & Company", type: "STOCK" },
  { symbol: "LMT", name: "Lockheed Martin Corporation", type: "STOCK" },
  { symbol: "RTX", name: "Raytheon Technologies Corporation", type: "STOCK" },
  { symbol: "GE", name: "General Electric Company", type: "STOCK" },
  { symbol: "MMM", name: "3M Company", type: "STOCK" },
  { symbol: "INTC", name: "Intel Corporation", type: "STOCK" },
  { symbol: "QCOM", name: "Qualcomm Inc.", type: "STOCK" },
  { symbol: "TXN", name: "Texas Instruments Inc.", type: "STOCK" },
  { symbol: "CRM", name: "Salesforce Inc.", type: "STOCK" },
  { symbol: "ADBE", name: "Adobe Inc.", type: "STOCK" },
  { symbol: "ORCL", name: "Oracle Corporation", type: "STOCK" },
  { symbol: "IBM", name: "International Business Machines", type: "STOCK" },
  { symbol: "CSCO", name: "Cisco Systems Inc.", type: "STOCK" },
  { symbol: "ACN", name: "Accenture plc", type: "STOCK" },
  { symbol: "NOW", name: "ServiceNow Inc.", type: "STOCK" },
  { symbol: "UBER", name: "Uber Technologies Inc.", type: "STOCK" },
  { symbol: "ABNB", name: "Airbnb Inc.", type: "STOCK" },
  { symbol: "PLTR", name: "Palantir Technologies Inc.", type: "STOCK" },
  { symbol: "SNOW", name: "Snowflake Inc.", type: "STOCK" },
  { symbol: "PYPL", name: "PayPal Holdings Inc.", type: "STOCK" },
  { symbol: "COIN", name: "Coinbase Global Inc.", type: "STOCK" },

  // --- CRYPTO (Top 30 by market cap) ---
  { symbol: "BTC-USD", name: "Bitcoin", type: "CRYPTO" },
  { symbol: "ETH-USD", name: "Ethereum", type: "CRYPTO" },
  { symbol: "SOL-USD", name: "Solana", type: "CRYPTO" },
  { symbol: "XRP-USD", name: "XRP", type: "CRYPTO" },
  { symbol: "ADA-USD", name: "Cardano", type: "CRYPTO" },
  { symbol: "DOGE-USD", name: "Dogecoin", type: "CRYPTO" },
  { symbol: "AVAX-USD", name: "Avalanche", type: "CRYPTO" },
  { symbol: "LINK-USD", name: "Chainlink", type: "CRYPTO" },
  { symbol: "DOT-USD", name: "Polkadot", type: "CRYPTO" },
  { symbol: "LTC-USD", name: "Litecoin", type: "CRYPTO" },
  { symbol: "ATOM-USD", name: "Cosmos", type: "CRYPTO" },

  // --- INDIAN STOCKS (Baseline 10) ---
  { symbol: "RELIANCE.NS", name: "Reliance Industries", type: "STOCK" },
  { symbol: "HDFCBANK.NS", name: "HDFC Bank", type: "STOCK" },
  { symbol: "ICICIBANK.NS", name: "ICICI Bank", type: "STOCK" },
  { symbol: "TCS.NS", name: "Tata Consultancy Services", type: "STOCK" },
  { symbol: "INFY.NS", name: "Infosys", type: "STOCK" },
  { symbol: "SBIN.NS", name: "State Bank of India", type: "STOCK" },
  { symbol: "BHARTIARTL.NS", name: "Bharti Airtel", type: "STOCK" },
  { symbol: "LT.NS", name: "Larsen & Toubro", type: "STOCK" },
  { symbol: "KOTAKBANK.NS", name: "Kotak Mahindra Bank", type: "STOCK" },
  { symbol: "HINDUNILVR.NS", name: "Hindustan Unilever", type: "STOCK" },

  // --- INDIAN MUTUAL FUNDS (Baseline 5) ---
  { symbol: "MF-119018", name: "HDFC Large Cap Fund - Direct Growth", type: "MUTUAL_FUND" },
  { symbol: "MF-120586", name: "ICICI Prudential Large Cap Fund - Direct Growth", type: "MUTUAL_FUND" },
  { symbol: "MF-119598", name: "SBI Large Cap Fund - Direct Growth", type: "MUTUAL_FUND" },
  { symbol: "MF-119364", name: "HDFC Flexi Cap Fund - Direct Growth", type: "MUTUAL_FUND" },
  { symbol: "MF-120828", name: "SBI Small Cap Fund - Direct Growth", type: "MUTUAL_FUND" },

  // --- COMMODITIES (10 Key Benchmarks) ---
  { symbol: "GC=F", name: "Gold Futures", type: "COMMODITY" },
  { symbol: "SI=F", name: "Silver Futures", type: "COMMODITY" },
  { symbol: "CL=F", name: "Crude Oil (WTI)", type: "COMMODITY" },
  { symbol: "NG=F", name: "Natural Gas", type: "COMMODITY" },
  { symbol: "BZ=F", name: "Brent Crude Oil", type: "COMMODITY" },
  { symbol: "HG=F", name: "Copper Futures", type: "COMMODITY" },
  { symbol: "PL=F", name: "Platinum Futures", type: "COMMODITY" },
  { symbol: "ZC=F", name: "Corn Futures", type: "COMMODITY" },
  { symbol: "ZS=F", name: "Soybean Futures", type: "COMMODITY" },
  { symbol: "ZW=F", name: "Wheat Futures", type: "COMMODITY" },
];

async function main() {
  logger.info("⚠️  Starting Database Reset & Seed...");

  // 1. Truncate Tables
  // Note: Truncate is faster than deleteMany, but Prisma supports deleteMany easily.
  // We delete dependent tables first.
  logger.info("🗑️  Cleaning existing data...");
  await prisma.assetScore.deleteMany({});
  await prisma.marketRegime.deleteMany({});
  await prisma.institutionalEvent.deleteMany({});
  await prisma.evidenceReference.deleteMany({});
  await prisma.stockSector.deleteMany({});
  await prisma.evidence.deleteMany({});
  await prisma.sectorRegime.deleteMany({});
  await prisma.sector.deleteMany({});
  await prisma.multiHorizonRegime.deleteMany({});
  await prisma.asset.deleteMany({}); // Delete assets last due to relations (though they were cascaded above largely)

  logger.info("✅ Database cleared.");

  // 2. Seed Baseline Assets
  logger.info(`🌱 Seeding ${BASELINE_ASSETS.length} baseline assets...`);

  for (const asset of BASELINE_ASSETS) {
    await prisma.asset.create({
      data: {
        symbol: asset.symbol,
        name: asset.name,
        type: asset.type as import("../src/generated/prisma/client").AssetType,
        // We initialize with null data, the Sync Engine will populate this.
      },
    });
  }

  logger.info("✅ Reset & Seed Complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
