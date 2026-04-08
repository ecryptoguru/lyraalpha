
import { prisma } from "../src/lib/prisma";
import { createLogger } from "../src/lib/logger";

const logger = createLogger({ service: "generate-lyra" });

export async function generateLyraIntel() {
  logger.info("🧠 Starting Lyra Intel Generation...");


  // 1. Get latest Market Regime
  const regime = await prisma.marketRegime.findFirst({
    orderBy: { date: 'desc' }
  });

  if (!regime) {
    logger.error("No Market Regime found. Cannot generate Lyra Intel.");
    return;
  }

  const regimeState = regime.state || "NEUTRAL";
  logger.info(`Context: ${regimeState}`);

  // 2. Generate "6 Questions" Content (Rule-Based Mock)
  // In production, this would call an LLM with the regime context + top assets.
  
  const questions = [
    {
      title: "What is the Market Regime?",
      content: `The market is currently in a **${regimeState}** state. ` +
               `Breadth is ${getAdjective(regime.breadthScore || 50)} (${regime.breadthScore?.toFixed(0)}%), ` +
               `indicating ${regimeState === "RISK_ON" ? "robust participation" : "selective opportunities"}. ` +
               `Volatility remains ${regimeState === "RISK_OFF" ? "elevated" : "controlled"}.`
    },
    {
      title: "Where is the Smart Money Going?", 
      content: getSmartMoneyContent(regimeState)
    },
    {
      title: "What are the Key Risks?",
      content: getRiskContent(regimeState)
    },
    {
      title: "How Should I Position?",
      content: getPositioningContent(regimeState)
    },
    {
      title: "What is the 'Fat Pitch'?",
      content: getFatPitchContent(regimeState)
    },
    {
      title: "Lyra's Verdict",
      content: `**${regimeState.replace("_", " ")}**. ` +
               `Maintain ${regimeState.includes("RISK") ? "disciplined allocation" : "flexibility"}. ` +
               `Focus on high-conviction assets with strong ${regimeState === "RISK_ON" ? "momentum" : "quality"} factors.`
    }
  ];

  // 3. Store in DB (LyraAnalysis model removed - just log for now)
  const reportContent = questions.map(q => `## ${q.title}\n\n${q.content}`).join("\n\n---\n\n");

  logger.info({ questionsCount: questions.length, regime: regimeState }, "Lyra Daily Brief generated");
  logger.debug({ content: reportContent.substring(0, 500) }, "Brief content preview");

  logger.info("✅ Lyra Analysis Generated.");
}

// Helpers for dynamic content
function getAdjective(score: number) {
    if (score > 70) return "strong";
    if (score > 40) return "stable";
    return "weak";
}

function getSmartMoneyContent(state: string) {
    if (state.includes("RISK_ON")) return "Institutions are rotating into Cyclicals (Tech, Discretionary) and emerging markets, aggressively bidding up high-beta assets.";
    if (state.includes("RISK_OFF")) return "Capital is fleeing to safety: US Treasuries, Gold, and high-quality dividend payers (Utilities, Staples).";
    return "Smart money is hedged, favoring 'Barbell' strategies: Long Quality (Big Tech) while holding substantial Cash and Gold.";
}

function getRiskContent(state: string) {
    if (state.includes("RISK_ON")) return "Overextension in momentum names and potential rate hike surprises. Watch for a reversal in the Dollar ($DXY).";
    return "Liquidity cascades in credit markets and earnings compression. Key support levels on SPY are critical.";
}

function getPositioningContent(state: string) {
    if (state.includes("RISK_ON")) return "Overweight Equities (70%), focusing on Growth. Underweight Bonds. Add leverage selectively on pullbacks.";
    if (state.includes("RISK_OFF")) return "Maximize Cash (40%) and Bonds (30%). Limit Equity exposure to Defensives only.";
    return "Neutral positioning. 60/40 Equity/Bond split. Focus on Stock Picking rather than broad beta.";
}

function getFatPitchContent(state: string) {
    if (state.includes("RISK_ON")) return "Leveraged Tech (TQQQ) or Semiconductor ETFs (SOXL) on intraday dips.";
    if (state.includes("RISK_OFF")) return "Short High Yield (SJB) or Long Volatility (VIXY) calls.";
    return "Selling Premium (Iron Condors) on range-bound indices.";
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("generate-lyra-intel.ts")) {
  generateLyraIntel()
    .catch((e: unknown) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

