/**
 * Ingest-time sanitization for externally-authored blog content (AMI webhook).
 *
 * The rendering path (`react-markdown` without `rehype-raw`) already escapes raw
 * HTML, and newer versions sanitize `javascript:` URLs. This helper is a
 * defence-in-depth layer applied at *write* time so the database never stores
 * obviously-malicious content in the first place. Two classes of content are
 * scrubbed:
 *
 *   1. Raw HTML injection vectors — `<script>`, `<iframe>`, on-event handlers,
 *      and `javascript:` URL schemes. Belt-and-suspenders in case a future
 *      render path adds `rehype-raw` without this sanitizer.
 *
 *   2. Prompt-injection patterns — blog content gets fed back into LLM pipelines
 *      (RAG, summarization) later. A line that reads "ignore previous instructions
 *      and …" inside a published post could hijack a future Lyra/Myra call.
 *      We drop matching lines at ingest time.
 *
 * The function is idempotent and preserves the markdown structure otherwise
 * untouched — whitespace, headings, lists, and links all pass through.
 */

import { INJECTION_PATTERNS } from "@/lib/ai/guardrails";

const DANGEROUS_TAG_PATTERNS: RegExp[] = [
  /<\s*script\b[\s\S]*?<\s*\/\s*script\s*>/gi, // <script>…</script>
  /<\s*script\b[^>]*>/gi, // stray opening <script …>
  /<\s*iframe\b[\s\S]*?<\s*\/\s*iframe\s*>/gi,
  /<\s*iframe\b[^>]*>/gi,
  /<\s*object\b[\s\S]*?<\s*\/\s*object\s*>/gi,
  /<\s*embed\b[^>]*>/gi,
];

// Strip on-event handlers (onClick=, onload=, onerror=…) anywhere in attributes.
// Matches `\son[a-z]+\s*=\s*"…"` / `'…'` / bareword.
const EVENT_HANDLER_PATTERN = /\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;

// Neutralise `javascript:` / `data:text/html` URL schemes in markdown links and
// raw `href=` attributes. Replaces with `#` so the markdown still parses.
const DANGEROUS_SCHEME_PATTERN = /(href\s*=\s*["']|\]\()\s*(?:javascript|data:\s*text\/html|vbscript)\s*:[^"')\s]*/gi;

export interface BlogSanitizeResult {
  content: string;
  strippedTagCount: number;
  injectionLinesDropped: number;
}

/**
 * Sanitize untrusted markdown content before DB ingest.
 */
export function sanitizeBlogContent(raw: string): BlogSanitizeResult {
  let strippedTagCount = 0;
  let work = raw;

  // 1. Strip dangerous HTML tags.
  for (const pattern of DANGEROUS_TAG_PATTERNS) {
    work = work.replace(pattern, (match) => {
      strippedTagCount += 1;
      void match;
      return "";
    });
  }

  // 2. Strip on-event attribute handlers from any remaining HTML.
  work = work.replace(EVENT_HANDLER_PATTERN, () => {
    strippedTagCount += 1;
    return "";
  });

  // 3. Neutralise dangerous URL schemes.
  work = work.replace(DANGEROUS_SCHEME_PATTERN, (_m, lead: string) => {
    strippedTagCount += 1;
    return `${lead}#`;
  });

  // 4. Drop lines matching prompt-injection patterns (NFKC-normalized to defeat
  //    homoglyph evasion, same as RAG / web-search sanitizers).
  let injectionLinesDropped = 0;
  const filteredLines = work.split("\n").filter((line) => {
    const normalized = line.normalize("NFKC");
    for (const pattern of INJECTION_PATTERNS) {
      if (pattern.test(normalized)) {
        injectionLinesDropped += 1;
        return false;
      }
    }
    return true;
  });

  return {
    content: filteredLines.join("\n"),
    strippedTagCount,
    injectionLinesDropped,
  };
}

/**
 * Sanitize short-form text fields (title, description, metaDescription). Markdown
 * headers/lists aren't expected here, so we just strip HTML + dangerous schemes
 * without running the injection-pattern filter (would be too aggressive on short
 * marketing copy).
 */
export function sanitizeBlogInlineText(raw: string): string {
  return raw
    .replace(DANGEROUS_TAG_PATTERNS[0], "")
    .replace(DANGEROUS_TAG_PATTERNS[1], "")
    .replace(DANGEROUS_TAG_PATTERNS[2], "")
    .replace(DANGEROUS_TAG_PATTERNS[3], "")
    .replace(EVENT_HANDLER_PATTERN, "")
    .replace(DANGEROUS_SCHEME_PATTERN, (_m, lead: string) => `${lead}#`);
}
