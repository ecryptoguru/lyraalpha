import type { SectorSensitivity } from "../types";

export const US_SECTOR_SENSITIVITY: SectorSensitivity[] = [
  { sector: "Layer 1",        icon: "⛓️", impact: "tailwind",  driver: "BTC dominance rising + L1 fee recovery" },
  { sector: "DeFi",           icon: "🏦", impact: "tailwind",  driver: "TVL growth + yield farming resurgence" },
  { sector: "AI & ML",        icon: "🤖", impact: "tailwind",  driver: "AI agent integration + compute demand" },
  { sector: "RWA Tokenization",icon: "📜", impact: "tailwind",  driver: "Institutional onboarding + compliance clarity" },
  { sector: "Layer 2",        icon: "⚡", impact: "neutral",   driver: "Scaling adoption offset by L1 fee compression" },
  { sector: "Gaming (GameFi)", icon: "�", impact: "headwind",  driver: "User retention challenges + token inflation" },
  { sector: "NFTs",           icon: "🎨", impact: "headwind",  driver: "Volume decline + speculative fatigue" },
  { sector: "Meme Coins",     icon: "🐸", impact: "headwind",  driver: "Hype-driven + extreme volatility risk" },
  { sector: "Privacy Coins",  icon: "🔒", impact: "neutral",   driver: "Regulatory uncertainty + ZK tech adoption" },
  { sector: "Stablecoins",    icon: "�", impact: "tailwind",  driver: "Payment adoption + regulatory frameworks" },
  { sector: "ZK Proofs",      icon: "�", impact: "neutral",   driver: "Tech maturing but ecosystem still early" },
  { sector: "DEX",            icon: "🔄", impact: "tailwind",  driver: "On-chain volume growth + MEV redistribution" },
];
