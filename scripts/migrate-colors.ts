/**
 * LyraAlpha Phase 2b color migration script.
 *
 * Applies the color migration map from docs/design/REDESIGN_PLAN.md to one or
 * more files/folders. Mechanically substitutes raw Tailwind utility classes
 * with semantic role tokens. Idempotent — running twice is a no-op.
 *
 * Usage:
 *   npx tsx scripts/migrate-colors.ts [options] <file_or_directory> [...]
 *
 * Options:
 *   --dry-run    Print planned changes without writing files
 *   --help, -h   Show this help message
 *
 * Examples:
 *   npx tsx scripts/migrate-colors.ts src/components/portfolio
 *   npx tsx scripts/migrate-colors.ts --dry-run src/
 */

import * as fs from "fs";
import * as path from "path";

// ─── Configuration ──────────────────────────────────────────────────────────

const COLOR_MAP: Record<string, string> = {
  emerald: "success",
  rose: "danger",
  amber: "warning",
  sky: "info",
  cyan: "info",
};

const UTILITIES = ["text", "bg", "border", "fill", "stroke", "ring", "from", "to", "via"] as const;

const SHADES = "300|400|500";
const OPQ = "(\\/\\d+(?:\\.\\d+)?)?"; // captures /10, /6, /18, /3, etc.

/** Directories to skip when walking. */
const SKIP_DIRS = new Set(["node_modules", ".next", "dist", "build", "generated", "coverage"]);

/** File extensions to process. */
const VALID_EXTENSIONS = /\.(tsx?|css)$/;

/** Specific files to skip (resolved relative to project root). */
const SKIP_FILES = new Set(["src/app/globals.css"]);

// ─── Single-pass regex engine ───────────────────────────────────────────────
// One RegExp per utility prefix. The replacer looks up the captured color in
// COLOR_MAP and substitutes the semantic role — no inner loop, no wasted
// scans over already-replaced text.

const PATTERNS: Map<string, RegExp> = new Map();
for (const utility of UTILITIES) {
  const colors = Object.keys(COLOR_MAP).join("|");
  PATTERNS.set(utility, new RegExp(`\\b${utility}-(${colors})-(?:${SHADES})${OPQ}\\b`, "g"));
}

function migrateContent(content: string): { text: string; replacementCount: number } {
  let replacementCount = 0;

  for (const [utility, re] of PATTERNS) {
    content = content.replace(re, (_match, color, opacity) => {
      const role = COLOR_MAP[color];
      if (!role) return _match; // unknown color — preserve
      replacementCount++;
      return `${utility}-${role}${opacity ?? ""}`;
    });
  }

  return { text: content, replacementCount };
}

// ─── Stats tracking ─────────────────────────────────────────────────────────

interface Stats {
  filesScanned: number;
  filesMigrated: number;
  filesSkipped: number;
  totalReplacements: number;
  errors: Array<{ path: string; error: string }>;
}

function createStats(): Stats {
  return { filesScanned: 0, filesMigrated: 0, filesSkipped: 0, totalReplacements: 0, errors: [] };
}

function printStats(stats: Stats, dryRun: boolean): void {
  const prefix = dryRun ? "[DRY RUN] " : "";
  console.log("");
  console.log(`${prefix}Migration summary:`);
  console.log(`  Files scanned:    ${stats.filesScanned}`);
  console.log(`  Files migrated:   ${stats.filesMigrated}`);
  console.log(`  Files skipped:    ${stats.filesSkipped}`);
  console.log(`  Replacements:     ${stats.totalReplacements}`);
  if (stats.errors.length > 0) {
    console.log(`  Errors:`);
    for (const { path: p, error } of stats.errors) {
      console.log(`    ${p}: ${error}`);
    }
  }
  if (dryRun && stats.totalReplacements > 0) {
    console.log(`  (No files were written — re-run without --dry-run to apply)`);
  }
}

// ─── File processing ────────────────────────────────────────────────────────

