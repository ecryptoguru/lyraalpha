"use client";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExternalLink, Copy, Check, Database, Globe, BrainCircuit, ChevronDown, ChevronUp } from "lucide-react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { motion, AnimatePresence } from "framer-motion";
import { useState, memo, lazy, Suspense, useEffect, useMemo } from "react";
const StockChart = lazy(() => import("./stock-chart").then(m => ({ default: m.StockChart })));
import { FinancialTable } from "./financial-table";
import {
  Source,
  ToolResult,
  StockAnalysisResult,
  MarketRegimeResult,
} from "@/lib/lyra-utils";
import { cn } from "@/lib/utils";
import { RelatedQuestions } from "./related-questions";
import { ResponseFeedback } from "./response-feedback";

function parseLyraResponse(raw: string) {
  let thinkingContent = "";
  let isThinkingOpen = false;

  const thinkingMatch = raw.match(/<thinking>([\s\S]*?)(?:<\/thinking>|$)/i);
  if (thinkingMatch) {
    thinkingContent = thinkingMatch[1].trim();
    isThinkingOpen = !/<\/thinking>/i.test(raw);
  }

  const thoughtMatch = raw.match(/<thought>([\s\S]*?)(?:<\/thought>|$)/i);
  if (thoughtMatch && !thinkingMatch) {
    thinkingContent = thoughtMatch[1].trim();
    isThinkingOpen = !/<\/thought>/i.test(raw);
  }

  const withoutBlocks = raw
    .replace(/<thinking>[\s\S]*?(?:<\/thinking>|$)/gi, "")
    .replace(/<thought>[\s\S]*?(?:<\/thought>|$)/gi, "")
    // Strip <!--SIGNALS:{...}--> chip emitted by Elite COMPLEX — rendered as chips elsewhere
    .replace(/<!--SIGNALS:[^>]*-->/gi, "")
    .split("\n")
    .filter((l) => !/^\s*scaffold\s*:/i.test(l))
    .join("\n")
    .trim();

  // anchorMatch removed: all current prompt formats (Elite, PRO, Global, Starter) start
  // directly with ## headers. Slicing to an anchor would silently drop content if the model
  // places ## Market Pulse / ## Bottom Line mid-response on a non-matching query type.

  // Expand score shorthands only in prose — skip table cells (where the token is
  // preceded by | or whitespace-after-| so GFM pipe syntax stays intact).
  // Negative lookbehind: do NOT replace when preceded by | or "| " (table cell boundary).
  const finalContent = withoutBlocks
    .replace(/(?<![|]\s*)\bT:/g, "Trend:")
    .replace(/(?<![|]\s*)\bM:/g, "Momentum:")
    .replace(/(?<![|]\s*)\bV:/g, "Volatility:")
    .replace(/(?<![|]\s*)\bL:/g, "Liquidity:")
    .replace(/(?<![|]\s*)\bS:/g, "Sentiment:")
    .trim();

  return { finalContent, thinkingContent, isThinkingOpen };
}

