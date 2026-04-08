/**
 * Strict Type Definitions for AI Service
 *
 * Replaces all `any` types with proper TypeScript interfaces
 */

import { TextPart, ToolCallPart, ToolResultPart } from "ai";

/**
 * Content types for AI messages
 */
export type MessageContent =
  | string
  | Array<TextPart | ToolCallPart | ToolResultPart>;

/**
 * Lyra message format (compatible with CoreMessage)
 */
/**
 * Lyra message format
 */
import { ModelMessage } from "ai";
export type LyraMessage = ModelMessage;

/**
 * Factor data structure from database
 */
export interface FactorData {
  value: number;
  growth: number;
  momentum: number;
  volatility: number;
}

/**
 * Correlation data structure from database
 */
export interface CorrelationData {
  SPY: number;
  QQQ: number;
  "BTC-USD": number;
  GLD: number;
  [benchmark: string]: number;
}

/**
 * Asset data from sync service
 */
export interface SyncedAsset {
  id: string;
  symbol: string;
  name: string;
  type: string;
  price: number | null;
  changePercent: number | null;
  lastPriceUpdate: Date | null;
  sector: string | null;
  exchange: string | null;
  factorData: FactorData | null;
  correlationData: CorrelationData | null;
}

/**
 * Knowledge source from RAG retrieval
 */
export interface KnowledgeSource {
  id: string;
  content: string;
  metadata: {
    source: string;
    relevance: number;
    [key: string]: unknown;
  };
}

/**
 * User memory from RAG
 */
export interface UserMemory {
  id: string;
  query: string;
  response: string;
  timestamp: Date;
  context?: Record<string, unknown>;
}

/**
 * Streaming response metadata
 */
export interface StreamMetadata {
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason?: "stop" | "length" | "content-filter" | "tool-calls";
}

/**
 * Chat interface props
 */
export interface ChatInterfaceProps {
  initialMessages?: LyraMessage[];
  contextData: {
    symbol?: string;
    regime?: string;
    scores?: Record<string, number>;
    [key: string]: unknown;
  };
}

/**
 * Error response from catch blocks
 */
export interface APIError {
  message: string;
  code?: string;
  status?: number;
  details?: unknown;
}
