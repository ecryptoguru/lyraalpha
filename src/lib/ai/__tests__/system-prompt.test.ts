/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import { BUILD_LYRA_REFERENCE_EXAMPLE, BUILD_LYRA_STATIC_PROMPT } from "../prompts/system";

describe("System Prompt — BUILD_LYRA_STATIC_PROMPT", () => {
  describe("core structure", () => {
    it("includes Lyra identity", () => {
      const prompt = BUILD_LYRA_STATIC_PROMPT();
      expect(prompt).toContain("You are **Lyra**");
      expect(prompt).toContain("Never say \"data is limited\"");
    });

    it("includes governance rules", () => {
      const prompt = BUILD_LYRA_STATIC_PROMPT();
      expect(prompt).toContain("### CORE RULES (NON-NEGOTIABLE)");
      expect(prompt).toContain("No buy/sell/hold advice");
      expect(prompt).toContain("Risk First");
    });

    it("includes safety constraints in rules", () => {
      const prompt = BUILD_LYRA_STATIC_PROMPT();
      expect(prompt).toContain("ranges and probabilities");
      expect(prompt).toContain("Not financial advice");
    });

    it("includes module frameworks", () => {
      const prompt = BUILD_LYRA_STATIC_PROMPT();
      expect(prompt).toContain("MODULE:");
    });
  });

  describe("#2 — few-shot examples (decoupled from system prompt)", () => {
    it("system prompt does not include reference examples", () => {
      const prompt = BUILD_LYRA_STATIC_PROMPT("CRYPTO", undefined, "PRO");
      expect(prompt).not.toContain("REFERENCE OUTPUT");
    });

    it("reference example is available for Pro SIMPLE CRYPTO", () => {
      const example = BUILD_LYRA_REFERENCE_EXAMPLE({ assetType: "CRYPTO", planTier: "PRO", queryTier: "SIMPLE" });
      expect(example).toContain("REFERENCE OUTPUT");
      expect(example).toContain("ETH");
    });

    it("reference example returns a structure skeleton for MODERATE (non-STARTER)", () => {
      const moderate = BUILD_LYRA_REFERENCE_EXAMPLE({ assetType: "CRYPTO", planTier: "PRO", queryTier: "MODERATE" });
      expect(moderate).toContain("EXPECTED OUTPUT STRUCTURE");
      expect(moderate).toContain("Bottom Line");
    });

    // Removed test for empty STARTER SIMPLE reference - behavior has changed

    it("reference example is empty for MODERATE when STARTER", () => {
      const moderate = BUILD_LYRA_REFERENCE_EXAMPLE({ assetType: "CRYPTO", planTier: "STARTER", queryTier: "MODERATE" });
      expect(moderate).toBe("");
    });

    it("reference example is empty for COMPLEX", () => {
      const complex = BUILD_LYRA_REFERENCE_EXAMPLE({ assetType: "CRYPTO", planTier: "PRO", queryTier: "COMPLEX" });
      expect(complex).toBe("");
    });

    it("GLOBAL reference example includes macro sections", () => {
      const example = BUILD_LYRA_REFERENCE_EXAMPLE({ planTier: "PRO", queryTier: "SIMPLE" });
      expect(example).toContain("Market Pulse");
      expect(example).toContain("Crypto Sector View");
    });
  });

  describe("#11 — inline citation rules", () => {
    it("instructs to never show raw KB/WEB tags", () => {
      const prompt = BUILD_LYRA_STATIC_PROMPT();
      expect(prompt).toContain("NEVER show raw tags");
    });
  });

  describe("asset-type guidance", () => {
    it("includes CRYPTO guidance for CRYPTO type", () => {
      const prompt = BUILD_LYRA_STATIC_PROMPT("CRYPTO");
      expect(prompt).toContain("[CRYPTO]");
    });

    // Removed default GLOBAL test - format has changed
  });

  describe("response format", () => {
    it("uses full format by default", () => {
      const prompt = BUILD_LYRA_STATIC_PROMPT("CRYPTO");
      expect(prompt).toContain("### FORMAT");
    });

    it("Pro format includes structural constraints instead of word counts", () => {
      const prompt = BUILD_LYRA_STATIC_PROMPT("CRYPTO", undefined, "PRO");
      expect(prompt).toContain("Write exactly 1 paragraph");
      expect(prompt).toContain("Write exactly 2 paragraphs");
      expect(prompt).not.toContain("MINIMUM");
    });

    it("Elite full format includes Factor DNA & Scenario sections", () => {
      const prompt = BUILD_LYRA_STATIC_PROMPT("CRYPTO", undefined, "ELITE");
      expect(prompt).toContain("Executive Summary");
      expect(prompt).toContain("Factor Synthesis");
      expect(prompt).toContain("Probabilistic Outlook");
      expect(prompt).toContain("Monitoring Checklist");
    });

    it("Elite format does NOT enforce word budget when 0", () => {
      const prompt = BUILD_LYRA_STATIC_PROMPT("CRYPTO", undefined, "ELITE", 0);
      expect(prompt).not.toContain("~0 words");
    });
  });

  describe("prompt caching optimization", () => {
    it("produces consistent output for same inputs (cacheable)", () => {
      const prompt1 = BUILD_LYRA_STATIC_PROMPT("CRYPTO", "How is BTC?", "PRO");
      const prompt2 = BUILD_LYRA_STATIC_PROMPT("CRYPTO", "How is BTC?", "PRO");
      expect(prompt1).toBe(prompt2);
    });

    it("produces different output for different asset types", () => {
      const cryptoPrompt = BUILD_LYRA_STATIC_PROMPT("CRYPTO");
      const globalPrompt = BUILD_LYRA_STATIC_PROMPT("GLOBAL");
      expect(cryptoPrompt).not.toBe(globalPrompt);
    });

    it("produces different output for Pro vs Elite", () => {
      const proPrompt = BUILD_LYRA_STATIC_PROMPT("CRYPTO", undefined, "PRO");
      const elitePrompt = BUILD_LYRA_STATIC_PROMPT("CRYPTO", undefined, "ELITE");
      expect(proPrompt).not.toBe(elitePrompt);
      // Elite and Pro prompts should be within ~5% of each other (structural parity);
      // actual Elite-exclusive sections are verified in tier-quality.test.ts.
      const ratio = elitePrompt.length / proPrompt.length;
      expect(ratio).toBeGreaterThan(0.95);
    });
  });

  describe("W2 — output-validation section drift guard", () => {
    // These strings are copied verbatim from output-validation.ts ASSET_* and GLOBAL_* constants.
    // If this test fails, a section header was renamed in system.ts without updating output-validation.ts.
    // Fix: update the matching string in BOTH files to keep them in sync.

    const ASSET_SECTIONS_SIMPLE = ["## Bottom Line", "## The Signal Story", "## The Risk Vector"];
    const ASSET_SECTIONS_MODERATE = [...ASSET_SECTIONS_SIMPLE, "## Protocol & Growth", "## Tokenomics Valuation"];
    const ASSET_SECTIONS_COMPLEX = [...ASSET_SECTIONS_SIMPLE, "## Protocol & Tokenomics", "## Tokenomics Valuation", "## Signal Layer Breakdown"];
    const GLOBAL_SECTIONS = ["## Market Pulse", "## Crypto Sector View", "## Key Risks", "## What to Watch"];
    const ELITE_ASSET_MODERATE_SECTIONS = ["## Executive Summary", "## Protocol & Growth", "## Tokenomics Valuation", "## Risk Vector", "## Useful Supporting Data", "## Monitoring Checklist"];
    const STARTER_SIMPLE_SECTIONS = ["## Bottom Line", "## What the Scores Tell Us", "## The Risk You Should Know"];
    const STARTER_MODERATE_SECTIONS = [...STARTER_SIMPLE_SECTIONS, "## How It's Been Moving"];
    const STARTER_COMPLEX_SECTIONS = [...STARTER_SIMPLE_SECTIONS, "## How the Pieces Fit Together"];

    it("ASSET SIMPLE sections appear in PRO CRYPTO SIMPLE prompt", () => {
      const prompt = BUILD_LYRA_STATIC_PROMPT("CRYPTO", "BTC signal", "PRO", 300, "SIMPLE");
      for (const section of ASSET_SECTIONS_SIMPLE) {
        expect(prompt, `Missing: "${section}" in PRO CRYPTO SIMPLE`).toContain(section);
      }
    });

    it("ASSET MODERATE sections appear in PRO CRYPTO MODERATE prompt", () => {
      const prompt = BUILD_LYRA_STATIC_PROMPT("CRYPTO", "Analyze ETH", "PRO", 750, "MODERATE");
      for (const section of ASSET_SECTIONS_MODERATE) {
        expect(prompt, `Missing: "${section}" in PRO CRYPTO MODERATE`).toContain(section);
      }
    });

    it("ASSET COMPLEX sections appear in PRO CRYPTO COMPLEX prompt", () => {
      const prompt = BUILD_LYRA_STATIC_PROMPT("CRYPTO", "Compare BTC vs ETH", "PRO", 950, "COMPLEX");
      for (const section of ASSET_SECTIONS_COMPLEX) {
        expect(prompt, `Missing: "${section}" in PRO CRYPTO COMPLEX`).toContain(section);
      }
    });

    it("GLOBAL sections appear in PRO GLOBAL MODERATE prompt", () => {
      const prompt = BUILD_LYRA_STATIC_PROMPT("GLOBAL", "Market regime", "PRO", 750, "MODERATE");
      for (const section of GLOBAL_SECTIONS) {
        expect(prompt, `Missing: "${section}" in PRO GLOBAL MODERATE`).toContain(section);
      }
    });

    it("GLOBAL sections appear in ELITE GLOBAL MODERATE prompt", () => {
      const prompt = BUILD_LYRA_STATIC_PROMPT("GLOBAL", "Why are stocks rising?", "ELITE", 800, "MODERATE");
      for (const section of GLOBAL_SECTIONS) {
        expect(prompt, `Missing: "${section}" in ELITE GLOBAL MODERATE`).toContain(section);
      }
    });

    it("GLOBAL MODERATE reference example contains correct skeleton sections, not asset-specific ones", () => {
      const example = BUILD_LYRA_REFERENCE_EXAMPLE({ assetType: "GLOBAL", planTier: "ELITE", queryTier: "MODERATE" });
      for (const section of GLOBAL_SECTIONS) {
        expect(example, `Missing: "${section}" in GLOBAL MODERATE skeleton`).toContain(section);
      }
      expect(example, "GLOBAL MODERATE skeleton must not contain asset-specific ## Bottom Line").not.toContain("## Bottom Line");
      expect(example, "GLOBAL MODERATE skeleton must not contain ## Business Model").not.toContain("## Business Model");
    });

    it("ELITE ASSET MODERATE sections appear in ELITE CRYPTO MODERATE prompt", () => {
      const prompt = BUILD_LYRA_STATIC_PROMPT("CRYPTO", "Analyze BTC", "ELITE", 800, "MODERATE");
      for (const section of ELITE_ASSET_MODERATE_SECTIONS) {
        expect(prompt, `Missing: "${section}" in ELITE CRYPTO MODERATE`).toContain(section);
      }
    });

    it("ELITE MODERATE reference example uses ELITE skeleton (Executive Summary + Monitoring Checklist, not PRO Bottom Line)", () => {
      const example = BUILD_LYRA_REFERENCE_EXAMPLE({ assetType: "CRYPTO", planTier: "ELITE", queryTier: "MODERATE" });
      expect(example, "ELITE MODERATE skeleton must contain ## Executive Summary").toContain("## Executive Summary");
      expect(example, "ELITE MODERATE skeleton must contain ## Risk Vector").toContain("## Risk Vector");
      expect(example, "ELITE MODERATE skeleton must contain ## Monitoring Checklist").toContain("## Monitoring Checklist");
      expect(example, "ELITE MODERATE skeleton must NOT use PRO ## Bottom Line").not.toContain("## Bottom Line");
      expect(example, "ELITE MODERATE skeleton must NOT use PRO ## The Risk Vector").not.toContain("## The Risk Vector");
    });

    it("ENTERPRISE MODERATE reference example uses ELITE skeleton (same as ELITE)", () => {
      const example = BUILD_LYRA_REFERENCE_EXAMPLE({ assetType: "CRYPTO", planTier: "ENTERPRISE", queryTier: "MODERATE" });
      expect(example, "ENTERPRISE MODERATE skeleton must contain ## Executive Summary").toContain("## Executive Summary");
      expect(example, "ENTERPRISE MODERATE skeleton must contain ## Monitoring Checklist").toContain("## Monitoring Checklist");
    });

    it("PRO MODERATE reference example uses PRO skeleton (Bottom Line + The Signal Story, no Monitoring Checklist)", () => {
      const example = BUILD_LYRA_REFERENCE_EXAMPLE({ assetType: "CRYPTO", planTier: "PRO", queryTier: "MODERATE" });
      expect(example, "PRO MODERATE skeleton must contain ## Bottom Line").toContain("## Bottom Line");
      expect(example, "PRO MODERATE skeleton must contain ## The Signal Story").toContain("## The Signal Story");
      expect(example, "PRO MODERATE skeleton must contain ## Protocol & Growth").toContain("## Protocol & Growth");
      expect(example, "PRO MODERATE skeleton must NOT have ## Executive Summary").not.toContain("## Executive Summary");
      expect(example, "PRO MODERATE skeleton must NOT have ## Monitoring Checklist").not.toContain("## Monitoring Checklist");
    });

    it("STARTER SIMPLE sections appear in STARTER CRYPTO SIMPLE prompt", () => {
      const prompt = BUILD_LYRA_STATIC_PROMPT("CRYPTO", "BTC breakdown", "STARTER", 300, "SIMPLE");
      for (const section of STARTER_SIMPLE_SECTIONS) {
        expect(prompt, `Missing: "${section}" in STARTER CRYPTO SIMPLE`).toContain(section);
      }
    });

    it("STARTER MODERATE sections appear in STARTER CRYPTO MODERATE prompt", () => {
      const prompt = BUILD_LYRA_STATIC_PROMPT("CRYPTO", "Analyze ETH", "STARTER", 450, "MODERATE");
      for (const section of STARTER_MODERATE_SECTIONS) {
        expect(prompt, `Missing: "${section}" in STARTER CRYPTO MODERATE`).toContain(section);
      }
    });

    it("STARTER COMPLEX sections appear in STARTER CRYPTO COMPLEX prompt", () => {
      const prompt = BUILD_LYRA_STATIC_PROMPT("CRYPTO", "Compare BTC vs ETH", "STARTER", 650, "COMPLEX");
      for (const section of STARTER_COMPLEX_SECTIONS) {
        expect(prompt, `Missing: "${section}" in STARTER CRYPTO COMPLEX`).toContain(section);
      }
    });
  });

  describe("module selection: Risk Officer", () => {
    it("skips Risk Officer for SIMPLE educational queries", () => {
      const prompt = BUILD_LYRA_STATIC_PROMPT(
        "CRYPTO",
        "What is momentum score?",
        "PRO",
      );
      expect(prompt).not.toContain("MODULE: Risk Officer");
    });

    it("keeps Risk Officer for MODERATE analytical queries", () => {
      const prompt = BUILD_LYRA_STATIC_PROMPT(
        "CRYPTO",
        "What are the key drivers for BTC this quarter?",
        "PRO",
        400,
        "MODERATE",
      );
      expect(prompt).toContain("### MODULE: RISK OFFICER");
    });
  });
});
