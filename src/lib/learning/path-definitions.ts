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
    description: "Master the six core scores — Trend, Momentum, Volatility, Liquidity, Sentiment, Trust — that power every LyraAlpha analysis.",
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
    color: "from-warning/20 to-warning/5 border-warning/30",
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
    color: "from-danger/20 to-warning/5 border-danger/30",
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
    color: "from-success/20 to-info/5 border-success/30",
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
    color: "from-warning/20 to-info/5 border-warning/30",
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
    color: "from-warning/20 text-danger/5 border-warning/30",
  },
];

export function getLearningPathById(pathId: string) {
  return LEARNING_PATHS.find((path) => path.id === pathId);
}
