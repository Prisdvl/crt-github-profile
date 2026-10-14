#!/usr/bin/env node
/**
 * Sync assets/ascii-art.txt into a colored markup JSON for the right-panel
 * compositor, and clear the ASCII block region in terminal.yml (left column
 * is typing commands only).
 *
 * Usage:
 *   node scripts/inject-ascii-into-terminal.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  colorizeArt,
  trimArtLeading,
} from "./lib/ascii-colorize.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const artPath = path.join(root, "assets", "ascii-art.txt");
const markupPath = path.join(root, "assets", "ascii-art.markup.json");
const ymlPath = path.join(root, "terminal.yml");

const BEGIN = "# BEGIN ASCII ART";
const END = "# END ASCII ART";

const art = fs
  .readFileSync(artPath, "utf8")
  .replace(/\r\n/g, "\n")
  .replace(/\r/g, "\n")
  .trimEnd()
  .split("\n");

const trimmed = trimArtLeading(art);
const markupLines = colorizeArt(trimmed);

fs.writeFileSync(
  markupPath,
  JSON.stringify(
    {
      lines: markupLines,
      rawTrimmed: trimmed,
      lineCount: markupLines.length,
    },
    null,
    2
  ) + "\n"
);

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
const stub = [
  "",
  "  # Portrait is composed on the right by scripts/compose-split-terminal.mjs",
  "  # (see assets/ascii-art.markup.json). Left column = typing commands only.",
  "  ",
].join("\n");

fs.writeFileSync(ymlPath, `${before}${stub}${after}`);
console.log(
  `Synced ${art.length} art lines → ${path.relative(root, markupPath)} (right panel); cleared ASCII block in terminal.yml`
);
