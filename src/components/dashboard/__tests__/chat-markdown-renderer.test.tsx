/**
 * Unit tests for renderInline and renderContent markdown renderers
 * extracted from LiveChatWidget.
 */
import { describe, it, expect } from "vitest";
import { renderInline, renderContent } from "../live-chat-widget";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

function html(result: React.ReactNode | React.ReactNode[]): string {
  const arr = Array.isArray(result) ? result : [result];
  return arr.map((el) => renderToStaticMarkup(el as React.ReactElement)).join("");
}

// ─── renderInline ────────────────────────────────────────────────────────────

describe("renderInline", () => {
  it("renders plain text in a span", () => {
    const result = renderInline("hello world", "t");
    expect(html(result)).toContain("hello world");
  });

  it("renders inline code", () => {
    const result = renderInline("use `npm install`", "t");
    expect(html(result)).toContain("<code");
    expect(html(result)).toContain("npm install");
  });

  it("renders bold text", () => {
    const result = renderInline("**important**", "t");
    expect(html(result)).toContain("<strong>");
    expect(html(result)).toContain("important");
  });

  it("renders italic text", () => {
    const result = renderInline("*emphasis*", "t");
    expect(html(result)).toContain("<em>");
    expect(html(result)).toContain("emphasis");
  });

  it("renders markdown links with safe URLs", () => {
    const result = renderInline("[click](https://example.com)", "t");
    expect(html(result)).toContain('<a');
    expect(html(result)).toContain('href="https://example.com"');
    expect(html(result)).toContain("click");
  });

  it("renders relative path links", () => {
    const result = renderInline("[docs](/docs/api)", "t");
    expect(html(result)).toContain('href="/docs/api"');
  });

  it("blocks javascript: URLs (XSS prevention)", () => {
    const result = renderInline("[evil](javascript:alert(1))", "t");
    const h = html(result);
    expect(h).not.toContain("javascript:");
    expect(h).not.toContain("<a");
    expect(h).toContain("evil");
  });

  it("blocks data: URLs", () => {
    const result = renderInline("[img](data:text/html,<script>alert(1)</script>)", "t");
    const h = html(result);
    expect(h).not.toContain("<a");
  });

  it("handles mixed inline formatting", () => {
    const result = renderInline("use `code` for **bold** and *italic*", "t");
    const h = html(result);
    expect(h).toContain("<code");
    expect(h).toContain("<strong>");
    expect(h).toContain("<em>");
  });

  it("non-greedy bold: does not span across segments", () => {
    const result = renderInline("**a** and **b**", "t");
    const h = html(result);
    const strongCount = (h.match(/<strong>/g) || []).length;
    expect(strongCount).toBe(2);
  });
});

// ─── renderContent ────────────────────────────────────────────────────────────

describe("renderContent", () => {
  it("renders a simple paragraph", () => {
    const result = renderContent("Hello world");
    expect(html(result)).toContain("Hello world");
  });

  it("renders fenced code block with language", () => {
    const result = renderContent("```ts\nconsole.log('hi')\n```");
    const h = html(result);
    expect(h).toContain("<pre");
    expect(h).toContain("ts");
    expect(h).toContain("console.log(&#x27;hi&#x27;)");
  });

  it("renders fenced code block without language", () => {
    const result = renderContent("```\ncode here\n```");
    const h = html(result);
    expect(h).toContain("<pre");
    expect(h).toContain("code here");
  });

  it("handles unclosed fenced code block gracefully", () => {
    const result = renderContent("```js\nconst x = 1;\nconst y = 2;");
    const h = html(result);
    expect(h).toContain("<pre");
    expect(h).toContain("const x = 1;");
    expect(h).toContain("const y = 2;");
  });

  it("renders H2 heading", () => {
    const result = renderContent("## Section Title");
    const h = html(result);
    expect(h).toContain("Section Title");
  });

  it("renders H3 heading", () => {
    const result = renderContent("### Subsection");
    const h = html(result);
    expect(h).toContain("Subsection");
  });

  it("renders bullet list items", () => {
    const result = renderContent("- item one\n- item two");
    const h = html(result);
    expect(h).toContain("item one");
    expect(h).toContain("item two");
  });

  it("renders numbered list items", () => {
    const result = renderContent("1. first\n2. second");
    const h = html(result);
    expect(h).toContain("1.");
    expect(h).toContain("2.");
    expect(h).toContain("first");
    expect(h).toContain("second");
  });

  it("renders multi-line content with mixed elements", () => {
    const content = "## Title\nSome text\n- bullet\n```\ncode\n```";
    const result = renderContent(content);
    const h = html(result);
    expect(h).toContain("Title");
    expect(h).toContain("Some text");
    expect(h).toContain("bullet");
    expect(h).toContain("<pre");
    expect(h).toContain("code");
  });

  it("renders empty lines as spacing", () => {
    const result = renderContent("line1\n\nline2");
    const h = html(result);
    expect(h).toContain("line1");
    expect(h).toContain("line2");
  });
});
