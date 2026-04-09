import { Tool } from "ai";

/**
 * Lyra tool registry.
 * Tools here are callable by the LLM via streamText's `tools` param.
 * Currently empty - all context is pre-assembled server-side for all tiers.
 *
 * Future: When tools are activated (e.g., get_asset_price), add them here
 * and update the function to return tier-specific subsets.
 */
export const aiTools: Record<string, Tool> = {
  // ─── Reserved for future LLM-callable tools ──────────────────────────────
  // Example shape (do not activate without backend handler):
  //
  // get_asset_price: tool({
  //   description: "Fetch the current price and basic scores for a single asset symbol.",
  //   parameters: z.object({
  //     symbol: z.string().min(1).max(10).describe("Asset ticker symbol e.g. BTC, ETH, SOL"),
  //   }),
  //   execute: async ({ symbol }) => { ... }
  //),
};

/**
 * Returns the allowed tool subset for a given plan tier.
 * Currently returns empty object for all tiers (no tools activated).
 *
 * Future: When tools are activated, add planTier parameter and return tier-specific subsets.
 */
export function getAllowedTools(): Record<string, Tool> {
  // No tools activated for any tier currently
  return {};
}
