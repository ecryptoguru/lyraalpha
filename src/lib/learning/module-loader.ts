import { readFile } from "fs/promises";
import { join } from "path";

const MODULES_DIR = join(process.cwd(), "src/lib/learning/modules");

export interface ParsedModuleContent {
  frontmatter: Record<string, string>;
  sections: ModuleSection[];
  quickCheck: QuickCheckItem[];
  rawMarkdown: string;
}

export interface ModuleSection {
  heading: string;
  content: string;
}

export interface QuickCheckItem {
  statement: string;
  isTrue: boolean;
  explanation?: string;
}

/**
 * Load and parse a learning module markdown file.
 * Returns null if the file doesn't exist yet (content not written).
 */
export async function getModuleContent(
  category: string,
  slug: string,
): Promise<ParsedModuleContent | null> {
  const filePath = join(MODULES_DIR, category, `${slug}.md`);

  try {
    const raw = await readFile(filePath, "utf-8");
    return parseModuleMarkdown(raw);
  } catch {
    // File doesn't exist yet — module registered but content not written
    return null;
  }
}

/**
 * Parse module markdown into structured content.
 *
 * Expected format:
 * ---
 * title: "..."
 * slug: "..."
 * ...
 * ---
 *
 * ## Key Concept
 * ...
 *
 * ## What It Means
 * ...
 *
 * ## Quick Check
 * - [x] Statement that is true. | Explanation why.
 * - [ ] Statement that is false. | Explanation why not.
 */
export function parseModuleMarkdown(raw: string): ParsedModuleContent {
  // Extract frontmatter
  const frontmatter: Record<string, string> = {};
  let body = raw;

  const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (fmMatch) {
    const fmBlock = fmMatch[1];
    body = fmMatch[2];

    for (const line of fmBlock.split("\n")) {
      const colonIdx = line.indexOf(":");
      if (colonIdx > 0) {
        const key = line.slice(0, colonIdx).trim();
        const value = line.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, "");
        frontmatter[key] = value;
      }
    }
  }

  // Parse sections (## headings)
  const sections: ModuleSection[] = [];
  const quickCheck: QuickCheckItem[] = [];

  const sectionRegex = /^## (.+)$/gm;
  const sectionStarts: { heading: string; index: number }[] = [];
  let match;

  while ((match = sectionRegex.exec(body)) !== null) {
    sectionStarts.push({ heading: match[1], index: match.index });
  }

  for (let i = 0; i < sectionStarts.length; i++) {
    const start = sectionStarts[i];
    const end = i + 1 < sectionStarts.length ? sectionStarts[i + 1].index : body.length;
    const content = body.slice(start.index + start.heading.length + 4, end).trim();

    if (start.heading.toLowerCase() === "quick check") {
      // Parse quick check items
      const lines = content.split("\n").filter(l => l.trim().startsWith("- ["));
      for (const line of lines) {
        const isTrue = line.includes("[x]") || line.includes("[X]");
        // Format: "- [x] Statement. | Explanation" or "- [ ] Statement. | Explanation"
        const textPart = line.replace(/^- \[[ xX]\]\s*/, "").trim();
        const pipeIdx = textPart.indexOf("|");
        if (pipeIdx > 0) {
          quickCheck.push({
            statement: textPart.slice(0, pipeIdx).trim(),
            isTrue,
            explanation: textPart.slice(pipeIdx + 1).trim(),
          });
        } else {
          quickCheck.push({ statement: textPart, isTrue });
        }
      }
    } else {
      sections.push({ heading: start.heading, content });
    }
  }

  return {
    frontmatter,
    sections,
    quickCheck,
    rawMarkdown: body.trim(),
  };
}