function ThinkingProcess({ content, isThinking }: { content: string, isThinking: boolean }) {
  const [expanded, setExpanded] = useState(isThinking);

  useEffect(() => {
    if (isThinking) {
      const t = setTimeout(() => setExpanded(true), 0);
      return () => clearTimeout(t);
    }
  }, [isThinking]);

  if (!content) return null;

  return (
    <div className="mb-6 rounded-2xl border border-primary/20 bg-primary/5 shadow-inner overflow-hidden">
      <button 
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-primary/10 hover:bg-primary/20 transition-colors"
      >
        <div className="flex items-center gap-2">
           <BrainCircuit className={cn("w-4 h-4 text-primary", isThinking && "animate-pulse")} />
           <span className="text-xs font-bold uppercase tracking-wider text-primary">
             {isThinking ? "Lyra is Thinking..." : "Reasoning Process"}
           </span>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-primary/60" /> : <ChevronDown className="w-4 h-4 text-primary/60" />}
      </button>
      <AnimatePresence>
        {expanded && (
           <motion.div 
             initial={{ height: 0, opacity: 0 }} 
             animate={{ height: "auto", opacity: 1 }} 
             exit={{ height: 0, opacity: 0 }}
             className="px-4 border-t border-primary/10"
           >
             <div className="py-4 prose prose-sm dark:prose-invert text-muted-foreground max-w-none text-xs leading-relaxed italic border-l-2 border-primary/30 pl-4 my-2">
               <ReactMarkdown>{content}</ReactMarkdown>
             </div>
           </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface AnswerWithSourcesProps {
  content: string;
  sources?: Source[];
  className?: string;
  toolResults?: ToolResult[];
  relatedQuestions?: string[];
  onRelatedQuestionClick?: (question: string) => void;
  showSources?: boolean;
  query?: string;
  queryTier?: string;
  model?: string;
}

export const AnswerWithSources = memo(function AnswerWithSources({
  content,
  sources = [],
  className,
  toolResults = [],
  relatedQuestions = [],
  onRelatedQuestionClick,
  showSources = true,
  query = "",
  queryTier,
  model,
}: AnswerWithSourcesProps) {
  const [copied, setCopied] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const sourcesPerPage = 5;

  const { finalContent: mainContent, thinkingContent, isThinkingOpen } = parseLyraResponse(content);

  // Stable 8-char hex id derived from raw content — unique per answer, stable across re-renders.
  // Uses djb2 hash: fast, no crypto dependency, runs on the client.
  const answerId = useMemo(() => {
    const seed = content.slice(0, 500);
    let hash = 5381;
    for (let i = 0; i < seed.length; i++) {
      hash = (Math.imul(hash, 33) ^ seed.charCodeAt(i)) >>> 0;
    }
    return hash.toString(16).padStart(8, "0");
  }, [content]);

  const totalPages = Math.ceil(sources.length / sourcesPerPage);
  const paginatedSources = sources.slice(
    (currentPage - 1) * sourcesPerPage,
    currentPage * sourcesPerPage,
  );

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={cn(
        "bg-card/60 backdrop-blur-2xl border border-white/5 shadow-xl rounded-3xl overflow-hidden flex flex-col",
        className,
      )}
    >
      <Tabs defaultValue="answer" className="w-full flex-1 flex flex-col">
        <div className="surface-elevated px-4 pt-3 shrink-0 border-b border-border backdrop-blur-xl z-20">
          <div className="flex items-center justify-between mb-2">
            <TabsList className="h-10 bg-muted/40 dark:bg-black/20 p-1 border border-border rounded-2xl">
              <TabsTrigger
                value="answer"
                className="text-xs font-bold uppercase tracking-wider px-4 data-[state=active]:bg-primary/20 data-[state=active]:text-primary data-[state=active]:border-primary/20"
              >
                Insight
              </TabsTrigger>
              {showSources && (
                <TabsTrigger
                  value="sources"
                  className="text-xs font-bold uppercase tracking-wider px-4 data-[state=active]:bg-primary/20 data-[state=active]:text-primary data-[state=active]:border-primary/20"
                >
                  Sources {sources.length > 0 && `(${sources.length})`}
                </TabsTrigger>
              )}
            </TabsList>

            <Button
              variant="ghost"
              size="icon"
              onClick={handleCopy}
              className="h-10 w-10 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all rounded-2xl"
              title="Copy Terminal Output"
            >
              {copied ? (
                <Check className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        <TabsContent
          value="answer"
          className="p-0 mt-0 flex-1 min-h-0 overflow-y-auto data-[state=inactive]:hidden"
        >
          <div className="px-6 md:px-10 py-6">
            {/* Tool Results / Rich Widgets */}
            {toolResults &&
              toolResults.map((result: ToolResult, idx: number) => {
              if (result.toolName === "get_stock_analysis") {
                const stockResult = result.result as StockAnalysisResult;
                return (
                  <div key={idx} className="space-y-6 mb-6">
                    <Suspense fallback={<div className="h-48 animate-pulse rounded-xl bg-muted" />}>
                      <StockChart symbol={stockResult.symbol} />
                    </Suspense>
                    <FinancialTable
                      title="Valuation Metrics"
                      data={stockResult.valuation}
                    />
                    <FinancialTable
                      title="Key Takeaways (Asset Quality)"
                      data={stockResult.highlights.map(
                        (h: { segment: string; takeaway: string }) => ({
                          metric: h.segment,
                          value: "Analysis",
                          context: h.takeaway,
                        }),
                      )}
                    />
                  </div>
                );
              }
              if (result.toolName === "get_market_regime") {
                const regimeResult = result.result as MarketRegimeResult;
                return (
                  <FinancialTable
                    key={idx}
                    title="Market Regime Analysis"
                    data={[
                      { metric: "State", value: regimeResult.state },
                      { metric: "Market Breadth", value: regimeResult.breadth },
                      { metric: "VIX (Volatility)", value: regimeResult.vix },
                      {
                        metric: "Macro Narrative",
                        value: "Summary",
                        context: regimeResult.narrative,
                      },
                    ]}
                  />
                );
              }
              return null;
            })}

          {thinkingContent && <ThinkingProcess content={thinkingContent} isThinking={isThinkingOpen} />}

          <div className="prose prose-sm dark:prose-invert max-w-none wrap-break-word overflow-x-hidden">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ children }) => (
                  <h1 className="text-xl font-bold mt-6 mb-3 first:mt-0 wrap-break-word">
                    {children}
                  </h1>
                ),
                h2: ({ children }) => (
                  <h2 className="text-lg font-semibold mt-5 mb-2 first:mt-0 wrap-break-word">
                    {children}
                  </h2>
                ),
                h3: ({ children }) => (
                  <h3 className="text-base font-semibold mt-4 mb-2 first:mt-0 wrap-break-word">
                    {children}
                  </h3>
                ),
                p: ({ children }) => (
                  <p className="text-sm mb-3 last:mb-0 leading-relaxed wrap-break-word">
                    {children}
                  </p>
                ),
                ul: ({ children }) => (
                  <ul className="text-sm space-y-1.5 my-3 list-disc pl-5 wrap-break-word">
                    {children}
                  </ul>
                ),
                ol: ({ children }) => (
                  <ol className="text-sm space-y-1.5 my-3 list-decimal pl-5 wrap-break-word">
                    {children}
                  </ol>
                ),
                li: ({ children, node, ...props }) => {
                  // GFM task list items contain a checkbox input — suppress the bullet dot for those
                  const isTaskItem = node?.children?.some(
                    (child: { type: string; tagName?: string }) => child.type === "element" && child.tagName === "input"
                  );
                  return (
                    <li
                      className={`text-sm leading-relaxed wrap-break-word ${
                        isTaskItem ? "list-none -ml-5 flex items-start gap-2" : ""
                      }`}
                      {...props}
                    >
                      {children}
                    </li>
                  );
                },
                strong: ({ children }) => (
                  <strong className="font-bold text-foreground tracking-tight wrap-break-word">
                    {children}
                  </strong>
                ),
                table: ({ children }) => (
                  <div className="my-4 lg:my-6 overflow-x-auto rounded-2xl border border-border scrollbar-thin scrollbar-thumb-primary/10 scrollbar-track-transparent">
                    <table className="w-full text-sm">{children}</table>
                  </div>
                ),
                thead: ({ children }) => (
                  <thead className="surface-elevated">{children}</thead>
                ),
                tbody: ({ children }) => (
                  <tbody className="divide-y divide-border/30 dark:divide-white/5">{children}</tbody>
                ),
                tr: ({ children }) => (
                  <tr className="even:bg-muted/20">{children}</tr>
                ),
                th: ({ children }) => (
                  <th className="px-4 py-2.5 text-left font-bold text-[10px] uppercase tracking-wider text-muted-foreground">
                    {children}
                  </th>
                ),
                td: ({ children }) => (
                  <td className="px-4 py-3 text-sm">{children}</td>
                ),
                blockquote: ({ children }) => (
                  <blockquote className="border-l-4 border-primary/30 pl-4 italic my-4 text-muted-foreground bg-primary/5 py-2 rounded-r-lg">
                    {children}
                  </blockquote>
                ),
                a: ({ href, children }) => {
                  const isInternal = href?.startsWith("/");
                  return (
                    <a
                      href={href}
                      target={isInternal ? undefined : "_blank"}
                      rel={isInternal ? undefined : "noopener noreferrer"}
                      className="inline-flex items-center gap-1.5 px-4 py-2 mt-2 mb-1 rounded-2xl bg-primary/10 border border-primary/20 text-primary font-bold text-xs tracking-tight no-underline hover:bg-primary/20 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/10 transition-all duration-200 cursor-pointer group/cta"
                    >
                      {children}
                      <ExternalLink className="h-3 w-3 opacity-60 group-hover/cta:opacity-100 transition-opacity" />
                    </a>
                  );
                },
                code: ({ children, className }) => {
                  const isInline = !className;
                  return isInline ? (
                    <code className="bg-primary/10 text-primary px-1.5 py-0.5 rounded text-xs font-mono font-bold">
                      {children}
                    </code>
                  ) : (
                    <div className="my-4 relative group/code">
                      <code className="block bg-muted/50 dark:bg-black/40 p-4 rounded-2xl text-[11px] font-mono overflow-x-auto scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent border border-border leading-relaxed">
                        {children}
                      </code>
                    </div>
                  );
                },
              }}
            >
              {mainContent}
            </ReactMarkdown>
          </div>

          <ResponseFeedback
            answerId={answerId}
            query={query}
            responseSnippet={mainContent.slice(0, 250)}
            queryTier={queryTier}
            model={model}
          />

          </div>
        </TabsContent>

        {showSources && (
          <TabsContent
            value="sources"
            className="p-0 mt-0 flex-1 min-h-0 data-[state=inactive]:hidden"
          >
            {sources.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                No sources available for this response
              </div>
            ) : (
              <ScrollArea className="h-full w-full">
                <div className="grid gap-4 px-6 md:px-10 py-6">
                  {paginatedSources.map((source, idx) => (
                    <div
                      key={idx}
                      className="bg-card/60 backdrop-blur-2xl border border-white/5 shadow-xl surface-interactive p-5 rounded-2xl group/source transition-all duration-300 hover:scale-[1.01] hover:border-primary/30 mx-0.5"
                    >
                      <div className="flex items-start gap-4">
                        <div className="relative shrink-0">
                          <div className="p-3 rounded-2xl bg-primary/5 border border-primary/10 group-hover/source:bg-primary/10 group-hover/source:border-primary/20 transition-all">
                            {source.type === "knowledge_base" ? (
                              <Database className="h-5 w-5 text-primary" />
                            ) : (
                              <Globe className="h-5 w-5 text-primary" />
                            )}
                          </div>
                        </div>

                        <div className="flex-1 min-w-0 py-0.5">
                          <div className="flex items-center justify-between gap-3 mb-1.5">
                            <span className="text-[9px] font-bold uppercase tracking-widest text-primary/60">
                              {source.type === "knowledge_base"
                                ? "Intelligence Node"
                                : "Web Resource"}
                            </span>
                            {source.publishedDate && (
                              <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40">
                                {new Date(
                                  source.publishedDate,
                                ).toLocaleDateString()}
                              </span>
                            )}
                          </div>

                          <a
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group/link block"
                          >
                            <h4 className="text-sm font-bold text-foreground leading-snug group-hover/link:text-primary transition-colors flex items-center gap-2">
                              <span className="line-clamp-2">
                                {source.title}
                              </span>
                              <ExternalLink className="h-3 w-3 shrink-0 opacity-0 group-hover/link:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-all" />
                            </h4>
                          </a>

                          <div className="flex items-center gap-2 mt-2">
                            <p className="text-[10px] font-medium text-muted-foreground/60 truncate max-w-[240px] font-data">
                              {source.type === "knowledge_base"
                                ? "internal://knowledge-base"
                                : (() => {
                                    try {
                                      const host = new URL(source.url).hostname.replace(/^www\./, "");
                                      // Google grounding redirect URLs — show the title (actual domain) instead
                                      return host.includes("vertexaisearch") ? source.title : host;
                                    } catch { return source.title; }
                                  })()}
                            </p>
                          </div>

                          {source.description && source.description !== source.title && (
                            <p className="text-xs text-muted-foreground/70 mt-3 line-clamp-2 leading-relaxed italic border-l border-primary/10 pl-3">
                              {source.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-4 pb-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    <span className="text-xs text-muted-foreground px-2">
                      {currentPage} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setCurrentPage((p) => Math.min(totalPages, p + 1))
                      }
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                )}
                <ScrollBar orientation="vertical" />
              </ScrollArea>
            )}
          </TabsContent>
        )}
      </Tabs>

      {relatedQuestions && relatedQuestions.length > 0 && (
        <div className="px-6 md:px-10 pb-6 border-t border-white/5 bg-muted/20 dark:bg-black/5 pt-4 shrink-0">
          <RelatedQuestions
            questions={relatedQuestions}
            onQuestionClick={onRelatedQuestionClick || (() => {})}
          />
        </div>
      )}
    </div>
  );
});
