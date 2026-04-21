/**
 * Phase 5.2: Migrate raw indigo-* Tailwind classes to semantic tokens.
 *
 * Usage: npx tsx scripts/migrate-indigo.ts [--dry-run]
 *
 * Migration map:
 *   text-indigo-{100-300}  → text-primary/60
 *   text-indigo-{400-900}  → text-primary
 *   bg-indigo-50           → bg-primary/5
 *   bg-indigo-{100-200}    → bg-primary/10
 *   bg-indigo-{300-400}    → bg-primary/20
 *   bg-indigo-{500-600}    → bg-primary
 *   bg-indigo-{700-900}    → bg-primary/80
 *   border-indigo-{100-200}→ border-primary/20
 *   border-indigo-{300-400}→ border-primary/40
 *   border-indigo-{500-600}→ border-primary
 *   border-indigo-{700-900}→ border-primary/80
 *   ring-/from-/to-/via- same logic
 */

import * as fs from "fs";
import * as path from "path";

const SRC = path.resolve(process.cwd(), "src");
const DRY_RUN = process.argv.includes("--dry-run");

function shadeToOpacity(shade: number, prop: string): string {
  if (prop === "text" || prop === "from" || prop === "to" || prop === "via") {
    return shade <= 300 ? "/60" : "";
  }
  if (prop === "bg") {
    if (shade <= 50) return "/5";
    if (shade <= 200) return "/10";
    if (shade <= 400) return "/20";
    if (shade <= 600) return "";
    return "/80";
  }
  // border, ring, outline
  if (shade <= 200) return "/20";
  if (shade <= 400) return "/40";
  if (shade <= 600) return "";
  return "/80";
}

function migrateContent(content: string): string {
  let result = content;
  // Match: (optional prefix like dark:/hover:) + prop + -indigo- + shade + (optional /opacity)
  // Replace with: prefix + prop-primary + (original opacity if present, else shade-derived)
  const pattern = /(?<![a-z])(text|bg|border|ring|outline|from|to|via)-indigo-(\d{1,3})(\/\d+)?/g;

  result = result.replace(pattern, (match, prop, shadeStr, existingOpacity) => {
    const shade = parseInt(shadeStr, 10);
    const opacity = existingOpacity ?? shadeToOpacity(shade, prop);
    return `${prop}-primary${opacity}`;
  });

  return result;
}

function processFile(filePath: string) {
  const content = fs.readFileSync(filePath, "utf-8");
  if (!content.includes("indigo-")) return;

  const migrated = migrateContent(content);
  if (migrated === content) return;

  if (DRY_RUN) {
    console.log(`[DRY-RUN] ${path.relative(SRC, filePath)}`);
    return;
  }

  fs.writeFileSync(filePath, migrated, "utf-8");
  console.log(`✅ ${path.relative(SRC, filePath)}`);
}

function walk(dir: string) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next" || entry.name === "generated") continue;
      walk(full);
    } else if (/\.[jt]sx?$/.test(entry.name) && !entry.name.includes(".test.")) {
      processFile(full);
    }
  }
}

console.log(DRY_RUN ? "🔄 [DRY-RUN] Migrating indigo-* → semantic tokens..." : "🔄 Migrating indigo-* → semantic tokens...");
walk(SRC);
console.log("Done.");
