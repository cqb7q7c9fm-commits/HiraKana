// Hard-coded UI values check (10x-ui contract). Zero dependencies on purpose.
// Fails on literal colours, Tailwind palette classes and arbitrary px/rem values in views that were already cleaned up.
// Usage: node scripts/check-hardcoded-ui.mjs [files...]   (no args: the CLEANED_VIEWS below; lint-staged passes staged files)
// Use role tokens instead (bg-card, text-muted-foreground, bg-primary...). Values live in src/styles/global.css.
import { readFileSync } from "node:fs";

// Extend this list whenever another view is cleaned up (and add it to "lint-staged" in package.json).
const CLEANED_VIEWS = ["src/pages/dashboard.astro", "src/pages/dev/kitchen-sink.astro"];

const PALETTE =
  "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black";
const UTILITY =
  "bg|text|border|ring|ring-offset|outline|from|via|to|fill|stroke|shadow|inset-shadow|divide|accent|caret|decoration|placeholder";
const HARDCODED = new RegExp(
  [
    "(?<!href=[\"'])#[0-9a-fA-F]{3,8}\\b",
    "rgba?\\(",
    "hsla?\\(",
    "oklch\\(",
    "-\\[-?[0-9.]+(px|rem|em|vh|vw|%)\\]",
    `\\b(${UTILITY})-(${PALETTE})\\b`,
  ].join("|"),
);

const files = process.argv.length > 2 ? process.argv.slice(2) : CLEANED_VIEWS;
let hits = 0;

for (const file of files) {
  let source;
  try {
    source = readFileSync(file, "utf8");
  } catch (error) {
    hits++;
    console.error(`${file}: cannot read (${error instanceof Error ? error.message : String(error)})`);
    continue;
  }
  source.split("\n").forEach((line, index) => {
    if (HARDCODED.test(line)) {
      hits++;
      console.error(`${file}:${index + 1}: ${line.trim()}`);
    }
  });
}

if (hits > 0) {
  console.error(
    `\nFAIL: ${hits} hard-coded UI value(s). Use role tokens from src/styles/global.css and components from src/components/ui/ instead.`,
  );
  process.exit(1);
}
console.log(`OK: no hard-coded UI values in ${files.length} file(s).`);
