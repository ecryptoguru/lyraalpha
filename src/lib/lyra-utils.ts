import { createLogger } from "@/lib/logger";

const logger = createLogger({ service: "lyra-parser" });

export interface Source {
  title: string;
  url: string;
  description?: string;
  favicon?: string;
  publishedDate?: string;
  type?: "web" | "knowledge_base";
}

export interface StockAnalysisResult {
  symbol: string;
  valuation: Array<{
    metric: string;
    value: string | number;
    context?: string;
  }>;
  highlights: Array<{ segment: string; takeaway: string }>;
  data?: Array<{ date: string; price: number }>;
}

export interface MarketRegimeResult {
  state: string;
  breadth: string;
  vix: string;
  narrative: string;
}

export type ToolResult =
  | { toolName: "get_stock_analysis"; result: StockAnalysisResult }
  | { toolName: "get_market_regime"; result: MarketRegimeResult }
  | { toolName: string; result: unknown };

export interface SignalChip {
  verdict: "BULLISH" | "BEARISH" | "NEUTRAL";
  confidence: "HIGH" | "MEDIUM" | "LOW";
  flags: string[];
}

export interface ParsedLyraResponse {
  text: string;
  sources: Source[];
  toolResults: ToolResult[];
  relatedQuestions: string[];
  signalChip?: SignalChip;
}

function extractInlineRelatedQuestions(text: string): { cleanedText: string; relatedQuestions: string[] } {
  const headingMatch = /(^|\n)#{1,3}\s*follow[- ]?up questions\s*:?\s*\n/i.exec(text);
  if (!headingMatch) {
    return { cleanedText: text, relatedQuestions: [] };
  }

  const headingStart = headingMatch.index;
  const afterHeading = text.slice(headingMatch.index + headingMatch[0].length);

  const nextSectionMatch = /\n#{1,3}\s+/.exec(afterHeading);
  const questionsBlock = nextSectionMatch
    ? afterHeading.slice(0, nextSectionMatch.index)
    : afterHeading;

  const relatedQuestions = questionsBlock
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^([-*]|\d+[.)])\s+/.test(line))
    .map((line) => line.replace(/^([-*]|\d+[.)])\s+/, "").trim())
    .filter((line) => line.length > 0)
    .slice(0, 3);

  if (relatedQuestions.length === 0) {
    return { cleanedText: text, relatedQuestions: [] };
  }

  const cleanedText = text.slice(0, headingStart).trimEnd();
  return { cleanedText, relatedQuestions };
}

// Extracts the <!--SIGNALS:{...}--> chip comment emitted by Elite COMPLEX responses.
// Returns undefined if not present or malformed — safe to call on any response.
function extractSignalChip(text: string): { chip?: SignalChip; cleanedText: string } {
  const match = /<!--SIGNALS:(\{[^}]+\})-->/.exec(text);
  if (!match) return { cleanedText: text };
  try {
    const raw = JSON.parse(match[1]) as Record<string, unknown>;
    const verdict = raw.verdict;
    const confidence = raw.confidence;
    const flags = raw.flags;
    if (
      (verdict === "BULLISH" || verdict === "BEARISH" || verdict === "NEUTRAL") &&
      (confidence === "HIGH" || confidence === "MEDIUM" || confidence === "LOW") &&
      Array.isArray(flags)
    ) {
      const chip: SignalChip = {
        verdict,
        confidence,
        flags: (flags as unknown[]).filter((f): f is string => typeof f === "string").slice(0, 3),
      };
      return { chip, cleanedText: text.replace(match[0], "").trimStart() };
    }
  } catch {
    logger.warn("Signal chip parse failed — malformed JSON in SIGNALS comment");
  }
  return { cleanedText: text.replace(match[0], "").trimStart() };
}

/**
 * Parses a streaming response from Lyra that may contain appended tool results and sources.
 */
export function parseLyraMessage(content: string): ParsedLyraResponse {
  let text = content;
  let sources: Source[] = [];
  let toolResults: ToolResult[] = [];
  let relatedQuestions: string[] = [];

  // 0. Extract signal chip (Elite COMPLEX only — safe no-op if absent)
  const { chip: signalChip, cleanedText: chipCleanedText } = extractSignalChip(text);
  text = chipCleanedText;

  // 1. Extract Tool Results
  if (text.includes(":::LYRA_TOOL_RESULTS:::")) {
    const parts = text.split(":::LYRA_TOOL_RESULTS:::");
    text = parts[0].trim();
    try {
      // Tool results are expected before sources if both are present
      const rawResults = parts[1].split(":::LYRA_SOURCES:::")[0].trim();
      if (rawResults) {
        toolResults = JSON.parse(rawResults);
      }
    } catch (e) {
      logger.warn({ err: e }, "Tool results parse failed");
    }
  }

  // 2. Extract Sources
  if (content.includes(":::LYRA_SOURCES:::")) {
    const parts = content.split(":::LYRA_SOURCES:::");
    // If we haven't already cleaned 'text' from tool results, clean it now
    if (text === content) {
      text = parts[0].trim();
    }
    try {
      const potentialJson = parts[parts.length - 1].trim();
      if (potentialJson) {
        sources = JSON.parse(potentialJson);
      }
    } catch (e) {
      logger.warn({ err: e }, "Sources parse failed");
    }
  }

  const related = extractInlineRelatedQuestions(text);
  text = related.cleanedText.replace(/\.NS\b/g, "");
  relatedQuestions = related.relatedQuestions.map(q => q.replace(/\.NS\b/g, ""));

  return { text, sources, toolResults, relatedQuestions, signalChip };
}
