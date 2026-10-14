#!/usr/bin/env node
/**
 * Sync assets/ascii-art.txt into terminal.yml between ASCII markers.
 * Applies multi-tone blue/cyan markup (density + top-left lighting) to match
 * the CRT portrait reference look.
 *
 * Usage:
 *   node scripts/inject-ascii-into-terminal.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const artPath = path.join(root, "assets", "ascii-art.txt");
const ymlPath = path.join(root, "terminal.yml");

const BEGIN = "# BEGIN ASCII ART";
const END = "# END ASCII ART";

/** Dark → light blue ramp (theme names / hex accepted by svg-terminal). */
const TONES = ["blue", "cyan", "bright_blue", "bright_cyan", "bright_white"];

/** Visual weight high → low (dense chars are darker / deeper blue). */
const DENSITY =
  "$@B%8&WM#*oahkbdpqwmZO0QLCJUYXzcvunxrjft/\\|()1{}[]?-_+~<>i!lI;:,\"^`'." ;

function densityLevel(ch) {
  const idx = DENSITY.indexOf(ch);
  if (idx === -1) return 2;
  // Map into 0..TONES.length-1 (dense → dark)
  return Math.min(
    TONES.length - 1,
    Math.floor((idx / DENSITY.length) * TONES.length)
  );
}

/**
 * Shade a line with density + lighting bias (top-left brighter).
 * Returns markup with [[fg:...]] runs; empty/whitespace-only → "".
 */
function colorizeLine(line, row, rowCount) {
  if (!line.trim()) return "";

  const cols = [...line];
  const mid = cols.reduce((m, ch, i) => (ch !== " " ? Math.max(m, i) : m), 0);
  const width = Math.max(mid + 1, 1);

  const colored = cols.map((ch, col) => {
    if (ch === " ") return " ";
    let level = densityLevel(ch);
    // Lighting: upper-left lifts, lower-right deepens
    const nx = col / width;
    const ny = row / Math.max(rowCount - 1, 1);
    const light = 1 - (nx * 0.55 + ny * 0.45);
    if (light > 0.72) level = Math.min(TONES.length - 1, level + 2);
    else if (light > 0.45) level = Math.min(TONES.length - 1, level + 1);
    else if (light < 0.28) level = Math.max(0, level - 1);
    return { ch, tone: TONES[level] };
  });

  let out = "";
  let i = 0;
  while (i < colored.length) {
    const cell = colored[i];
    if (cell === " ") {
      out += " ";
      i++;
      continue;
    }
    let j = i + 1;
    while (
      j < colored.length &&
      colored[j] !== " " &&
      colored[j].tone === cell.tone
    ) {
      j++;
    }
    const text = colored
      .slice(i, j)
      .map((c) => c.ch)
      .join("");
    out += `[[fg:${cell.tone}]]${text}[[/fg]]`;
    i = j;
  }
  return out;
}

const art = fs
  .readFileSync(artPath, "utf8")
  .replace(/\r\n/g, "\n")
  .replace(/\r/g, "\n")
  .trimEnd()
  .split("\n");

function yamlDoubleQuote(s) {
  return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

const artLines = art
  .map((line, row) => {
    const marked = colorizeLine(line, row, art.length);
    if (!marked) return `        - ""`;
    return `        - ${yamlDoubleQuote(marked)}`;
  })
  .join("\n");

const fragment = [
  `  - block: custom`,
  `    typing: instant`,
  `    config:`,
  `      command: cat portrait.ascii`,
  `      lines:`,
  artLines,
].join("\n");

const yml = fs.readFileSync(ymlPath, "utf8");
const beginIdx = yml.indexOf(BEGIN);
const endIdx = yml.indexOf(END);

if (beginIdx === -1 || endIdx === -1 || endIdx < beginIdx) {
  console.error(
    `Missing ${BEGIN} / ${END} markers in terminal.yml. Aborting without overwrite.`
  );
  process.exit(1);
}

const before = yml.slice(0, beginIdx + BEGIN.length);
const after = yml.slice(endIdx);
const next = `${before}\n${fragment}\n  ${after}`;

fs.writeFileSync(ymlPath, next);
console.log(`Synced ${art.length} art lines into terminal.yml (multi-tone blue)`);
