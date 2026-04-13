import type { Metadata } from "next";

import { PublicToolPage } from "@/components/tools/public-tool-page";

export const metadata: Metadata = {
  title: "AI Crypto Analysis | LyraAlpha AI — DSE Scores, Regime Fit & Asset Intelligence",
  description:
    "AI crypto analysis powered by LyraAlpha's deterministic scoring engines. Get trend score, volatility regime, momentum, and sentiment signals computed first — then Lyra interprets the setup, risks, and what deserves attention next.",
  alternates: { canonical: `${process.env.NEXT_PUBLIC_APP_URL || "https://lyraalpha.xyz"}/tools/ai-stock-analysis` },
  openGraph: {
    title: "AI Crypto Analysis | LyraAlpha AI",
    description:
      "DSE scores, regime fit, momentum, and sentiment — computed deterministically, interpreted by Lyra. Drop a crypto ticker and get a structured read on setup, risk, and next steps.",
    url: `${process.env.NEXT_PUBLIC_APP_URL || "https://lyraalpha.xyz"}/tools/ai-stock-analysis`,
    images: ["/og-image.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Crypto Analysis | LyraAlpha AI",
    description:
      "DSE scores, regime fit, momentum, and sentiment — computed deterministically, interpreted by Lyra. Drop a crypto ticker and get a structured read on setup, risk, and next steps.",
    images: ["/og-image.png"],
  },
};

export default function AiStockAnalysisPage() {
  return (
    <PublicToolPage
      eyebrow="Asset intelligence · DSE powered"
      title="One ticker. A structured read on setup, risk, and what to check next."
      description="Drop any crypto asset. The engines compute six deterministic signals — trend score, volatility regime, momentum, ARCS, sentiment, and valuation context. Lyra interprets the output into a clear setup brief with the key risk and the right next step."
      systemLabel="Asset intelligence system"
      systemSummary="The asset surface runs LyraAlpha's DSE scoring stack on a single name: trend (0–100), volatility regime classification, momentum signals, ARCS risk-adjusted score, market sentiment, and valuation context. Every score is computed before Lyra speaks. She tells you what the numbers mean for your decision, not what the numbers are."
      paths={[
        { label: "Get the DSE brief", detail: "Six scores computed in seconds — trend, volatility, momentum, sentiment, ARCS, and valuation context. The quick read tells you where the setup sits and what matters most about it right now." },
        { label: "Understand the risk", detail: "Lyra identifies the primary risk — whether it's regime-driven, valuation-driven, or protocol-specific — and separates what's noise from what deserves attention." },
        { label: "Move into the right next system", detail: "If the setup looks regime-driven, route into Market Narratives. If you need to compare against alternatives, open Compare Assets. If the question is bigger than one name, take it to Lyra research." },
      ]}
      examples={[
        {
          label: "Single-name setup",
          prompt: "I'm watching BTC. What does the current setup actually say?",
          output: "The engine scores trend strength, volatility regime, and momentum. Lyra interprets: high trend score in a low-volatility regime is a clean setup, but ARCS flags elevated valuation relative to network activity. The next step is checking whether the narrative still supports the premium or is starting to rotate.",
        },
        {
          label: "Regime vs protocol risk",
          prompt: "Is this crypto's recent weakness a protocol problem or a sector rotation?",
          output: "The system checks whether the weakness correlates with the broader crypto narrative or is idiosyncratic. If it's regime-driven, Lyra routes into Market Narratives. If it's protocol-specific, the asset detail surface goes deeper on the on-chain metrics.",
        },
        {
          label: "Comparison decision",
          prompt: "Should I keep tracking this name or switch my attention to a better setup?",
          output: "Lyra uses the DSE scores to frame whether this name deserves deeper analysis or whether Compare Assets mode will surface a stronger setup in the same sector. Saves time on names that look interesting but don't score well.",
        },
      ]}
      comparisonTitle="Why this is more useful than a standard crypto screener"
      comparisonAlternativeLabel="Standard crypto screener"
      comparisonRows={[
        {
          label: "What's underneath",
          thisTool: "Six deterministic scores — trend, volatility, momentum, ARCS, sentiment, valuation — computed fresh per asset before any AI interpretation.",
          alternative: "Static on-chain metrics and price filters. No regime context, no scoring engine, no AI layer.",
        },
        {
          label: "AI interpretation",
          thisTool: "Lyra reads the computed scores and tells you what they mean for the decision — setup quality, primary risk, and what to check next.",
          alternative: "No AI interpretation. You read the numbers and decide what they mean yourself.",
        },
        {
          label: "Context",
          thisTool: "Each asset is scored in the context of its sector regime and market narrative. An 80 trend score in a risk-off market reads differently than the same score in a bull regime.",
          alternative: "Assets scored in isolation. No regime adjustment, no narrative context.",
        },
        {
          label: "Next steps",
          thisTool: "Routes into Market Narratives, Compare Assets, or Lyra research depending on what the setup actually needs.",
          alternative: "Shows a results list. What you do with it is your problem.",
        },
      ]}
      faqs={[
        {
          question: "What are DSE scores?",
          answer: "DSE stands for Deterministic Scoring Engine. LyraAlpha's engines compute six structured signals for each asset: trend score (0–100), volatility regime (low/medium/high), momentum, ARCS (risk-adjusted composite score), market sentiment, and valuation context. These are computed deterministically — not estimated by an AI — before Lyra interprets them.",
        },
        {
          question: "What assets does the analysis cover?",
          answer: "Crypto assets across Layer 1 blockchains, Layer 2 scaling solutions, DeFi protocols, and emerging tokens. You can analyze Bitcoin, Ethereum, Solana, and hundreds of other crypto assets using the same scoring engine.",
        },
        {
          question: "What does Lyra actually say about a crypto asset?",
          answer: "Lyra gives you a setup brief — the dominant signal (e.g. high trend in low volatility), the primary risk (e.g. valuation stretch, narrative rotation risk), and a recommended next step (e.g. compare against sector peer, check narrative context, hold and monitor). She doesn't repeat the numbers — she tells you what they mean.",
        },
        {
          question: "When should I use crypto analysis vs AI research?",
          answer: "Use crypto analysis when you already have a specific name and want a structured read on it. Use AI investment research when the question is broader — cross-asset, scenario-based, or when you're not sure which name deserves attention.",
        },
        {
          question: "What is the ARCS score?",
          answer: "ARCS is the risk-adjusted composite score — it combines trend, momentum, and volatility into a single number that accounts for the risk taken to achieve the trend. A high trend score with high volatility gets penalized relative to the same trend score in a low-volatility regime.",
        },
      ]}
      seoIntro="LyraAlpha's AI crypto analysis tool targets investors searching for AI crypto analysis, crypto research tools, ticker analysis, DSE scoring, and structured crypto decision support. The core difference from a screener is the deterministic scoring engine underneath — six signals computed first, Lyra interpreting second. This page covers Layer 1 blockchains, Layer 2 scaling solutions, DeFi protocols, and emerging tokens."
      seoBullets={[
        "Use this when you have a specific name and want a scored, structured read — not just price data and on-chain metrics.",
        "Every score is computed by deterministic engines. Lyra interprets the output, she doesn't generate it from training data alone.",
        "This surface connects into Market Narratives, Compare Assets, and Lyra research — so the analysis doesn't stop at a brief.",
      ]}
      ctaLabel="Start Beta Free"
      ctaHref="/sign-up"
      relatedTools={[
        { title: "AI Investment Research", description: "Ask cross-asset questions before narrowing down to one name.", href: "/tools/ai-investment-research" },
        { title: "Market Narrative Tracker", description: "Check whether the asset setup is part of the dominant market story.", href: "/tools/market-narrative-tracker" },
        { title: "AI Portfolio Analyzer", description: "See how this asset interacts with your overall portfolio before making a move.", href: "/tools/ai-portfolio-analyzer" },
      ]}
    />
  );
}
