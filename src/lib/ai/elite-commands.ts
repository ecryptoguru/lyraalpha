/**
 * Elite Slash Command Parser
 * Parses /command args from Lyra chat input and returns structured command objects.
 * Commands are Elite-only and inject structured context into the Lyra pipeline.
 */

export type EliteCommandType =
  | "compare"
  | "deepdive"
  | "stress-test"
  | "watchlist-audit"
  | "regime-backtest";

export interface EliteCommand {
  type: EliteCommandType;
  args: string[];
  rawInput: string;
  /** Pre-built query to send to Lyra after context injection */
  lyraQuery: string;
}

const COMMAND_PATTERNS: Array<{
  pattern: RegExp;
  type: EliteCommandType;
  buildQuery: (args: string[]) => string;
}> = [
  {
    pattern: /^\/compare\s+(.+)$/i,
    type: "compare",
    buildQuery: (args) =>
      `Compare these assets side-by-side: ${args.join(", ")}. Analyze their Signal Strength, regime alignment, risk/reward and which offers the best risk-adjusted opportunity right now. Be specific about the winner and why.`,
  },
  {
    pattern: /^\/deepdive\s+(\S+)(?:\s+(.*))?$/i,
    type: "deepdive",
    buildQuery: (args) =>
      `Provide a comprehensive institutional deep-dive on ${args[0]}. Cover: 1) Bottom line conviction, 2) Full bull vs bear case with specific price levels, 3) Risk/reward asymmetry, 4) Regime positioning and factor alignment, 5) Key catalysts and monitoring triggers. Use all available data. No word limit.`,
  },
  {
    pattern: /^\/stress-test\s+(\S+)(?:\s+(.*))?$/i,
    type: "stress-test",
    buildQuery: (args) => {
      const scenario = args[1] || "rate shock";
      return `Stress test ${args[0]} against a ${scenario} scenario. Analyze: 1) Historical behavior during similar regimes, 2) Expected drawdown magnitude, 3) Key vulnerability factors, 4) Hedging strategies, 5) Recovery timeline expectations.`;
    },
  },
  {
    pattern: /^\/watchlist-audit$/i,
    type: "watchlist-audit",
    buildQuery: () =>
      `Audit my entire watchlist holistically. Analyze: 1) Overall regime alignment — which assets are well-positioned vs misaligned, 2) Factor concentration risk — am I over-exposed to any single factor, 3) Correlation risk — which assets move together (hidden concentration), 4) Top 3 highest-conviction positions and why, 5) Top 2 positions to reconsider. Be direct and specific.`,
  },
  {
    pattern: /^\/regime-backtest\s+(\S+)$/i,
    type: "regime-backtest",
    buildQuery: (args) =>
      `Backtest ${args[0]} across historical regime states. For each regime (Strong Risk-On, Risk-On, Neutral, Defensive, Risk-Off): 1) How did this asset's scores and price behave? 2) What was the typical drawdown vs upside? 3) What does the current regime imply for this asset based on historical analogs?`,
  },
];

export const ELITE_COMMAND_DEFINITIONS = [
  {
    command: "/compare",
    syntax: "/compare AAPL MSFT NVDA",
    description: "Side-by-side multi-asset analysis with Lyra synthesis",
    example: "/compare BTC-USD ETH-USD SOL-USD",
  },
  {
    command: "/deepdive",
    syntax: "/deepdive SYMBOL",
    description: "Full institutional deep-dive — all modules, no word cap",
    example: "/deepdive NVDA",
  },
  {
    command: "/stress-test",
    syntax: "/stress-test SYMBOL [scenario]",
    description: "Stress test against rate shock, crash, or custom scenario",
    example: "/stress-test AAPL rate shock",
  },
  {
    command: "/watchlist-audit",
    syntax: "/watchlist-audit",
    description: "Holistic audit of your entire watchlist — regime fit, concentration, risk",
    example: "/watchlist-audit",
  },
  {
    command: "/regime-backtest",
    syntax: "/regime-backtest SYMBOL",
    description: "How did this asset behave across all historical regime states?",
    example: "/regime-backtest SPY",
  },
];

/**
 * Parse a user input string for Elite slash commands.
 * Returns null if not a command or not recognized.
 */
export function parseEliteCommand(input: string): EliteCommand | null {
  const trimmed = input.trim();
  if (!trimmed.startsWith("/")) return null;

  for (const def of COMMAND_PATTERNS) {
    const match = trimmed.match(def.pattern);
    if (match) {
      // Extract args: match[1] is first capture group, split by whitespace for multi-symbol
      const rawArgs = match[1] ? match[1].trim().split(/\s+/) : [];
      const extraArg = match[2] ? match[2].trim() : undefined;
      const args = extraArg ? [rawArgs[0], extraArg] : rawArgs;

      return {
        type: def.type,
        args,
        rawInput: trimmed,
        lyraQuery: def.buildQuery(args),
      };
    }
  }

  return null;
}

/**
 * Check if input starts with / to show command suggestions
 */
export function isCommandInput(input: string): boolean {
  return input.trim().startsWith("/");
}

/**
 * Get matching command suggestions for autocomplete
 */
export function getCommandSuggestions(input: string) {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed.startsWith("/")) return [];
  return ELITE_COMMAND_DEFINITIONS.filter((d) =>
    d.command.startsWith(trimmed.split(" ")[0])
  );
}
