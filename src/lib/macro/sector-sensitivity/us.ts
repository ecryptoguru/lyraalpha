import type { SectorSensitivity } from "../types";

export const US_SECTOR_SENSITIVITY: SectorSensitivity[] = [
  { sector: "Technology",       icon: "💻", impact: "tailwind",  driver: "Rate hold + AI capex cycle" },
  { sector: "Financials",       icon: "🏦", impact: "tailwind",  driver: "Higher-for-longer supports NIM" },
  { sector: "Energy",           icon: "⚡", impact: "neutral",   driver: "OPEC+ cuts offset by demand softness" },
  { sector: "Healthcare",       icon: "🏥", impact: "tailwind",  driver: "Defensive rotation + aging demographics" },
  { sector: "Consumer Disc.",   icon: "🛍️", impact: "headwind",  driver: "Sticky inflation compresses margins" },
  { sector: "Industrials",      icon: "🏗️", impact: "tailwind",  driver: "Reshoring + infrastructure spend" },
  { sector: "Utilities",        icon: "🔌", impact: "headwind",  driver: "Rate sensitivity pressures valuation" },
  { sector: "Real Estate",      icon: "🏢", impact: "headwind",  driver: "High rates weigh on cap rates" },
  { sector: "Materials",        icon: "⛏️", impact: "neutral",   driver: "China demand uncertainty" },
  { sector: "Comm. Services",   icon: "📡", impact: "tailwind",  driver: "Ad cycle recovery + streaming growth" },
  { sector: "Consumer Staples", icon: "🛒", impact: "neutral",   driver: "Defensive but margin pressure ongoing" },
];
