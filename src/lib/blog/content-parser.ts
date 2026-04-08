/**
 * Pure content classification helpers for the blog post renderer.
 * Extracted here so they can be unit-tested without a React environment.
 */

export type LineKind =
  | { type: "h2"; text: string }
  | { type: "h3"; text: string }
  | { type: "hr" }
  | { type: "blank" }
  | { type: "bullet"; text: string }
  | { type: "numbered"; text: string; index: number }
  | { type: "code_fence" }
  | { type: "code_line"; text: string }
  | { type: "paragraph"; text: string };

export type InlineToken =
  | { kind: "text"; value: string }
  | { kind: "bold"; value: string }
  | { kind: "link"; text: string; href: string; external: boolean };

/**
 * Classify a single line of markdown content into a typed LineKind.
 * Does not accumulate state — caller handles buffer flushing.
 */
export function classifyLine(
  trimmed: string,
  inCodeBlock: boolean,
  rawLine: string,
): LineKind {
  if (inCodeBlock) return { type: "code_line", text: rawLine };
  if (trimmed.startsWith("```")) return { type: "code_fence" };
  if (trimmed.startsWith("## ")) return { type: "h2", text: trimmed.slice(3) };
  if (trimmed.startsWith("# ")) return { type: "h3", text: trimmed.slice(2) };
  if (trimmed === "---") return { type: "hr" };
  if (!trimmed) return { type: "blank" };
  if (trimmed.startsWith("- ")) return { type: "bullet", text: trimmed.slice(2) };
  const numberedMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);
  if (numberedMatch) return { type: "numbered", text: numberedMatch[2], index: parseInt(numberedMatch[1], 10) };
  return { type: "paragraph", text: trimmed };
}

/**
 * Tokenize inline markdown — splits **bold** and [text](url) from plain text.
 */
export function tokenizeInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  const pattern = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) {
      tokens.push({ kind: "text", value: text.slice(last, match.index) });
    }
    const token = match[0];
    if (token.startsWith("**")) {
      tokens.push({ kind: "bold", value: token.slice(2, -2) });
    } else {
      const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        tokens.push({
          kind: "link",
          text: linkMatch[1],
          href: linkMatch[2],
          external: linkMatch[2].startsWith("http"),
        });
      }
    }
    last = match.index + token.length;
  }

  if (last < text.length) {
    tokens.push({ kind: "text", value: text.slice(last) });
  }

  return tokens;
}
