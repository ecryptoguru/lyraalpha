/**
 * Static commodity profiles — curated structural context for each commodity.
 * No AI cost, deterministic, updated manually when fundamentals change.
 */

export interface CommodityProfile {
  symbol: string;
  name: string;
  cluster: "precious" | "energy" | "agricultural" | "industrial";
  supplyContext: string;
  demandDrivers: string;
  storageCost: "negligible" | "low" | "moderate" | "high";
  geopoliticalSensitivity: "low" | "moderate" | "high";
  inflationHedge: boolean;
  safeHavenCandidate: boolean;
  seasonalNotes: string;
  contractSpec: {
    exchange: string;
    contractSize: string;
    tickSize: string;
    settlement: "physical" | "cash";
  };
}

export const COMMODITY_PROFILES: Record<string, CommodityProfile> = {
  "GC=F": {
    symbol: "GC=F",
    name: "Gold",
    cluster: "precious",
    supplyContext: "Finite precious metal. Global mine production ~3,500 tonnes/year. Central bank reserves are a major demand/supply factor.",
    demandDrivers: "Jewelry (50%), investment/ETFs (25%), central banks (15%), technology (10%). Strongly driven by real interest rates and USD strength.",
    storageCost: "low",
    geopoliticalSensitivity: "high",
    inflationHedge: true,
    safeHavenCandidate: true,
    seasonalNotes: "Historically stronger in Q1 (Chinese New Year, Indian wedding season) and Q3 (Diwali demand). Weaker in Q2.",
    contractSpec: { exchange: "COMEX", contractSize: "100 troy oz", tickSize: "$0.10/oz ($10/contract)", settlement: "physical" },
  },
  "SI=F": {
    symbol: "SI=F",
    name: "Silver",
    cluster: "precious",
    supplyContext: "Dual-purpose metal — precious and industrial. ~26,000 tonnes/year mine production. Significant recycling supply.",
    demandDrivers: "Industrial (55% — solar panels, electronics), jewelry (25%), investment (20%). More volatile than gold due to smaller market.",
    storageCost: "low",
    geopoliticalSensitivity: "moderate",
    inflationHedge: true,
    safeHavenCandidate: false,
    seasonalNotes: "Industrial demand peaks in Q1-Q2 (manufacturing cycles). Investment demand follows gold patterns.",
    contractSpec: { exchange: "COMEX", contractSize: "5,000 troy oz", tickSize: "$0.005/oz ($25/contract)", settlement: "physical" },
  },
  "CL=F": {
    symbol: "CL=F",
    name: "Crude Oil (WTI)",
    cluster: "energy",
    supplyContext: "Global production ~100M barrels/day. OPEC+ controls ~40% of supply. US shale is the marginal producer.",
    demandDrivers: "Transportation (55%), industrial (30%), residential/commercial (15%). Demand tied to global GDP growth and mobility.",
    storageCost: "high",
    geopoliticalSensitivity: "high",
    inflationHedge: false,
    safeHavenCandidate: false,
    seasonalNotes: "Summer driving season (May-Sep) typically bullish. Refinery maintenance in Q1/Q4 can reduce demand. Hurricane season (Jun-Nov) affects Gulf production.",
    contractSpec: { exchange: "NYMEX", contractSize: "1,000 barrels", tickSize: "$0.01/barrel ($10/contract)", settlement: "physical" },
  },
  "NG=F": {
    symbol: "NG=F",
    name: "Natural Gas",
    cluster: "energy",
    supplyContext: "US production ~100 Bcf/day. LNG exports growing rapidly. Storage levels are critical — limited ability to store large volumes.",
    demandDrivers: "Power generation (40%), industrial (30%), residential heating (20%), exports (10%). Highly weather-dependent.",
    storageCost: "high",
    geopoliticalSensitivity: "moderate",
    inflationHedge: false,
    safeHavenCandidate: false,
    seasonalNotes: "Strong winter seasonality (Nov-Feb heating demand). Injection season (Apr-Oct) typically bearish. Summer heat waves can spike demand for cooling.",
    contractSpec: { exchange: "NYMEX", contractSize: "10,000 MMBtu", tickSize: "$0.001/MMBtu ($10/contract)", settlement: "physical" },
  },
  "BZ=F": {
    symbol: "BZ=F",
    name: "Brent Crude Oil",
    cluster: "energy",
    supplyContext: "Global benchmark for ~80% of world's traded crude. North Sea production declining but remains the reference price.",
    demandDrivers: "Same as WTI but more reflective of global demand. Premium over WTI reflects international supply-demand dynamics.",
    storageCost: "high",
    geopoliticalSensitivity: "high",
    inflationHedge: false,
    safeHavenCandidate: false,
    seasonalNotes: "Similar to WTI. Brent-WTI spread widens during US supply gluts and narrows during global supply disruptions.",
    contractSpec: { exchange: "ICE", contractSize: "1,000 barrels", tickSize: "$0.01/barrel ($10/contract)", settlement: "cash" },
  },
  "HG=F": {
    symbol: "HG=F",
    name: "Copper",
    cluster: "industrial",
    supplyContext: "Global mine production ~22M tonnes/year. Chile and Peru produce ~40%. Long lead times for new mines (5-10 years).",
    demandDrivers: "Construction (30%), electrical/electronics (25%), transportation (15%), industrial machinery (15%), EV/green energy (15% and growing).",
    storageCost: "moderate",
    geopoliticalSensitivity: "moderate",
    inflationHedge: false,
    safeHavenCandidate: false,
    seasonalNotes: "Demand peaks in Q1-Q2 (construction season in Northern Hemisphere). China's construction cycle is the dominant driver.",
    contractSpec: { exchange: "COMEX", contractSize: "25,000 lbs", tickSize: "$0.0005/lb ($12.50/contract)", settlement: "physical" },
  },
  "PL=F": {
    symbol: "PL=F",
    name: "Platinum",
    cluster: "precious",
    supplyContext: "Very concentrated supply — South Africa produces ~70%. Russia ~15%. Total production ~180 tonnes/year.",
    demandDrivers: "Automotive catalysts (40%), jewelry (30%), industrial (20%), investment (10%). Diesel vehicle decline is a headwind.",
    storageCost: "low",
    geopoliticalSensitivity: "high",
    inflationHedge: false,
    safeHavenCandidate: false,
    seasonalNotes: "Auto production cycles drive demand. South African mining disruptions (strikes, power outages) can spike prices.",
    contractSpec: { exchange: "NYMEX", contractSize: "50 troy oz", tickSize: "$0.10/oz ($5/contract)", settlement: "physical" },
  },
  "ZC=F": {
    symbol: "ZC=F",
    name: "Corn",
    cluster: "agricultural",
    supplyContext: "US produces ~35% of global corn. Brazil is the #2 exporter. Annual global production ~1.2B tonnes.",
    demandDrivers: "Animal feed (55%), ethanol (30%), food/industrial (15%). US ethanol mandate creates a price floor.",
    storageCost: "moderate",
    geopoliticalSensitivity: "moderate",
    inflationHedge: false,
    safeHavenCandidate: false,
    seasonalNotes: "Planting (Apr-May) and harvest (Sep-Nov) are key periods. Weather during pollination (Jul) is critical. Prices typically lowest at harvest.",
    contractSpec: { exchange: "CBOT", contractSize: "5,000 bushels", tickSize: "$0.0025/bushel ($12.50/contract)", settlement: "physical" },
  },
  "ZS=F": {
    symbol: "ZS=F",
    name: "Soybeans",
    cluster: "agricultural",
    supplyContext: "Brazil is the #1 producer, US #2. Combined ~70% of global production. China imports ~60% of globally traded soybeans.",
    demandDrivers: "Crush (meal for animal feed + oil) is 85% of demand. China's hog herd size is the single biggest demand driver.",
    storageCost: "moderate",
    geopoliticalSensitivity: "high",
    inflationHedge: false,
    safeHavenCandidate: false,
    seasonalNotes: "US planting (May-Jun), Brazil planting (Oct-Dec). US harvest (Sep-Nov). South American weather during Dec-Feb is critical.",
    contractSpec: { exchange: "CBOT", contractSize: "5,000 bushels", tickSize: "$0.0025/bushel ($12.50/contract)", settlement: "physical" },
  },
  "ZW=F": {
    symbol: "ZW=F",
    name: "Wheat",
    cluster: "agricultural",
    supplyContext: "Global production ~780M tonnes/year. Russia, EU, US, Canada, Australia are major exporters. Black Sea region is critical.",
    demandDrivers: "Human consumption (70%), animal feed (20%), industrial (10%). Global population growth supports long-term demand.",
    storageCost: "moderate",
    geopoliticalSensitivity: "high",
    inflationHedge: false,
    safeHavenCandidate: false,
    seasonalNotes: "Winter wheat planted Sep-Nov, harvested May-Jul. Spring wheat planted Apr-May, harvested Aug-Sep. Black Sea export window is key.",
    contractSpec: { exchange: "CBOT", contractSize: "5,000 bushels", tickSize: "$0.0025/bushel ($12.50/contract)", settlement: "physical" },
  },
};

export const COMMODITY_SYMBOLS = Object.keys(COMMODITY_PROFILES);

export function getCommodityProfile(symbol: string): CommodityProfile | null {
  return COMMODITY_PROFILES[symbol] || null;
}

export function getCommodityCluster(symbol: string): string | null {
  return COMMODITY_PROFILES[symbol]?.cluster || null;
}
