import { Tool } from "ai";
import { z } from "zod";

/**
 * Lyra tool registry.
 * Tools here are callable by the LLM via streamText's `tools` param.
 * Each tool must have a strict Zod input schema — no `z.any()` or `z.unknown()`.
 *
 * Per-tier allowlists prevent STARTER/PRO from accessing expensive tools.
 * Pattern: `getAllowedTools(tier)` → subset of aiTools for that tier.
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
  // }),
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
 * Returns the allowed tool subset for a given plan tier.
 * Empty object = no tools passed to streamText (current behaviour for all tiers).
 */
export function getAllowedTools(
  planTier: string,
): Record<string, Tool> {
  const allowed = TOOL_ALLOWLIST[planTier] ?? [];
  if (allowed.length === 0) return {};
  return Object.fromEntries(
    Object.entries(aiTools).filter(([key]) => (allowed as string[]).includes(key)),
  );
}

// Expose zod for tool definitions added in this file
export { z };
