/**
 * @vitest-environment node
 * Tests for classifyLine and tokenizeInline from the blog content parser.
 */
import { describe, it, expect } from "vitest";
import { classifyLine, tokenizeInline } from "../content-parser";

// ─── classifyLine ─────────────────────────────────────────────────────────────

describe("classifyLine", () => {
  describe("code block context", () => {
    it("returns code_fence when line starts with ``` (not in code block)", () => {
      expect(classifyLine("```", false, "```")).toEqual({ type: "code_fence" });
    });

    it("returns code_line for closing fence when inside a code block (caller manages toggle)", () => {
      // classifyLine delegates fence detection to the caller when already in code block;
      // inside a code block every line — including ``` — is treated as raw code_line.
      expect(classifyLine("```", true, "```")).toEqual({ type: "code_line", text: "```" });
    });

    it("returns code_line for any line inside a code block", () => {
      expect(classifyLine("const x = 1;", true, "  const x = 1;")).toEqual({
        type: "code_line",
        text: "  const x = 1;",
      });
    });

    it("preserves raw line indentation for code_line", () => {
      expect(classifyLine("    indent", true, "    indent")).toEqual({
        type: "code_line",
        text: "    indent",
      });
    });
  });

  describe("headings", () => {
    it("classifies ## as h2", () => {
      expect(classifyLine("## Market Regime", false, "## Market Regime")).toEqual({
        type: "h2",
        text: "Market Regime",
      });
    });

    it("classifies # as h3", () => {
      expect(classifyLine("# Sub heading", false, "# Sub heading")).toEqual({
        type: "h3",
        text: "Sub heading",
      });
    });

    it("does NOT classify ### as h2 or h3 — falls through to paragraph", () => {
      const result = classifyLine("### Triple", false, "### Triple");
      expect(result.type).toBe("paragraph");
    });
  });

  describe("horizontal rule", () => {
    it("classifies --- as hr", () => {
      expect(classifyLine("---", false, "---")).toEqual({ type: "hr" });
    });

    it("does NOT classify ---- as hr", () => {
      expect(classifyLine("----", false, "----")).not.toEqual({ type: "hr" });
    });
  });

  describe("blank line", () => {
    it("classifies empty string as blank", () => {
      expect(classifyLine("", false, "")).toEqual({ type: "blank" });
    });
  });

  describe("bullet list", () => {
    it("classifies '- item' as bullet", () => {
      expect(classifyLine("- First item", false, "- First item")).toEqual({
        type: "bullet",
        text: "First item",
      });
    });

    it("strips the '- ' prefix from bullet text", () => {
      const result = classifyLine("- Hello world", false, "- Hello world");
      expect(result).toMatchObject({ type: "bullet", text: "Hello world" });
    });

    it("does NOT classify '-item' (no space) as bullet", () => {
      expect(classifyLine("-nospace", false, "-nospace").type).toBe("paragraph");
    });
  });

  describe("numbered list", () => {
    it("classifies '1. item' as numbered", () => {
      expect(classifyLine("1. First", false, "1. First")).toMatchObject({
        type: "numbered",
        text: "First",
        index: 1,
      });
    });

    it("classifies '10. item' as numbered with correct index", () => {
      expect(classifyLine("10. Tenth", false, "10. Tenth")).toMatchObject({
        type: "numbered",
        text: "Tenth",
        index: 10,
      });
    });

    it("does NOT classify '1.item' (no space) as numbered", () => {
      expect(classifyLine("1.nospace", false, "1.nospace").type).toBe("paragraph");
    });
  });

  describe("paragraph fallthrough", () => {
    it("classifies plain text as paragraph", () => {
      expect(classifyLine("Just a sentence.", false, "Just a sentence.")).toEqual({
        type: "paragraph",
        text: "Just a sentence.",
      });
    });

    it("classifies text with **bold** as paragraph (inline parsed separately)", () => {
      const result = classifyLine("Text with **bold** here.", false, "Text with **bold** here.");
      expect(result).toEqual({ type: "paragraph", text: "Text with **bold** here." });
    });
  });
});

// ─── tokenizeInline ───────────────────────────────────────────────────────────

