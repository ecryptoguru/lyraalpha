/**
 * Lyra Explainability Prompt System for Discovery
 * Aligned with docs/discovery/lyra-why.md
 */

export const DISCOVERY_BASE_SYSTEM = `
You are **Lyra**, LyraAlpha AI's senior multi-asset strategist. In this context, your role is to explain **why** an asset appears in a discovery sector — using observable data, disclosed events, and structural factors only.

Your analytical philosophy:
1. **Data first** — every claim must reference a specific number or observable signal. Flag inferences explicitly.
2. **Patterns over points** — individual scores are context; explain what the combination of signals means.
3. **Specificity is credibility** — "strong momentum" is useless; "T:82 + M:71 = full confirmation in a risk-on environment" is analysis.

You must:
- Never provide buy, sell, or hold advice
- Never predict prices or returns
- Never imply future performance
- Use neutral, factual, institutional-grade language
- State limitations and uncertainty explicitly where applicable

If a user asks for investment advice or a prediction, redirect warmly to explanation and context.
`.trim();

export function BUILD_WHY_INCLUDED_PROMPT(data: {
  stockName: string;
  stockSymbol: string;
  sectorName: string;
  inclusionType: string;
  inclusionReason: string;
  scores: {
    R: number;
    E: number;
    B: number;
    N: number;
    M: number;
  };
  institutionalSignals?: {
    trend: number;
    momentum: number;
    volatility: number;
    liquidity: number;
    sentiment: number;
    trust: number;
  };
  evidenceRefs: Array<{ sourceType: string; title: string }>;
}): string {
  const evidenceList = data.evidenceRefs
    .map((e) => `- ${e.sourceType}: ${e.title}`)
    .join("\n");

  const signalsText = data.institutionalSignals
    ? `
Institutional Market Performance Signals:
- Trend: ${data.institutionalSignals.trend}
- Momentum: ${data.institutionalSignals.momentum}
- Volatility: ${data.institutionalSignals.volatility}
- Liquidity: ${data.institutionalSignals.liquidity}
- Sentiment: ${data.institutionalSignals.sentiment}
- Governance/Trust: ${data.institutionalSignals.trust}
`
    : "";

  return `
Explain why the following stock appears in the given discovery sector.

Stock:
- Name: ${data.stockName}
- Symbol: ${data.stockSymbol}

Sector:
- Name: ${data.sectorName}

Inclusion Details:
- Inclusion type: ${data.inclusionType}
- Inclusion reason: ${data.inclusionReason}
- Sector relevance score (R): ${data.scores.R}
- Event freshness score (E): ${data.scores.E}
- Business strength score (B): ${data.scores.B}
- Narrative density score (N): ${data.scores.N}
- Market behavior score (M): ${data.scores.M}

Evidence references:
${evidenceList}

${signalsText}

Instructions for Formatting:
1. Use the following Markdown structure strictly:
   ### **Why It's Here**
   [A concise, professional one-sentence summary of why the stock is included here.]

   ### **Key Drivers**
   - **[Primary Factor Name]**: [Explanation of the primary deterministic factor.]
   - **[Secondary Factor Name]** (if applicable): [Explanation of supporting context.]

   ### **Structural Boundaries**
   [A brief statement on what this inclusion does NOT imply (e.g., performance prediction or financial advice).]

2. Style Guidelines:
   - Use calm, institutional-grade language.
   - Use bold text for emphasis on key terms.
   - Do NOT mention the raw score numbers (R, E, B, N, M) in the text unless specifically required for clarity.
   - Maintain a total length between 120–180 words.

3. Objective:
   - Factual analysis only. No hype, no predictions.
   - Never include the ".NS" suffix for Indian stock ticker symbols (e.g., write "HDFCBANK" instead of "HDFCBANK.NS").
`.trim();
}
