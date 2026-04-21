/**
 * Phase 5.6: Migrate remaining raw Tailwind color classes (zinc, blue, purple, pink, neutral)
 * to semantic tokens.
 *
 * Usage: npx tsx scripts/migrate-remaining.ts [--dry-run]
 *
 * Migration map:
 *   zinc-*  → same logic as slate (zinc is Tailwind's neutral gray)
 *   blue-*  → info semantic token (blue = informational)
 *   purple-* → indigo/primary semantic token (purple = brand accent)
 *   pink-*  → danger/rose semantic token (pink = alert/attention)
 *   neutral-* → muted semantic token
 */

import * as fs from "fs";
import * as path from "path";

const SRC = path.resolve(process.cwd(), "src");
const DRY_RUN = process.argv.includes("--dry-run");

type ColorFamily = "zinc" | "blue" | "purple" | "pink" | "neutral";

function shadeToSemantic(shade: number, prop: string, family: ColorFamily): string {
  if (family === "zinc") {
    // Same as slate — neutral gray
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

  if (family === "blue") {
    // blue → info
    if (prop === "text" || prop === "from" || prop === "to" || prop === "via") {
      if (shade <= 300) return "text-info/60";
      return "text-info";
    }
    if (prop === "bg") {
      if (shade <= 200) return "bg-info/10";
      if (shade <= 400) return "bg-info/20";
      if (shade <= 600) return "bg-info";
      return "bg-info/80";
    }
    if (shade <= 200) return "border-info/20";
    if (shade <= 400) return "border-info/40";
    return "border-info";
  }

  if (family === "purple") {
    // purple → primary (brand accent)
    if (prop === "text" || prop === "from" || prop === "to" || prop === "via") {
      if (shade <= 300) return "text-primary/60";
      return "text-primary";
    }
    if (prop === "bg") {
      if (shade <= 200) return "bg-primary/10";
      if (shade <= 400) return "bg-primary/20";
      if (shade <= 600) return "bg-primary";
      return "bg-primary/80";
    }
    if (shade <= 200) return "border-primary/20";
    if (shade <= 400) return "border-primary/40";
    return "border-primary";
  }

  if (family === "pink") {
    // pink → danger (alert/attention)
    if (prop === "text" || prop === "from" || prop === "to" || prop === "via") {
      if (shade <= 300) return "text-danger/60";
      return "text-danger";
    }
    if (prop === "bg") {
      if (shade <= 200) return "bg-danger/10";
      if (shade <= 400) return "bg-danger/20";
      if (shade <= 600) return "bg-danger";
      return "bg-danger/80";
    }
    if (shade <= 200) return "border-danger/20";
    if (shade <= 400) return "border-danger/40";
    return "border-danger";
  }

  if (family === "neutral") {
    // neutral → muted
    if (prop === "text" || prop === "from" || prop === "to" || prop === "via") {
      if (shade <= 300) return "text-muted-foreground";
      return "text-foreground";
    }
    if (prop === "bg") {
      if (shade <= 300) return "bg-muted/50";
      if (shade <= 600) return "bg-muted";
      return "bg-foreground/10";
    }
    if (shade <= 300) return "border-border/50";
    return "border-border";
  }

  return `${prop}-${family}-${shade}`; // fallback — shouldn't reach
}

function migrateContent(content: string): string {
  let result = content;
  const families: ColorFamily[] = ["zinc", "blue", "purple", "pink", "neutral"];
  const pattern = new RegExp(
    `(?<![a-z])(text|bg|border|ring|outline|from|to|via)-(${families.join("|")})-(\\d{1,3})(\\/\\d+)?`,
    "g",
  );

  result = result.replace(pattern, (match, prop, family, shadeStr, existingOpacity) => {
    const shade = parseInt(shadeStr, 10);
    const semantic = shadeToSemantic(shade, prop, family as ColorFamily);
    if (existingOpacity) {
      const base = semantic.replace(/\/\d+$/, "");
      return `${base}${existingOpacity}`;
    }
    return semantic;
  });

  return result;
}

function processFile(filePath: string) {
  const content = fs.readFileSync(filePath, "utf-8");
  const hasTarget = content.includes("zinc-") || content.includes("blue-") || content.includes("purple-") || content.includes("pink-") || content.includes("neutral-");
  if (!hasTarget) return;

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

console.log(DRY_RUN ? "🔄 [DRY-RUN] Migrating remaining raw color classes..." : "🔄 Migrating remaining raw color classes...");
walk(SRC);
console.log("Done.");
