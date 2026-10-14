#!/usr/bin/env node
/**
 * Generate a terminal-style ASCII monogram for Prisdvl.
 * Local-only, no third-party image APIs. Not a photographic likeness.
 *
 * Usage:
 *   node scripts/generate-ascii.mjs [output.svg]
 */
import path from "path";
import { fileURLToPath } from "url";
import { COLORS, escapeXml, writeSvgAtomic } from "./lib/svg-util.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outPath = path.resolve(root, process.argv[2] || "assets/ascii-portrait.svg");

const FRAME = [
  "┌──────────────────────────────┐",
  "│  ████████╗                   │",
  "│  ██╔═══██║  prisdvl@dev      │",
  "│  ██║   ██║  ─────────────    │",
  "│  ████████║  Java · AI · Dist │",
  "│  ██╔═════╝                   │",
  "│  ██║        nexus · echo     │",
  "│  ╚═╝        timer · edumark  │",
  "│                              │",
  "│  [[ status: online ]]        │",
  "└──────────────────────────────┘",
];

function fillForChar(ch) {
  if ("┌┐└┘│─".includes(ch)) return COLORS.border;
  if (ch === "█") return COLORS.accent;
  if ("═║╔╗╚╝".includes(ch)) return COLORS.muted;
  if (ch === "·") return COLORS.muted;
  return COLORS.text;
}

function renderLine(line, y, fontSize, lineHeight) {
  const spans = [];
  let i = 0;
  while (i < line.length) {
    // Keep status token as a single accent span
    if (line.slice(i).startsWith("[[ status: online ]]")) {
      const token = "[[ status: online ]]";
      spans.push(`<tspan fill="${COLORS.accent}">${escapeXml(token)}</tspan>`);
      i += token.length;
      continue;
    }
    const fill = fillForChar(line[i]);
    let j = i + 1;
    while (
      j < line.length &&
      !line.slice(j).startsWith("[[ status: online ]]") &&
      fillForChar(line[j]) === fill
    ) {
      j++;
    }
    spans.push(`<tspan fill="${fill}">${escapeXml(line.slice(i, j))}</tspan>`);
    i = j;
  }
  const baseline = 28 + y * lineHeight;
  return `<text x="20" y="${baseline}" font-family="JetBrains Mono, Fira Code, ui-monospace, monospace" font-size="${fontSize}" xml:space="preserve">${spans.join("")}</text>`;
}

function buildSvg() {
  const fontSize = 13;
  const lineHeight = 18;
  const width = 420;
  const height = 28 + FRAME.length * lineHeight + 20;
  const lines = FRAME.map((line, idx) => renderLine(line, idx, fontSize, lineHeight)).join("\n  ");

  return `<?xml version="1.0" encoding="utf-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Prisdvl ASCII terminal monogram">
  <title>Prisdvl ASCII monogram</title>
  <desc>Terminal-style monogram identity block for Prisdvl. Not a photographic portrait.</desc>
  <rect width="100%" height="100%" fill="${COLORS.bg}"/>
  <rect x="1" y="1" width="${width - 2}" height="${height - 2}" fill="none" stroke="${COLORS.border}" stroke-width="1"/>
  ${lines}
</svg>
`;
}

await writeSvgAtomic(outPath, buildSvg());
console.log("Wrote", outPath);
