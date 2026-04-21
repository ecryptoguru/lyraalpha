/**
 * @vitest-environment node
 *
 * RAG + prompt-pipeline golden-set regression eval.
 *
 * This test file protects three subsystems against silent regression:
 *
 *   1. Query classifier (`classifyQuery`) — catches prompt-tier drift where
 *      a formerly-COMPLEX query regresses to SIMPLE routing (quality cliff)
 *      or a cheap query escalates to COMPLEX (cost blow-up).
 *   2. Guardrails (`validateInput`) — catches BOTH false positives (safe
 *      analytical queries being wrongly rejected) AND false negatives (new
 *      injection variants slipping through).
 *   3. PII scrub (`scrubPII`) — catches both sides of the same coin.
 *
 * A fourth, opt-in subsystem — live retrieval quality — runs when
 * `RAG_EVAL_LIVE=true` is set. Keyword + similarity assertions need Azure
 * embeddings and a populated KB, so they're excluded from the default CI run.
 *
 * Golden fixtures live in `./fixtures/rag-golden-set.ts`. Adding a regression
 * test for any future production bug is as simple as appending one entry.
 */

import { describe, it, expect } from "vitest";

import { classifyQuery } from "../query-classifier";
import { validateInput } from "../guardrails";
import { scrubPII } from "../pii-scrub";
import { RAG_GOLDEN_SET, type RagGoldenCase } from "./fixtures/rag-golden-set";

// ─── Helpers ───────────────────────────────────────────────────────────────

function expectedTierMatches(
  actual: ReturnType<typeof classifyQuery>,
  expected: RagGoldenCase["expectedTier"],
): boolean {
  if (expected === "any") return true;
  if (expected === "moderateOrComplex") {
    return actual === "MODERATE" || actual === "COMPLEX";
  }
  return actual === expected;
}

// ─── Core CI-safe eval ──────────────────────────────────────────────────────

describe("RAG golden-set eval (CI-safe)", () => {
  for (const gc of RAG_GOLDEN_SET) {
    describe(`[${gc.id}] ${gc.query.slice(0, 60)}${gc.query.length > 60 ? "…" : ""}`, () => {
      it("classification routes to the expected tier", () => {
        const actual = classifyQuery(gc.query);
        const ok = expectedTierMatches(actual, gc.expectedTier);
        expect(
          ok,
          `classifyQuery("${gc.query}") → ${actual}; expected ${gc.expectedTier}`,
        ).toBe(true);
      });

      it("guardrails decision matches fixture", () => {
        const { isValid } = validateInput(gc.query);
        expect(
          isValid,
          `validateInput("${gc.query}") → ${isValid}; expected ${gc.mustPassGuardrails}`,
        ).toBe(gc.mustPassGuardrails);
      });

      it("PII scrub behavior matches fixture", () => {
        const { scrubbed, redactionCount } = scrubPII(gc.query);
        if (gc.piiExpectation === "no-op") {
          expect(
            scrubbed,
            `scrubPII should NOT redact "${gc.query}" (got ${redactionCount} redactions → "${scrubbed}")`,
          ).toBe(gc.query);
        } else {
          expect(
            redactionCount,
            `scrubPII SHOULD redact "${gc.query}" but found zero PII`,
          ).toBeGreaterThan(0);
        }
      });
    });
  }

  it("fixture invariants hold", () => {
    // Guardrails-fail + PII-scrubbed can't coexist in a single case: the guardrail
    // runs on the ORIGINAL query (not the scrubbed one), so mixing concerns in a
    // single fixture entry leads to ambiguous regressions.
    for (const gc of RAG_GOLDEN_SET) {
      if (!gc.mustPassGuardrails) {
        expect(
          gc.piiExpectation,
          `[${gc.id}] adversarial guardrail cases must not also assert PII scrubbing`,
        ).toBe("no-op");
      }
    }
    // Every fixture id must be unique — duplicates create silent test-order shadowing.
    const ids = new Set<string>();
    for (const gc of RAG_GOLDEN_SET) {
      expect(ids.has(gc.id), `duplicate fixture id: ${gc.id}`).toBe(false);
      ids.add(gc.id);
    }
  });
});

// ─── Live retrieval eval (opt-in) ──────────────────────────────────────────
//
// Gated behind `RAG_EVAL_LIVE=true`. Requires:
//   - AZURE_OPENAI_API_KEY + AZURE_OPENAI_ENDPOINT
//   - AZURE_OPENAI_EMBEDDING_DEPLOYMENT
//   - Populated KnowledgeEmbedding rows in Postgres
//
// Run locally with:
//   RAG_EVAL_LIVE=true npx vitest run src/lib/ai/__tests__/rag-golden-eval.test.ts

const LIVE = process.env.RAG_EVAL_LIVE === "true";

// Only register live retrieval tests when explicitly opted-in.
// This avoids 8 permanently-skipped tests cluttering CI output.
if (LIVE) {
  describe("RAG golden-set eval (live retrieval)", () => {
    it("lazy-imports retrieval layer only when live mode is on", async () => {
      // Dynamic import so the CI-safe run never pays the cost of loading prisma / OpenAI.
      const { retrieveInstitutionalKnowledge } = await import("../rag");
      expect(typeof retrieveInstitutionalKnowledge).toBe("function");
    });

    for (const gc of RAG_GOLDEN_SET) {
      if (!gc.expectedChunkKeywords || gc.expectedChunkKeywords.length === 0) continue;
      if (!gc.mustPassGuardrails) continue; // never run retrieval on adversarial queries

      it(`[${gc.id}] retrieval surfaces expected keywords`, async () => {
        const { retrieveInstitutionalKnowledge } = await import("../rag");
        const tier = gc.expectedTier === "moderateOrComplex" ? "MODERATE" : gc.expectedTier;
        // Signature: retrieveInstitutionalKnowledge(query, topK, assetType, useFastPath, tier)
        const result = await retrieveInstitutionalKnowledge(gc.query, 5, undefined, false, tier);
        const haystack = (result.content ?? "").toLowerCase();

        for (const kw of gc.expectedChunkKeywords!) {
          expect(
            haystack.includes(kw.toLowerCase()),
            `[${gc.id}] expected chunk keyword "${kw}" not found in retrieved content (first 200 chars: "${haystack.slice(0, 200)}")`,
          ).toBe(true);
        }

        if (typeof gc.minAvgSimilarity === "number") {
          const avg = result.sources?.length
            ? result.sources.reduce((a, s) => a + ((s as { similarity?: number }).similarity ?? 0), 0) / result.sources.length
            : 0;
          expect(
            avg,
            `[${gc.id}] avg similarity ${avg.toFixed(3)} below floor ${gc.minAvgSimilarity}`,
          ).toBeGreaterThanOrEqual(gc.minAvgSimilarity);
        }
      }, 30_000);
    }
  });
}
