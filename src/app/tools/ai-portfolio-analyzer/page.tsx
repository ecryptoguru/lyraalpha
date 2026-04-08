import type { Metadata } from "next";

import { PublicToolPage } from "@/components/tools/public-tool-page";

export const metadata: Metadata = {
  title: "AI Portfolio Analyzer | LyraAlpha AI — Health Score, Fragility & Rebalance Signals",
  description:
    "AI portfolio analyzer that surfaces concentration risk, hidden overlap, and fragility before you rebalance. Powered by deterministic portfolio health engines and Lyra AI. US and India markets. Connect your holdings and get a scored diagnostic in seconds.",
  alternates: { canonical: "https://lyraalpha.ai/tools/ai-portfolio-analyzer" },
  openGraph: {
    title: "AI Portfolio Analyzer | LyraAlpha AI",
    description:
      "Find the one portfolio issue that actually matters before you rebalance — concentration, hidden overlap, or fragility. Health score, Monte Carlo simulation, and AI-generated rebalance signals.",
    url: "https://lyraalpha.ai/tools/ai-portfolio-analyzer",
    images: ["/og-image.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Portfolio Analyzer | LyraAlpha AI",
    description:
      "Find the one portfolio issue that actually matters before you rebalance — concentration, hidden overlap, or fragility. Health score, Monte Carlo simulation, and AI-generated rebalance signals.",
    images: ["/og-image.png"],
  },
};

export default function AiPortfolioAnalyzerPage() {
  return (
    <PublicToolPage
      eyebrow="AI portfolio intelligence"
      title="Find the one portfolio problem that matters before you rebalance."
      description="Most portfolio tools show you everything. This one finds what's actually worth fixing — concentration risk, hidden overlap across ETFs and funds, fragility relative to current market regime, and what the right next move looks like."
      systemLabel="Portfolio intelligence system"
      systemSummary="The portfolio engine computes a health score, fragility reading, correlation matrix, and Monte Carlo distribution before any AI speaks. Lyra then interprets the output — she doesn't invent the diagnosis. From there the system routes you into shock simulation for downside context or market narratives for regime framing."
      paths={[
        { label: "Get the health score", detail: "The engine scores your portfolio across concentration, diversification, volatility, and regime fit. One number that tells you where to look first." },
        { label: "Find the real problem", detail: "Concentration, hidden overlap in ETF holdings, correlated drawdown risk, or narrative clustering — the system surfaces the most important issue, not a list of every metric." },
        { label: "Move into scenario testing", detail: "From the health diagnostic, route into Shock Simulator for downside scenario testing, or into Lyra for a plain-English rebalance frame you can actually act on." },
      ]}
      examples={[
        {
          label: "Concentration check",
          prompt: "My top 3 holdings are over 55% of my portfolio. What should I check first?",
          output: "The engine surfaces whether concentration is the primary issue, checks whether those names cluster around the same market narrative, and determines whether the right next step is a trim, a hedge, or a stress test. Lyra frames the rebalance path in plain language.",
        },
        {
          label: "ETF overlap detection",
          prompt: "I own QQQ, VGT, and ARKK. Am I actually diversified or just holding the same tech bet three times?",
          output: "The system computes holding-level overlap across all three funds, surfaces the effective concentration, and flags whether the diversification is real or cosmetic. High overlap at the holding level even when tickers look different.",
        },
        {
          label: "Regime fragility",
          prompt: "How vulnerable is my current mix if the rate environment shifts?",
          output: "The fragility engine scores each position's sensitivity to a rate regime change, identifies the weakest link, then routes into Shock Simulator or Lyra depending on whether the problem is scenario-specific or structural.",
        },
      ]}
      comparisonTitle="Why this is stronger than a standard portfolio tracker"
      comparisonAlternativeLabel="Standard tracker"
      comparisonRows={[
        {
          label: "Core job",
          thisTool: "Find the clearest portfolio problem and route you into the right next analytical step. Not just display what you hold.",
          alternative: "Show holdings, weights, and performance. The investor decides what any of it means.",
        },
        {
          label: "Analytical depth",
          thisTool: "Health score, fragility index, concentration analysis, ETF overlap detection, Monte Carlo simulation, and regime fit — all computed before the AI interprets.",
          alternative: "Basic allocation pie charts and P&L. No engine underneath.",
        },
        {
          label: "AI layer",
          thisTool: "Lyra interprets computed diagnostic output. She can't invent a fragility score — the engine produces it first.",
          alternative: "Generic AI summaries that sound confident but have no deterministic foundation.",
        },
        {
          label: "Follow-through",
          thisTool: "Routes into Shock Simulator, Market Narratives, and Lyra research depending on what the evidence shows.",
          alternative: "Stops at a snapshot. What you do next is on you.",
        },
      ]}
      faqs={[
        {
          question: "What does the portfolio health score measure?",
          answer: "The health score is a composite of concentration risk, diversification quality, volatility regime fit, correlation structure, and drawdown exposure. It's computed deterministically — not estimated by an AI — so you can trust the number.",
        },
        {
          question: "How does hidden overlap detection work?",
          answer: "The system maps each ETF and mutual fund down to its underlying holdings, then computes actual overlap rather than surface-level ticker diversity. Two funds that look different can have 70%+ overlapping positions.",
        },
        {
          question: "What is the Shock Simulator?",
          answer: "Shock Simulator runs historical stress scenarios on your portfolio — rate shocks, equity drawdowns, credit events, commodity spikes. It shows how your specific holdings would have behaved, not how a generic balanced portfolio would.",
        },
        {
          question: "Does this work for Indian portfolios?",
          answer: "Yes. LyraAlpha covers both US and India markets. Indian equity portfolios, mutual funds, and multi-asset mixes are all supported in the portfolio intelligence system.",
        },
        {
          question: "What should I do after the portfolio summary?",
          answer: "The most common paths are Shock Simulator for downside scenario context, Market Narratives for regime framing, or Lyra research when you need the diagnostic translated into a concrete rebalance plan.",
        },
      ]}
      seoIntro="LyraAlpha's AI portfolio analyzer covers queries around portfolio risk analysis, concentration risk checker, ETF overlap detection, portfolio health scoring, and AI rebalance tools. The difference from a generic portfolio tracker is the analytical engine underneath — six deterministic signals computed first, Lyra interpreting second. This page covers both US and India investor use cases across equities, ETFs, mutual funds, and multi-asset portfolios."
      seoBullets={[
        "Use this when you already hold multiple positions and want to know the most important issue before making changes — not a list of every metric.",
        "The health score, fragility index, and Monte Carlo simulation are all computed by deterministic engines. Lyra interprets the output, she doesn't produce it.",
        "This bridges directly into Shock Simulator, Market Narratives, and Lyra research — the surfaces that close the gap between diagnosis and decision.",
      ]}
      ctaLabel="Join Waitlist"
      ctaHref="/#join-waitlist"
      relatedTools={[
        { title: "Demo Portfolio", description: "See the full portfolio intelligence suite in action on a sample US portfolio before connecting your own.", href: "/tools/demo-portfolio" },
        { title: "Market Narrative Tracker", description: "Check whether your portfolio risk is tied to the dominant market story.", href: "/tools/market-narrative-tracker" },
        { title: "AI Investment Research", description: "Use Lyra to frame the rebalance scenario once the portfolio diagnosis is clear.", href: "/tools/ai-investment-research" },
      ]}
    />
  );
}
