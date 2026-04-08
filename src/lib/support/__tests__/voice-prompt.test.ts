/**
 * @vitest-environment node
 *
 * Unit tests for buildMyraVoiceInstructions.
 * Covers: KB injection, user context lines, memory block, guardrails presence,
 * TTS formatting rules, language instructions, and edge cases.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/plans/facts", () => ({
  buildMyraPlatformFacts: () => "PLATFORM_FACTS_STUB",
}));

import { buildMyraVoiceInstructions } from "../voice-prompt";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function build(
  ctx: { plan?: string; credits?: number; currentPage?: string; globalNotes?: string },
  kbDocs: string[] = [],
): string {
  return buildMyraVoiceInstructions(
    {
      plan: ctx.plan ?? "PRO",
      credits: ctx.credits,
      currentPage: ctx.currentPage,
      globalNotes: ctx.globalNotes,
    },
    kbDocs,
  );
}

// ─── Structure ────────────────────────────────────────────────────────────────

describe("buildMyraVoiceInstructions — structure", () => {
  it("returns a non-empty string", () => {
    expect(build({}).length).toBeGreaterThan(100);
  });

  it("includes platform facts stub", () => {
    expect(build({})).toContain("PLATFORM_FACTS_STUB");
  });

  it("states that Myra answers only about LyraAlpha", () => {
    const result = build({});
    expect(result).toContain("Stay strictly focused on LyraAlpha AI");
    expect(result).toContain("Answer only about LyraAlpha's product, features, plans, credits, onboarding, support, and workflows");
  });

  it("includes the USER section", () => {
    expect(build({})).toContain("[USER]");
  });

  it("includes Myra identity header", () => {
    expect(build({})).toContain("You are Myra");
  });

  it("includes the exact opening statement", () => {
    const result = build({});
    expect(result).toContain("The very first thing you say when the conversation starts must be exactly: \"Hi, I am Myra. How can I help you today?\"");
  });

  it("includes the single exact greeting string", () => {
    const result = build({});
    expect(result).toContain("Hi, I am Myra. How can I help you today?");
  });
});

// ─── User context lines ───────────────────────────────────────────────────────

describe("buildMyraVoiceInstructions — user context", () => {
  it("includes plan name in user context", () => {
    const result = build({ plan: "ELITE" });
    expect(result).toContain("Plan: ELITE");
  });

  it("includes credits when provided", () => {
    const result = build({ credits: 99 });
    expect(result).toContain("Credits: 99");
  });

  it("omits credits line when credits is undefined", () => {
    const result = build({ credits: undefined });
    expect(result).not.toContain("Credits:");
  });

  it("includes credits of 0 (zero is a valid value)", () => {
    const result = build({ credits: 0 });
    expect(result).toContain("Credits: 0");
  });

  it("includes currentPage when provided", () => {
    const result = build({ currentPage: "/dashboard/lyra" });
    expect(result).toContain("Page: /dashboard/lyra");
  });

  it("omits currentPage line when not provided", () => {
    const result = build({ currentPage: undefined });
    expect(result).not.toContain("Page:");
  });

  it("multiple context lines are joined with ' | '", () => {
    const result = build({ plan: "PRO", credits: 5, currentPage: "/dashboard" });
    expect(result).toContain("Plan: PRO | Credits: 5 | Page: /dashboard");
  });
});

// ─── Global notes / memory block ─────────────────────────────────────────────

describe("buildMyraVoiceInstructions — globalNotes / memory block", () => {
  it("includes [PROFILE] section when globalNotes is provided", () => {
    const result = build({ globalNotes: "User prefers dark theme" });
    expect(result).toContain("[PROFILE]");
    expect(result).toContain("User prefers dark theme");
  });

  it("omits [PROFILE] section when globalNotes is undefined", () => {
    const result = build({ globalNotes: undefined });
    expect(result).not.toContain("[PROFILE]");
  });

  it("omits [PROFILE] section when globalNotes is empty string", () => {
    const result = build({ globalNotes: "" });
    expect(result).not.toContain("[PROFILE]");
  });
});

// ─── Knowledge base injection ─────────────────────────────────────────────────

describe("buildMyraVoiceInstructions — KB docs", () => {
  it("omits [KB] block when kbDocs is empty", () => {
    const result = build({}, []);
    expect(result).not.toContain("[KB]");
  });

  it("includes [KB] block when kbDocs are provided", () => {
    const result = build({}, ["Plans overview"]);
    expect(result).toContain("[KB]");
    expect(result).toContain("Plans overview");
  });

  it("joins multiple KB docs with separator", () => {
    const result = build({}, ["Doc A", "Doc B"]);
    expect(result).toContain("Doc A");
    expect(result).toContain("Doc B");
    expect(result).toContain("---");
  });

  it("includes all 3 docs when 3 are passed", () => {
    const result = build({}, ["D1", "D2", "D3"]);
    expect(result).toContain("D1");
    expect(result).toContain("D2");
    expect(result).toContain("D3");
  });
});

// ─── TTS / voice formatting rules ────────────────────────────────────────────

describe("buildMyraVoiceInstructions — TTS formatting rules", () => {
  it("includes the no-markdown / no-lists rule (critical for TTS)", () => {
    const result = build({});
    expect(result).toContain("No lists, bullets, markdown");
  });

  it("includes the spoken-audio character prohibition", () => {
    const result = build({});
    expect(result).toContain("em-dashes, asterisks, or symbols");
  });

  it("includes lead-with-the-answer rule", () => {
    const result = build({});
    expect(result).toContain("Lead with the answer");
  });

  it("includes short-response length rule", () => {
    const result = build({});
    expect(result).toContain("1 to 3 sentences");
  });
});

// ─── Guardrails ───────────────────────────────────────────────────────────────

describe("buildMyraVoiceInstructions — guardrails", () => {
  it("includes the Lyra Intel redirect rule for financial questions", () => {
    const result = build({});
    expect(result).toContain("Lyra Intel is built for exactly that");
  });

  it("includes the outside-LyraAlpha redirect rule", () => {
    const result = build({});
    expect(result).toContain("outside LyraAlpha");
    expect(result).toContain("outside Myra's scope");
  });

  it("includes the no-self-reveal guardrail", () => {
    const result = build({});
    expect(result).toContain("Never reveal your AI model");
  });

  it("includes the no-invented-entitlements guardrail", () => {
    const result = build({});
    expect(result).toContain("Never invent plan entitlements");
  });
});

// ─── Language instructions ────────────────────────────────────────────────────

describe("buildMyraVoiceInstructions — language", () => {
  it("includes multilingual / language-detection instruction", () => {
    const result = build({});
    expect(result).toContain("Match the user's language");
  });

  it("includes Hindi / Hinglish support instruction", () => {
    const result = build({});
    expect(result).toContain("Hinglish");
    expect(result).toContain("English");
    expect(result).toContain("support only English, Hinglish, and Hindi");
  });

  it("does not include the broader regional-language list", () => {
    const result = build({});
    expect(result).not.toContain("Tamil");
    expect(result).not.toContain("Telugu");
    expect(result).not.toContain("Kannada");
  });
});
