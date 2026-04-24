// Thin local copy of /pricing plan shape — sync check against /pricing source of truth on change.
export interface PricingPlan {
  name: string;
  monthlyPrice: number;
  annualPrice: number;
  desc: string;
  features: readonly string[];
  cta: string;
  popular: boolean;
}

export const pricingPlans: readonly PricingPlan[] = [
  {
    name: "Starter",
    monthlyPrice: 0,
    annualPrice: 0,
    desc: "Essential crypto intelligence for individual investors",
    features: ["AI-Powered Market Research", "5-Asset Watchlist", "DSE Scores & Regime Analysis", "Compare 2 Assets at once", "Basic On-Chain Metrics", "Community Discord Access"],
    cta: "Start Free",
    popular: false,
  },
  {
    name: "Pro",
    monthlyPrice: 29,
    annualPrice: 24,
    desc: "Professional-grade tools for serious crypto analysts",
    features: ["Everything in Starter", "Unlimited Asset Watchlist", "Portfolio Intelligence Suite", "Shock Simulator", "Cross-Asset Comparison (4)", "Priority AI Response Queue", "Advanced On-Chain Analytics", "Custom Alerts & Notifications"],
    cta: "Upgrade to Pro",
    popular: true,
  },
  {
    name: "Enterprise",
    monthlyPrice: 99,
    annualPrice: 79,
    desc: "Institutional deployment with custom integrations",
    features: ["Everything in Pro", "Unlimited Portfolio Analysis", "Custom Asset Integration", "API Access & Webhooks", "White-Label Deployment", "Dedicated Support Channel", "Custom Model Training", "SLA Guarantee"],
    cta: "Contact Sales",
    popular: false,
  },
];
