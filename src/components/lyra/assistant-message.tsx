"use client";

import { useMemo, memo } from "react";
import dynamic from "next/dynamic";
import { parseLyraMessage, type Source } from "@/lib/lyra-utils";

const AnswerWithSources = dynamic(
  () => import("@/components/lyra/answer-with-sources").then((m) => m.AnswerWithSources),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-3">
        <div className="h-4 w-4/5 rounded bg-muted/20 animate-pulse" />
        <div className="h-4 w-3/5 rounded bg-muted/20 animate-pulse" />
        <div className="h-4 w-2/3 rounded bg-muted/20 animate-pulse" />
      </div>
    ),
  },
);

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  relatedQuestions?: string[];
  contextTruncated?: boolean;
}

function formatTelemetryHeader(content: string): string {
  // Step 1: Strip any GPT CoD scaffold lines that leaked into output
  // e.g. "scaffold: dovish repricing → curve inversion → ..."
  const strippedLines = content
    .split("\n")
    .filter((l) => !/^\s*scaffold\s*:/i.test(l));
  const stripped = strippedLines.join("\n");

  // Step 2: Format first non-empty line if it looks like a telemetry header
  // e.g. "T:neutral + breadth:50 → high narrative sensitivity"
  const lines = stripped.split("\n");
  const firstNonEmptyIndex = lines.findIndex((l) => l.trim().length > 0);
  if (firstNonEmptyIndex < 0) return stripped;

  const header = lines[firstNonEmptyIndex].trim();
  const looksLikeTelemetry =
    header.includes("→") && /(\bbreadth\b|\bdispersion\b|\bT:|\bM:|\bV:)/i.test(header);
  if (!looksLikeTelemetry) return stripped;

  const arrowIdx = header.indexOf("→");
  const metricsRaw = header.slice(0, arrowIdx).trim();
  const implicationRaw = header.slice(arrowIdx + 1).trim();
  if (!metricsRaw || !implicationRaw) return stripped;

  const expandedMetrics = metricsRaw
    .replace(/\bT\s*:/g, "Trend:")
    .replace(/\bM\s*:/g, "Momentum:")
    .replace(/\bV\s*:/g, "Volatility:")
    .replace(/\bL\s*:/g, "Liquidity:")
    .replace(/\bS\s*:/g, "Sentiment:");

  lines[firstNonEmptyIndex] = `${expandedMetrics}\n\nImplication: ${implicationRaw}`;
  return lines.join("\n");
}

// Memoized so parseLyraMessage is not re-called on every parent re-render
// (e.g. during streaming of a different message or elapsed-seconds tick)
export const AssistantMessage = memo(function AssistantMessage({
  message,
  userQuery,
  onRelatedQuestionClick,
}: {
  message: Message;
  userQuery: string;
  onRelatedQuestionClick: (q: string) => void;
}) {
  const { text, sources, toolResults, relatedQuestions } = useMemo(
    () => parseLyraMessage(message.content),
    [message.content],
  );

  const formattedText = useMemo(() => formatTelemetryHeader(text), [text]);
  return (
    <div className="flex flex-col gap-1.5">
      <AnswerWithSources
        content={formattedText}
        sources={sources.length > 0 ? sources : message.sources || []}
        toolResults={toolResults}
        relatedQuestions={message.relatedQuestions?.length ? message.relatedQuestions : relatedQuestions}
        onRelatedQuestionClick={onRelatedQuestionClick}
        query={userQuery}
      />
      {message.contextTruncated && (
        <p className="text-[10px] text-muted-foreground/50 px-1 flex items-center gap-1">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-warning/60 shrink-0" />
          Context window capped — some older market data was trimmed to fit your plan’s limit.
        </p>
      )}
    </div>
  );
});