describe("tokenizeInline", () => {
  it("returns a single text token for plain text", () => {
    expect(tokenizeInline("Hello world")).toEqual([
      { kind: "text", value: "Hello world" },
    ]);
  });

  it("returns empty array for empty string", () => {
    expect(tokenizeInline("")).toEqual([]);
  });

  describe("bold tokens", () => {
    it("tokenizes **bold** into a bold token", () => {
      expect(tokenizeInline("**bold**")).toEqual([
        { kind: "bold", value: "bold" },
      ]);
    });

    it("splits text around bold correctly", () => {
      const tokens = tokenizeInline("before **bold** after");
      expect(tokens).toEqual([
        { kind: "text", value: "before " },
        { kind: "bold", value: "bold" },
        { kind: "text", value: " after" },
      ]);
    });

    it("handles multiple bold tokens in one string", () => {
      const tokens = tokenizeInline("**a** and **b**");
      const boldTokens = tokens.filter((t) => t.kind === "bold");
      expect(boldTokens).toHaveLength(2);
      expect(boldTokens[0]).toMatchObject({ kind: "bold", value: "a" });
      expect(boldTokens[1]).toMatchObject({ kind: "bold", value: "b" });
    });

    it("does NOT tokenize single asterisk as bold", () => {
      const tokens = tokenizeInline("*not bold*");
      expect(tokens).toEqual([{ kind: "text", value: "*not bold*" }]);
    });
  });

  describe("link tokens", () => {
    it("tokenizes [text](url) into a link token", () => {
      expect(tokenizeInline("[click here](https://example.com)")).toEqual([
        { kind: "link", text: "click here", href: "https://example.com", external: true },
      ]);
    });

    it("marks http:// links as external", () => {
      const [token] = tokenizeInline("[link](http://example.com)");
      expect(token).toMatchObject({ kind: "link", external: true });
    });

    it("marks internal paths as non-external", () => {
      const [token] = tokenizeInline("[link](/blog/post)");
      expect(token).toMatchObject({ kind: "link", external: false });
    });

    it("preserves link text and href correctly", () => {
      const [token] = tokenizeInline("[Read more](/blog/article)");
      expect(token).toMatchObject({ kind: "link", text: "Read more", href: "/blog/article" });
    });

    it("splits text around link correctly", () => {
      const tokens = tokenizeInline("See [this article](https://example.com) for details.");
      expect(tokens[0]).toMatchObject({ kind: "text", value: "See " });
      expect(tokens[1]).toMatchObject({ kind: "link", text: "this article" });
      expect(tokens[2]).toMatchObject({ kind: "text", value: " for details." });
    });
  });

  describe("mixed inline tokens", () => {
    it("handles bold and link in same string", () => {
      const tokens = tokenizeInline("**Bold** and [link](https://x.com).");
      expect(tokens[0]).toMatchObject({ kind: "bold", value: "Bold" });
      expect(tokens[1]).toMatchObject({ kind: "text", value: " and " });
      expect(tokens[2]).toMatchObject({ kind: "link", text: "link" });
      expect(tokens[3]).toMatchObject({ kind: "text", value: "." });
    });

    it("trailing plain text after last token is preserved", () => {
      const tokens = tokenizeInline("**bold** trailing");
      expect(tokens[tokens.length - 1]).toMatchObject({ kind: "text", value: " trailing" });
    });

    it("leading plain text before first token is preserved", () => {
      const tokens = tokenizeInline("leading **bold**");
      expect(tokens[0]).toMatchObject({ kind: "text", value: "leading " });
    });
  });

  describe("edge cases", () => {
    it("handles text with no special markers as single text token", () => {
      const tokens = tokenizeInline("Deterministic computation with AI interpretation.");
      expect(tokens).toHaveLength(1);
      expect(tokens[0]).toMatchObject({ kind: "text" });
    });

    it("does not confuse partial bold markers", () => {
      const tokens = tokenizeInline("50** not bold");
      expect(tokens).toHaveLength(1);
      expect(tokens[0].kind).toBe("text");
    });

    it("handles link with query string in href", () => {
      const [token] = tokenizeInline("[Search](/blog?q=AI&category=tech)");
      expect(token).toMatchObject({
        kind: "link",
        href: "/blog?q=AI&category=tech",
      });
    });
  });
});
