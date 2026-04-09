import { Tool } from "ai";
import { z } from "zod";
import { createLogger } from "@/lib/logger";

const logger = createLogger({ service: "ai-tools" });

/**
 * Lyra tool registry.
 * Tools here are callable by the LLM via streamText's `tools` param.
 * Each tool must have a strict Zod input schema — no `z.any()` or `z.unknown()`.
 *
 * Per-tier allowlists prevent STARTER/PRO from accessing expensive tools.
 * Pattern: `getAllowedTools(tier)` → subset of aiTools for that tier.
 *
 * Tool validation workflow:
 * 1. Tool must have a strict Zod schema (no z.any(), z.unknown())
 * 2. Tool must have an execute function defined
 * 3. Tool must be explicitly added to allowlist before activation
 * 4. Tool handler must be tested before production deployment
 */
export const aiTools: Record<string, Tool> = {
  // ─── Reserved for future LLM-callable tools ──────────────────────────────
  // Example shape (do not activate without backend handler):
  //
  // get_asset_price: tool({
  //   description: "Fetch the current price and basic scores for a single asset symbol.",
  //   parameters: z.object({
  //     symbol: z.string().min(1).max(10).describe("Asset ticker symbol e.g. AAPL, BTC, RELIANCE.NS"),
  //   }),
  //   execute: async ({ symbol }) => { ... }
  // ),
};

// ─── Per-tier tool allowlists ─────────────────────────────────────────────
// STARTER: no LLM-callable tools (all context pre-assembled server-side)
// PRO: no LLM-callable tools (context pre-assembled; web search runs server-side)
// ELITE: allow tools when registry is non-empty (future: get_asset_price)
// ENTERPRISE: same as ELITE + future portfolio tools
const TOOL_ALLOWLIST: Record<string, readonly string[]> = {
  STARTER:    [],
  PRO:        [],
  ELITE:      [], // extend when tools are activated
  ENTERPRISE: [], // extend when tools are activated
};

/**
 * Validates a tool before activation.
 * Ensures the tool has a strict schema and execute function.
 * Throws an error if validation fails.
 */
export function validateToolDefinition(toolKey: string, tool: Tool): void {
  if (!tool.inputSchema) {
    throw new Error(`Tool "${toolKey}" is missing inputSchema`);
  }

  // Check for unsafe schema types
  const schemaStr = JSON.stringify(tool.inputSchema);
  if (schemaStr.includes('"any"') || schemaStr.includes('"unknown"')) {
    throw new Error(`Tool "${toolKey}" has unsafe schema type (any/unknown). Use strict Zod types.`);
  }

  // Check if execute function exists
  if (!tool.execute) {
    throw new Error(`Tool "${toolKey}" is missing execute function`);
  }
}

/**
 * Returns the allowed tool subset for a given plan tier.
 * Validates each tool before returning it.
 * Empty object = no tools passed to streamText (current behaviour for all tiers).
 */
export function getAllowedTools(
  planTier: string,
): Record<string, Tool> {
  const allowed = TOOL_ALLOWLIST[planTier] ?? [];
  if (allowed.length === 0) return {};

  const tools: Record<string, Tool> = {};
  for (const [key, tool] of Object.entries(aiTools)) {
    if ((allowed as string[]).includes(key)) {
      // Validate tool before activation
      try {
        validateToolDefinition(key, tool);
        tools[key] = tool;
      } catch (error) {
        logger.error({ toolKey: key, error }, "Tool validation failed");
        // Skip invalid tools rather than crashing
        continue;
      }
    }
  }

  return tools;
}

// Expose zod for tool definitions added in this file
export { z };
