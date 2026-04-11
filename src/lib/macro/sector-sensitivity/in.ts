import type { SectorSensitivity } from "../types";

export const IN_SECTOR_SENSITIVITY: SectorSensitivity[] = [
  { sector: "Layer 1",          icon: "⛓️", impact: "tailwind",  driver: "IN exchange volume surge + BTC dominance rising" },
  { sector: "DeFi",             icon: "🏦", impact: "neutral",   driver: "RBI caution on DeFi + TVL growth on L2s" },
  { sector: "AI & ML",          icon: "🤖", impact: "tailwind",  driver: "India AI task force + on-chain compute demand" },
  { sector: "RWA Tokenization", icon: "📜", impact: "tailwind",  driver: "SEBI exploring digital assets + compliance push" },
  { sector: "Layer 2",          icon: "⚡", impact: "tailwind",  driver: "Low-fee L2s driving IN retail adoption" },
  { sector: "Gaming (GameFi)",  icon: "🎮", impact: "neutral",   driver: "Web3 gaming studios emerging + retention risk" },
  { sector: "NFTs",             icon: "🎨", impact: "headwind",  driver: "1% TDS dampened IN NFT trading volume" },
  { sector: "Meme Coins",       icon: "🐸", impact: "headwind",  driver: "High IN retail speculation + regulatory crackdown risk" },
  { sector: "Privacy Coins",    icon: "🔒", impact: "headwind",  driver: "RBI restrictions + exchange delisting pressure" },
  { sector: "Stablecoins",      icon: "💵", impact: "tailwind",  driver: "INR stablecoin pilots + RBI CBDC roadmap" },
  { sector: "ZK Proofs",        icon: "🔐", impact: "neutral",   driver: "Early-stage IN adoption + compliance-friendly narrative" },
  { sector: "DEX",              icon: "🔄", impact: "tailwind",  driver: "IN P2P volume growth + self-custody trend" },
];
