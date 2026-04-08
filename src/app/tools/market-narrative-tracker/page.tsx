import type { Metadata } from "next";

import { PublicToolPage } from "@/components/tools/public-tool-page";

export const metadata: Metadata = {
  title: "Market Narrative Tracker | LyraAlpha AI — Regime Analysis & Sector Rotation",
  description:
    "Track the dominant market narrative in real time. LyraAlpha's narrative engine identifies regime shifts, sector rotation, and the market stories that are strengthening or fading — so you react to what's actually driving prices, not the loudest headline.",
  alternates: { canonical: "https://lyraalpha.ai/tools/market-narrative-tracker" },
  openGraph: {
    title: "Market Narrative Tracker | LyraAlpha AI",
    description:
      "Find the market story behind the moves — not the moves themselves. Regime classification, sector rotation signals, and narrative strength tracking for US and India markets.",
    url: "https://lyraalpha.ai/tools/market-narrative-tracker",
    images: ["/og-image.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Market Narrative Tracker | LyraAlpha AI",
    description:
      "Find the market story behind the moves — not the moves themselves. Regime classification, sector rotation signals, and narrative strength tracking for US and India markets.",
    images: ["/og-image.png"],
  },
};

export default function MarketNarrativeTrackerPage() {
  return (
    <PublicToolPage
      eyebrow="Market narratives · Regime intelligence"
      title="Understand what's actually driving the market before you react to it."
      description="Most market moves don't make sense in isolation. This system condenses scattered sector moves, leadership shifts, and price action into the clearest market story right now — and tells you whether it's strengthening, fading, or rotating into something new."
      systemLabel="Narrative intelligence system"
      systemSummary="The narrative engine classifies the current market regime, scores narrative strength across sectors, and identifies leadership rotation in real time. It's not a news aggregator — it's a signal that tells you which story is structurally driving price action versus which is noise. Lyra then connects the narrative to its portfolio implications, discovery opportunities, and scenario risks."
      paths={[
        { label: "Read the dominant narrative", detail: "The system surfaces the one market story most responsible for current price action — not a list of everything happening, just what's actually in charge right now." },
        { label: "Track narrative strength", detail: "Is the story strengthening or fading? Is leadership rotating? These regime signals tell you whether to lean into the narrative or start looking for the next one." },
        { label: "Act on what you find", detail: "From the narrative surface, route into Multibagger Radar to find names aligned with the story, into portfolio intelligence to check your current exposure, or into Lyra for deeper scenario framing." },
      ]}
      examples={[
        {
          label: "Regime shift",
          prompt: "Why are defensive sectors holding up while growth is fading? Is this a real rotation or just a few days of noise?",
          output: "The narrative engine classifies the regime shift, scores whether defensive leadership is strengthening across the board or just in two sectors, and tells you whether this is a durable rotation or a tactical flush. Lyra explains the macro driver and what it means for growth-heavy portfolios.",
        },
        {
          label: "Narrative vs noise",
          prompt: "Is this week's market weakness part of a broader story or just position-clearing before month-end?",
          output: "The system separates isolated volatility from a regime-level narrative change. If it's noise, you get that clearly. If there's a structural story underneath, the engine scores its strength and Lyra tells you what it means for your next move.",
        },
        {
          label: "Portfolio exposure check",
          prompt: "I've identified the dominant narrative. Now what do I do with that information?",
          output: "The system routes you into portfolio intelligence to check whether your holdings are already concentrated in the same story, into discovery to find names best aligned with the narrative, or into Lyra research for scenario framing if the implications are cross-asset.",
        },
      ]}
      comparisonTitle="Why narrative intelligence beats reading market headlines"
      comparisonAlternativeLabel="Headline feeds"
      comparisonRows={[
        {
          label: "Signal vs noise",
          thisTool: "Classifies the current regime and scores narrative strength — tells you whether the story is structurally driving price action or just making noise.",
          alternative: "Surfaces every event at equal volume. Loudest story wins, regardless of whether it's actually driving the market.",
        },
        {
          label: "Regime awareness",
          thisTool: "Identifies whether the market is in a risk-on, risk-off, rotation, or consolidation regime — and updates as it shifts. Every asset score is interpreted in this context.",
          alternative: "No regime classification. Individual stock and sector moves are reported without market-structure context.",
        },
        {
          label: "Decision path",
          thisTool: "Routes into portfolio exposure checks, discovery for aligned names, or Lyra research for deeper scenario framing from the same surface.",
          alternative: "Leaves you to manually connect the headline to a portfolio decision.",
        },
        {
          label: "India coverage",
          thisTool: "Narrative tracking covers both US and Indian markets — sector rotation, regime classification, and narrative strength in both.",
          alternative: "Most headline feeds are US-centric. India market narrative coverage is sparse or non-existent.",
        },
      ]}
      faqs={[
        {
          question: "What is a market narrative in this context?",
          answer: "A market narrative is the structural story most responsible for price action across a broad set of assets right now. It's different from a single headline — it's the regime-level explanation for why sectors are moving the way they are. Examples: rate sensitivity driving defensives, AI infrastructure spending driving semiconductors, rupee weakness driving Indian IT exporters.",
        },
        {
          question: "How is this different from sector rotation tools?",
          answer: "Sector rotation tools show you which sectors are outperforming. The narrative tracker explains why — what structural story is behind the rotation, whether it's strengthening or fading, and what that implies for the next move. It's the interpretation layer on top of the rotation signal.",
        },
        {
          question: "Does this cover Indian market narratives?",
          answer: "Yes. LyraAlpha tracks market narratives for both US and India markets. India-specific narratives — RBI policy, FII flow dynamics, rupee regime, domestic vs export sector rotations — are tracked alongside US macro narratives.",
        },
        {
          question: "When should I use this instead of stock analysis?",
          answer: "Use this first when the question is about the market as a whole or a sector trend. Use stock analysis when you already have a specific name and want a structured read on it within the current narrative context.",
        },
        {
          question: "How does this connect to portfolio decisions?",
          answer: "Once a narrative is identified, the natural next step is checking whether your portfolio is already concentrated in that story or exposed to its risk. The system routes directly into portfolio intelligence for that check.",
        },
      ]}
      seoIntro="LyraAlpha's market narrative tracker targets investors searching for market regime analysis, sector rotation tracker, narrative-driven investing tools, and AI market intelligence for US and India markets. The difference from a standard news feed or sector heat map is the regime classification engine underneath — it tells you what story is structurally driving prices, not just what moved today. This page covers both US macro narratives and India-specific market drivers."
      seoBullets={[
        "Use this when the question is about the market as a system — what story is driving it, whether that story is strengthening, and where the next rotation is building.",
        "Narrative strength scoring tells you whether to lean into the current trend or position for the next regime shift.",
        "Routes directly into Multibagger Radar for aligned names, portfolio intelligence for exposure checks, and Lyra for cross-asset scenario framing.",
      ]}
      ctaLabel="Join Waitlist"
      ctaHref="/#join-waitlist"
      relatedTools={[
        { title: "AI Portfolio Analyzer", description: "Check whether your holdings are already concentrated in the dominant narrative.", href: "/tools/ai-portfolio-analyzer" },
        { title: "AI Investment Research", description: "Take the narrative into Lyra for deeper cross-asset scenario analysis.", href: "/tools/ai-investment-research" },
        { title: "AI Stock Analysis", description: "Score individual names once the narrative narrows the field.", href: "/tools/ai-stock-analysis" },
      ]}
    />
  );
}
