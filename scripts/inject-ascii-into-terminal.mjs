#!/usr/bin/env node
/**
 * Sync assets/ascii-art.txt into terminal.yml between ASCII markers.
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
  .map((line) => {
    if (!line.trim()) return `        - ""`;
    return `        - ${yamlDoubleQuote(`[[fg:cyan]]${line}[[/fg]]`)}`;
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
console.log(`Synced ${art.length} art lines into terminal.yml`);
