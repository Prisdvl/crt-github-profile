#!/usr/bin/env node
/**
 * Generate a terminal-style ASCII monogram from profile.config.json.
 * Local-only, no third-party image APIs. Not a photographic likeness.
 *
 * Usage:
 *   node scripts/generate-ascii.mjs [output.svg] [--config profile.config.json]
 */
import path from "path";
import { fileURLToPath } from "url";
import { escapeXml, writeSvgAtomic } from "./lib/svg-util.mjs";
import { loadProfileConfig } from "./lib/profile-config.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function parseArgs(argv) {
  const result = { out: "assets/ascii-portrait.svg", config: undefined };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--config") result.config = argv[++i];
    else if (argv[i] === "--out") result.out = argv[++i];
    else if (!argv[i].startsWith("-")) result.out = argv[i];
    else throw new Error(`Unknown arg: ${argv[i]}`);
  }
  return result;
}

function fit(value, length) {
  const text = String(value ?? "");
  return text.length >= length ? text.slice(0, length) : text.padEnd(length, " ");
}

function frameCell(content) {
  return `\u2502${fit(content, 30)}\u2502`;
}

function buildFrame(config) {
  const username = fit(`${config.username}@dev`, 17);
  const headline = fit(config.headline || "developer", 17);
  const availability = fit(config.availability || "online", 10);
  const firstProjects = fit(
    config.projects.slice(0, 2).map((project) => project.name).join(" \u00b7 "),
    17
  );
  const laterProjects = fit(
    config.projects.slice(2, 4).map((project) => project.name).join(" \u00b7 "),
    17
  );
  const statusToken = `[[ status: ${availability} ]]`;

  return {
    statusToken,
    lines: [
      `\u250c${"\u2500".repeat(30)}\u2510`,
      frameCell(`  \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557${" ".repeat(19)}`),
      frameCell(`  \u2588\u2588\u2554\u2550\u2550\u2550\u2588\u2588\u2551  ${username}`),
      frameCell(`  \u2588\u2588\u2551   \u2588\u2588\u2551  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500    `),
      frameCell(`  \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2551  ${headline}`),
      frameCell(`  \u2588\u2588\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u255d${" ".repeat(19)}`),
      frameCell(`  \u2588\u2588\u2551        ${firstProjects}`),
      frameCell(`  \u255a\u2550\u255d        ${laterProjects}`),
      frameCell(""),
      frameCell(`  ${statusToken}${" ".repeat(Math.max(0, 28 - (2 + statusToken.length)))}`),
      `\u2514${"\u2500".repeat(30)}\u2518`,
    ],
  };
}

function fillForChar(ch, theme) {
  if ("\u250c\u2510\u2514\u2518\u2502\u2500".includes(ch)) return theme.border;
  if (ch === "\u2588") return theme.accent;
  if ("\u2550\u2551\u2554\u2557\u255a\u255d".includes(ch)) return theme.muted;
  if (ch === "\u00b7") return theme.muted;
  return theme.text;
}

function renderLine(line, y, fontSize, lineHeight, theme, statusToken) {
  const spans = [];
  let i = 0;
  while (i < line.length) {
    if (line.slice(i).startsWith(statusToken)) {
      spans.push(`<tspan fill="${theme.accent}">${escapeXml(statusToken)}</tspan>`);
      i += statusToken.length;
      continue;
    }
    const fill = fillForChar(line[i], theme);
    let j = i + 1;
    while (
      j < line.length &&
      !line.slice(j).startsWith(statusToken) &&
      fillForChar(line[j], theme) === fill
    ) {
      j++;
    }
    spans.push(`<tspan fill="${fill}">${escapeXml(line.slice(i, j))}</tspan>`);
    i = j;
  }
  const baseline = 28 + y * lineHeight;
  return `<text x="20" y="${baseline}" font-family="JetBrains Mono, Fira Code, ui-monospace, monospace" font-size="${fontSize}" xml:space="preserve">${spans.join("")}</text>`;
}

function buildSvg(config) {
  const { lines, statusToken } = buildFrame(config);
  const fontSize = 13;
  const lineHeight = 18;
  const width = 420;
  const height = 28 + lines.length * lineHeight + 20;
  const renderedLines = lines
    .map((line, idx) =>
      renderLine(line, idx, fontSize, lineHeight, config.theme, statusToken)
    )
    .join("\n  ");
  const label = `${config.displayName} ASCII terminal monogram`;

  return `<?xml version="1.0" encoding="utf-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(label)}">
  <title>${escapeXml(label)}</title>
  <desc>${escapeXml(`Terminal-style monogram identity block for ${config.displayName}. Not a photographic portrait.`)}</desc>
  <rect width="100%" height="100%" fill="${config.theme.bg}"/>
  <rect x="1" y="1" width="${width - 2}" height="${height - 2}" fill="none" stroke="${config.theme.border}" stroke-width="1"/>
  ${renderedLines}
</svg>
`;
}

const args = parseArgs(process.argv.slice(2));
const config = await loadProfileConfig({ root, configPath: args.config });
const outPath = path.resolve(root, args.out);
await writeSvgAtomic(outPath, buildSvg(config));
console.log("Wrote", outPath);
