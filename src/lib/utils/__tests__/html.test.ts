/**
 * @vitest-environment node
 * Tests for the shared escHtml utility.
 */
import { describe, it, expect } from "vitest";
import { escHtml } from "../html";

describe("escHtml", () => {
  it("escapes ampersands", () => {
    expect(escHtml("a & b")).toBe("a &amp; b");
  });

  it("escapes less-than", () => {
    expect(escHtml("<script>")).toBe("&lt;script&gt;");
  });

  it("escapes greater-than", () => {
    expect(escHtml("a > b")).toBe("a &gt; b");
  });

  it("escapes double quotes", () => {
    expect(escHtml(`<a href="x">`)).toBe("&lt;a href=&quot;x&quot;&gt;");
  });

  it("escapes all special chars together", () => {
    expect(escHtml(`<div class="a&b">c > d</div>`)).toBe(
      "&lt;div class=&quot;a&amp;b&quot;&gt;c &gt; d&lt;/div&gt;",
    );
  });

  it("returns plain string unchanged", () => {
    expect(escHtml("hello world")).toBe("hello world");
  });

  it("returns empty string unchanged", () => {
    expect(escHtml("")).toBe("");
  });

  it("handles multiple consecutive special chars", () => {
    expect(escHtml("<<<>>>")).toBe("&lt;&lt;&lt;&gt;&gt;&gt;");
  });

  it("handles XSS payload correctly", () => {
    const input = `"><img src=x onerror="alert(1)">`;
    const output = escHtml(input);
    expect(output).not.toContain("<img");
    expect(output).not.toContain(`onerror="`);
    expect(output).toContain("&lt;img");
  });
});
