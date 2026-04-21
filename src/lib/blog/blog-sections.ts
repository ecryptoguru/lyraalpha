/**
 * Blog Sections Structure
 * 7 Primary Sections with 100+ SEO Blog Posts
 * Organized for optimal navigation and content discovery
 */

export interface BlogSection {
  id: string;
  name: string;
  slug: string;
  description: string;
  color: string;
  icon: string;
  priority: number;
  postCount: number;
  featured: boolean;
}

export const BLOG_SECTIONS: BlogSection[] = [
  {
    id: "portfolio-intelligence",
    name: "Portfolio Intelligence",
    slug: "portfolio-intelligence",
    description: "Master portfolio analysis, risk management, and optimization strategies for crypto investors",
    color: "blue",
    icon: "PieChart",
    priority: 1,
    postCount: 15,
    featured: true,
  },
  {
    id: "crypto-discovery",
    name: "Crypto Discovery",
    slug: "crypto-discovery",
    description: "Find high-potential crypto assets using on-chain data, fundamentals, and AI-powered screening",
    color: "green",
    icon: "Search",
    priority: 2,
    postCount: 15,
    featured: true,
  },
  {
    id: "crypto-analysis",
    name: "Crypto Analysis",
    slug: "crypto-analysis",
    description: "Deep dives into technical, fundamental, and on-chain analysis for informed investment decisions",
    color: "purple",
    icon: "BarChart3",
    priority: 3,
    postCount: 15,
    featured: true,
  },
  {
    id: "market-intelligence",
    name: "Market Intelligence",
    slug: "market-intelligence",
    description: "Understand market regimes, macro trends, and sentiment to time your entries and exits",
    color: "amber",
    icon: "TrendingUp",
    priority: 4,
    postCount: 15,
    featured: true,
  },
  {
    id: "ai-defai",
    name: "AI & DeFAI",
    slug: "ai-defai",
    description: "Explore the intersection of AI and DeFi—autonomous agents, smart execution, and the future of finance",
    color: "cyan",
    icon: "Brain",
    priority: 5,
    postCount: 10,
    featured: true,
  },
  {
    id: "investing-guides",
    name: "Investing Guides",
    slug: "investing-guides",
    description: "Step-by-step guides for beginners to advanced investors—strategies, tax optimization, and wealth building",
    color: "rose",
    icon: "BookOpen",
    priority: 6,
    postCount: 20,
    featured: false,
  },
  {
    id: "asset-intelligence",
    name: "Asset Intelligence",
    slug: "asset-intelligence",
    description: "Detailed analysis of specific crypto assets—BTC, ETH, SOL, DeFi tokens, and emerging categories",
    color: "indigo",
    icon: "Coins",
    priority: 7,
    postCount: 10,
    featured: false,
  },
  {
    id: "miscellaneous",
    name: "Miscellaneous",
    slug: "miscellaneous",
    description: "General crypto insights, industry trends, regulatory updates, and content that doesn't fit other categories",
    color: "slate",
    icon: "Layers",
    priority: 8,
    postCount: 12,
    featured: false,
  },
];

// Section color mappings for UI
export const SECTION_COLORS: Record<string, { border: string; bg: string; text: string }> = {
  slate: {
    border: "border-border/20",
    bg: "bg-muted/6",
    text: "text-muted-foreground",
  },
  blue: {
    border: "border-info/20",
    bg: "bg-info/6",
    text: "text-info/60",
  },
  green: {
    border: "border-success/20",
    bg: "bg-success/6",
    text: "text-success",
  },
  purple: {
    border: "border-primary/20",
    bg: "bg-primary/6",
    text: "text-primary/60",
  },
  amber: {
    border: "border-warning/20",
    bg: "bg-warning/6",
    text: "text-warning",
  },
  cyan: {
    border: "border-info/20",
    bg: "bg-info/6",
    text: "text-info",
  },
  rose: {
    border: "border-danger/20",
    bg: "bg-danger/6",
    text: "text-danger",
  },
  indigo: {
    border: "border-primary/20",
    bg: "bg-primary/6",
    text: "text-primary/60",
  },
};

// Map legacy categories to new sections
export const CATEGORY_TO_SECTION: Record<string, string> = {
  "AI & Technology": "ai-defai",
  "Market Intelligence": "market-intelligence",
  "Markets": "market-intelligence",
  "Portfolio Intelligence": "portfolio-intelligence",
  "Crypto Discovery": "crypto-discovery",
  "Crypto Analysis": "crypto-analysis",
  "AI & DeFAI": "ai-defai",
  "Investing Guides": "investing-guides",
  "Asset Intelligence": "asset-intelligence",
  "Miscellaneous": "miscellaneous",
};