function shouldSkipFile(filePath: string): boolean {
  if (!VALID_EXTENSIONS.test(filePath)) return true;
  // Skip generated / dependency directories by path segment
  for (const seg of SKIP_DIRS) {
    if (filePath.includes(`${path.sep}${seg}${path.sep}`)) return true;
  }
  // Skip this script itself
  if (filePath.includes("scripts/migrate-colors")) return true;
  // Skip tracking docs
  if (filePath.includes("docs/design/")) return true;
  // Skip specific files by relative path
  const rel = path.relative(process.cwd(), filePath);
  if (SKIP_FILES.has(rel.replace(/\\/g, "/"))) return true;
  return false;
}

function processFile(filePath: string, dryRun: boolean, stats: Stats): void {
  if (shouldSkipFile(filePath)) {
    stats.filesSkipped++;
    return;
  }

  stats.filesScanned++;

  let content: string;
  try {
    content = fs.readFileSync(filePath, "utf-8");
  } catch (e) {
    stats.errors.push({ path: filePath, error: String(e) });
    return;
  }

  const { text, replacementCount } = migrateContent(content);

  if (replacementCount === 0) return;

  stats.totalReplacements += replacementCount;
  stats.filesMigrated++;

  if (dryRun) {
    console.log(`[DRY RUN] ${filePath} (${replacementCount} replacements)`);
  } else {
    try {
      fs.writeFileSync(filePath, text, "utf-8");
      console.log(`migrated: ${filePath} (${replacementCount})`);
    } catch (e) {
      stats.errors.push({ path: filePath, error: String(e) });
    }
  }
}

function walk(dir: string, dryRun: boolean, stats: Stats): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    stats.errors.push({ path: dir, error: String(e) });
    return;
  }

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(full, dryRun, stats);
    } else {
      processFile(full, dryRun, stats);
    }
  }
}

// ─── CLI ────────────────────────────────────────────────────────────────────

function parseArgs(argv: string[]): { dryRun: boolean; targets: string[] } {
  const args = argv.slice(2);
  let dryRun = false;
  const targets: string[] = [];

  for (const arg of args) {
    if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--help" || arg === "-h") {
      console.log(
        `LyraAlpha color migration script\n\n` +
        `Usage: npx tsx scripts/migrate-colors.ts [options] <file_or_directory> [...]\n\n` +
        `Options:\n` +
        `  --dry-run    Print planned changes without writing files\n` +
        `  --help, -h   Show this help message\n\n` +
        `Migrates raw Tailwind color utilities to semantic role tokens:\n` +
        `  emerald → success, rose → danger, amber → warning, sky/cyan → info\n\n` +
        `Covered utilities: ${[...UTILITIES].join(", ")}\n` +
        `Covered shades: ${SHADES.replace(/\|/g, ", ")}\n`,
      );
      process.exit(0);
    } else if (arg.startsWith("-")) {
      console.error(`Unknown option: ${arg}`);
      console.error("Run with --help for usage.");
      process.exit(1);
    } else {
      targets.push(arg);
    }
  }

  return { dryRun, targets };
}

function main(): void {
  const { dryRun, targets } = parseArgs(process.argv);

  if (!targets.length) {
    console.error("Error: no targets specified.");
    console.error("Usage: npx tsx scripts/migrate-colors.ts [options] <file_or_directory> [...]");
    console.error("Run with --help for usage.");
    process.exit(1);
  }

  const stats = createStats();

  for (const target of targets) {
    const resolved = path.resolve(target);
    let stat: fs.Stats;
    try {
      stat = fs.statSync(resolved);
    } catch {
      console.error(`Error: path does not exist: ${resolved}`);
      stats.errors.push({ path: resolved, error: "path does not exist" });
      continue;
    }

    if (stat.isDirectory()) {
      walk(resolved, dryRun, stats);
    } else {
      processFile(resolved, dryRun, stats);
    }
  }

  printStats(stats, dryRun);

  if (stats.errors.length > 0 && !dryRun) {
    process.exit(1);
  }
}

main();
