/**
 * Phase 5.3: Migrate raw slate-* Tailwind classes to semantic tokens.
 *
 * Usage: npx tsx scripts/migrate-slate.ts [--dry-run]
 *
 * Migration map:
 *   text-slate-{50-100}   → text-foreground/40   (very light, subtle)
 *   text-slate-{200-300}  → text-muted-foreground (secondary text)
 *   text-slate-{400-500}  → text-muted-foreground (standard muted)
 *   text-slate-{600-700}  → text-foreground       (primary text)
 *   text-slate-{800-900}  → text-foreground       (strong text)
 *   text-slate-950        → text-foreground
 *   bg-slate-{50-100}     → bg-muted/30           (subtle background)
 *   bg-slate-{200-300}    → bg-muted/50           (light surface)
 *   bg-slate-{400-500}    → bg-muted              (medium surface)
 *   bg-slate-{600-700}    → bg-muted-foreground/20 (dark surface)
 *   bg-slate-{800-900}    → bg-foreground/10      (very dark surface)
 *   bg-slate-950          → bg-foreground/5
 *   border-slate-{50-100} → border-border/30
 *   border-slate-{200-300}→ border-border/50
 *   border-slate-{400-500}→ border-border
 *   border-slate-{600-700}→ border-border
 *   border-slate-{800-950}→ border-foreground/20
 *   ring-slate-*           → ring-border (same logic)
 */

import * as fs from "fs";
import * as path from "path";

const SRC = path.resolve(process.cwd(), "src");
const DRY_RUN = process.argv.includes("--dry-run");

function shadeToSemantic(shade: number, prop: string): string {
  if (prop === "text" || prop === "from" || prop === "to" || prop === "via") {
    if (shade <= 100) return "text-foreground/40";
    if (shade <= 300) return "text-muted-foreground";
    if (shade <= 500) return "text-muted-foreground";
    return "text-foreground";
  }
  if (prop === "bg") {
    if (shade <= 100) return "bg-muted/30";
    if (shade <= 300) return "bg-muted/50";
    if (shade <= 500) return "bg-muted";
    if (shade <= 700) return "bg-muted-foreground/20";
    if (shade <= 900) return "bg-foreground/10";
    return "bg-foreground/5";
  }
  // border, ring, outline
  if (shade <= 100) return "border-border/30";
  if (shade <= 300) return "border-border/50";
  if (shade <= 700) return "border-border";
  return "border-foreground/20";
}

function migrateContent(content: string): string {
  let result = content;
  const pattern = /(?<![a-z])(text|bg|border|ring|outline|from|to|via)-slate-(\d{1,3})(\/\d+)?/g;

  result = result.replace(pattern, (match, prop, shadeStr, existingOpacity) => {
    const shade = parseInt(shadeStr, 10);
    const semantic = shadeToSemantic(shade, prop);
    // If original had /opacity, append it (overriding shade-derived opacity)
    if (existingOpacity) {
      // Remove any trailing opacity from semantic and use original
      const base = semantic.replace(/\/\d+$/, "");
      return `${base}${existingOpacity}`;
    }
    return semantic;
  });

  return result;
}

function processFile(filePath: string) {
  const content = fs.readFileSync(filePath, "utf-8");
  if (!content.includes("slate-")) return;

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

console.log(DRY_RUN ? "🔄 [DRY-RUN] Migrating slate-* → semantic tokens..." : "🔄 Migrating slate-* → semantic tokens...");
walk(SRC);
console.log("Done.");
