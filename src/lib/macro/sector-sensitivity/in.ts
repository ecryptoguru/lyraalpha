import type { SectorSensitivity } from "../types";

export const IN_SECTOR_SENSITIVITY: SectorSensitivity[] = [
  { sector: "Banking & Finance", icon: "🏦", impact: "tailwind",  driver: "RBI rate cut boosts NIM outlook" },
  { sector: "IT Services",       icon: "💻", impact: "neutral",   driver: "US slowdown risk offsets domestic demand" },
  { sector: "Auto & EV",         icon: "🚗", impact: "tailwind",  driver: "Rate cut + rural demand recovery" },
  { sector: "Real Estate",       icon: "🏢", impact: "tailwind",  driver: "Lower rates improve affordability" },
  { sector: "FMCG",              icon: "🛒", impact: "neutral",   driver: "Rural recovery but urban margin pressure" },
  { sector: "Pharma",            icon: "💊", impact: "tailwind",  driver: "US generics + domestic formulations" },
  { sector: "Metals & Mining",   icon: "⛏️", impact: "headwind",  driver: "China steel demand softness" },
  { sector: "Energy & Power",    icon: "⚡", impact: "tailwind",  driver: "Capex cycle + renewable buildout" },
  { sector: "Telecom",           icon: "📡", impact: "neutral",   driver: "ARPU growth but capex intensive" },
  { sector: "Infrastructure",    icon: "🏗️", impact: "tailwind",  driver: "Govt capex Rs 11.1L cr budget" },
  { sector: "Consumer Disc.",    icon: "🛍️", impact: "neutral",   driver: "Premium holds; mass market squeezed" },
];
