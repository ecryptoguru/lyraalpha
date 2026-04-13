import type { Metadata } from "next";

import { PublicToolPage } from "@/components/tools/public-tool-page";

export const metadata: Metadata = {
  title: "AI Investment Research | LyraAlpha AI — Ask Lyra, Get Grounded Analysis",
  description:
    "AI investment research powered by Lyra — LyraAlpha's regime-aware AI agent. Ask cross-asset questions, get scenario maps and second-order effects, then move into the right analytical surface. US and India markets. No hallucinated metrics.",
  alternates: { canonical: `${process.env.NEXT_PUBLIC_APP_URL || "https://lyraalpha.xyz"}/tools/ai-investment-research` },
  openGraph: {
    title: "AI Investment Research | LyraAlpha AI",
    description:
      "Ask Lyra a hard market question. She maps it into scenarios, identifies second-order effects, and routes you into portfolio, narratives, or asset analysis — no generic chatbot responses.",
    url: `${process.env.NEXT_PUBLIC_APP_URL || "https://lyraalpha.xyz"}/tools/ai-investment-research`,
    images: ["/og-image.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Investment Research | LyraAlpha AI",
    description:
      "Ask Lyra a hard market question. She maps it into scenarios, identifies second-order effects, and routes you into portfolio, narratives, or asset analysis — no generic chatbot responses.",
    images: ["/og-image.png"],
  },
};

export default function AiInvestmentResearchPage() {
  return (
    <PublicToolPage
      eyebrow="AI investment research · Lyra"
      title="Ask the hard market question. Get a decision path, not a wall of text."
      description="Lyra is purpose-built for investors — not a general-purpose chatbot. She grounds every response in deterministic engine computation, then maps your question into a scenario framework and routes you into the right next system."
      systemLabel="Lyra · AI research agent"
      systemSummary="Lyra handles market intelligence. She runs on tiered model routing — simple questions get fast answers, complex cross-asset scenarios get deep reasoning with regime context, second-order effects, and a concrete follow-through path. She never invents a metric the engines haven't already computed."
      paths={[
        { label: "Ask in plain English", detail: "No need to structure the query. Ask the way you'd think about it — cross-asset, scenario-based, or open-ended. Lyra handles the framing." },
        { label: "Get a scenario map", detail: "Lyra identifies the strongest second-order effects, separates what's regime-driven from what's name-specific, and calls out what matters most." },
        { label: "Move into the right surface", detail: "From the answer, the system routes you into portfolio intelligence for exposure checks, narratives for regime context, or asset analysis when the question narrows to one name." },
      ]}
      examples={[
        {
          label: "Cross-asset scenario",
          prompt: "If rates stay higher for longer, what actually changes across banks, gold, and growth stocks?",
          output: "Lyra maps the rate scenario into each asset class separately, surfaces the strongest second-order effects — credit spreads, real yield impact on growth multiples, gold's inflation vs rate sensitivity — then points you into the surface that resolves the tightest decision.",
        },
        {
          label: "Portfolio risk framing",
          prompt: "Which part of my portfolio is most exposed if the current market narrative breaks down?",
          output: "Lyra explains the reasoning first, then hands you into portfolio intelligence when exposure validation matters more than more words. The answer doesn't stop at text.",
        },
        {
          label: "Candidate comparison",
          prompt: "I have two ideas in the same sector. How do I decide which one deserves more time?",
          output: "Lyra uses the research answer to frame the comparison criteria, then routes you into Compare Assets or asset detail for structured follow-through — not just a suggestion.",
        },
      ]}
      comparisonTitle="Why Lyra is different from a generic AI chatbot"
      comparisonAlternativeLabel="Generic AI chatbot"
      comparisonRows={[
        {
          label: "Analytical foundation",
          thisTool: "Every response is grounded in pre-computed DSE scores, volatility regime, momentum signals, and market structure data. Lyra interprets what the engines already calculated.",
          alternative: "Generates responses from training data alone. No market computation underneath — confident-sounding but structurally hollow.",
        },
        {
          label: "Follow-through",
          thisTool: "Routes you into portfolio intelligence, narratives, asset analysis, or compare depending on which surface closes the decision gap.",
          alternative: "Stops at the chat response. What you do next is entirely on you.",
        },
        {
          label: "Hallucination risk",
          thisTool: "Cannot invent a metric the engines haven't computed. The AI layer interprets structured output — it doesn't fabricate analytical structure.",
          alternative: "Known to invent plausible-sounding metrics, ratios, and historical data points with high confidence.",
        },
      ]}
      faqs={[
        {
          question: "What is AI investment research on LyraAlpha?",
          answer: "It's Lyra — a purpose-built financial AI agent that combines market question answering with system routing. The answer leads somewhere concrete: portfolio intelligence, market narratives, or asset analysis depending on what the question actually needs.",
        },
        {
          question: "How is this different from asking ChatGPT about stocks?",
          answer: "ChatGPT generates responses from training data. Lyra grounds every response in pre-computed deterministic signals — DSE scores, regime classification, volatility metrics — computed fresh before she speaks. She also routes you into the right analytical surface after the answer, instead of stopping at text.",
        },
        {
          question: "What markets and asset classes does Lyra cover?",
          answer: "Crypto markets across chains and protocols. Most AI finance tools are equity-only. LyraAlpha covers the full crypto market from the same engine.",
        },
        {
          question: "When should I use research instead of narrative tracking?",
          answer: "Use Lyra research when the question is open-ended, scenario-heavy, or crosses multiple assets. Use the narrative tracker when you already know the market is moving and want to understand which story is driving it.",
        },
      ]}
      seoIntro="LyraAlpha's AI investment research tool targets investors who need more than a ticker lookup or a generic AI summary. Lyra handles cross-asset scenario analysis, portfolio framing, and research that feeds forward into structured decision surfaces — not dead-end chat transcripts. This page covers queries around AI crypto research, AI investment analysis, AI portfolio research tools, and regime-aware financial AI for crypto investors."
      seoBullets={[
        "Use this when the question crosses multiple assets, sectors, or scenarios — not just one name.",
        "Lyra's tiered routing means simple questions are fast and cheap; complex ELITE-tier queries get full model depth with reasoning.",
        "Every Lyra response can bridge directly into portfolio intelligence, market narratives, or asset analysis — the system doesn't strand you at the answer.",
      ]}
      ctaLabel="Start Beta Free"
      ctaHref="/sign-up"
      relatedTools={[
        { title: "AI Portfolio Analyzer", description: "Take the research answer back into your holdings when the question is about current exposure.", href: "/tools/ai-portfolio-analyzer" },
        { title: "Market Narrative Tracker", description: "Check whether Lyra's scenario matches the dominant market story right now.", href: "/tools/market-narrative-tracker" },
        { title: "AI Crypto Analysis", description: "Go deeper on one name once the research narrows the field.", href: "/tools/ai-crypto-analysis" },
      ]}
    />
  );
}
