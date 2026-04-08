export type LearningPathIconKey = "star" | "award" | "play" | "clock";

export interface LearningPathDefinition {
  id: string;
  title: string;
  description: string;
  iconKey: LearningPathIconKey;
  modules: string[];
  isEliteOnly: boolean;
  color: string;
}

export const LEARNING_PATHS: LearningPathDefinition[] = [
  {
    id: "score-literacy",
    title: "Score Literacy",
    description: "Master the six core scores — Trend, Momentum, Volatility, Liquidity, Sentiment, Trust — that power every InsightAlpha analysis.",
    iconKey: "star",
    modules: [
      "what-is-trend-score",
      "what-is-momentum",
      "what-is-volatility",
      "what-is-liquidity",
      "what-is-sentiment",
      "what-is-trust-score",
    ],
    isEliteOnly: false,
    color: "from-amber-500/20 to-orange-500/5 border-amber-500/30",
  },
  {
    id: "lyra-mastery",
    title: "Lyra AI Mastery",
    description: "Learn how to ask better questions, understand Lyra's tier-aware responses, and get more from every credit you spend.",
    iconKey: "play",
    modules: [
      "ask-lyra-workflow",
      "how-lyra-tiers-work",
      "lyra-query-types",
      "credits-and-plans-explained",
      "lyra-memory-explained",
    ],
    isEliteOnly: false,
    color: "from-primary/20 to-primary/5 border-primary/30",
  },
  {
    id: "market-context",
    title: "Market Context",
    description: "Read regimes, narratives, catalysts, and analyst signals as one connected system.",
    iconKey: "award",
    modules: [
      "what-is-market-regime",
      "market-narratives-explained",
      "market-events-explained",
      "reading-analyst-signals",
      "sector-rotation-basics",
    ],
    isEliteOnly: false,
    color: "from-rose-500/20 to-orange-500/5 border-rose-500/30",
  },
  {
    id: "platform-workflows",
    title: "Platform Workflows",
    description: "Learn the shortest route from discovery to action across watchlists, discovery cards, and asset pages.",
    iconKey: "award",
    modules: [
      "reading-discovery-cards",
      "score-inflections",
      "peer-divergence",
      "watchlist-workflow",
      "rewards-and-xp-explained",
    ],
    isEliteOnly: false,
    color: "from-emerald-500/20 to-teal-500/5 border-emerald-500/30",
  },
  {
    id: "crypto-deep-dive",
    title: "Crypto Deep Dive",
    description: "Understand on-chain risk, network health, and holder stability.",
    iconKey: "play",
    modules: [
      "understanding-network-activity",
      "crypto-structural-risk",
      "holder-stability-explained",
      "crypto-trust-model",
    ],
    isEliteOnly: false,
    color: "from-amber-500/20 to-cyan-500/5 border-amber-500/30",
  },
  {
    id: "elite-portfolio-lab",
    title: "Elite Portfolio Lab",
    description: "Compare assets, run stress tests, interpret ARCS scores, and build regime-aware portfolios.",
    iconKey: "clock",
    modules: [
      "portfolio-health-explained",
      "arcs-explained",
      "compare-assets-guide",
      "shock-simulator-guide",
      "cross-asset-correlation",
      "monte-carlo-explained",
    ],
    isEliteOnly: true,
    color: "from-amber-500/20 to-pink-500/5 border-amber-500/30",
  },
];

export function getLearningPathById(pathId: string) {
  return LEARNING_PATHS.find((path) => path.id === pathId);
}
