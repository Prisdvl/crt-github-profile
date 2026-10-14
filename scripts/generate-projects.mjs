#!/usr/bin/env node
/**
 * Terminal-styled projects card (Claude warm palette).
 *
 * Usage:
 *   node scripts/generate-projects.mjs [--out assets/projects.svg]
 */
import path from "path";
import { fileURLToPath } from "url";
import { escapeXml, writeSvgAtomic } from "./lib/svg-util.mjs";
import { THEME, FONT_MONO, terminalFrame } from "./lib/theme.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const PROJECTS = [
  {
    name: "prisdvl-nexus",
    stack: "Java/TS/Vue",
    about: "KB · Spring AI agents · RAG · hybrid retrieval",
    href: "https://github.com/Prisdvl/prisdvl-nexus",
  },
  {
    name: "homework-grading-system",
    stack: "Python/Vue",
    about: "K-12 grading · OCR · Celery · DeepSeek",
    href: "https://github.com/Prisdvl/homework-grading-system",
  },
  {
    name: "PrisTimer",
    stack: "Rust/Vue/TS",
    about: "Tauri 2 focus timer · anchor engine",
    href: "https://github.com/Prisdvl/PrisTimer",
  },
  {
    name: "Kakuki",
    stack: "JS/TS/Python",
    about: "Django · React · MySQL application",
    href: "https://github.com/Prisdvl/Kakuki",
  },
];

function parseArgs(argv) {
  const out = { out: "assets/projects.svg" };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--out") out.out = argv[++i];
    else throw new Error(`Unknown arg: ${argv[i]}`);
  }
  return out;
}

function pad(s, n) {
  const t = String(s);
  return t.length >= n ? t.slice(0, n) : t + " ".repeat(n - t.length);
}

function buildSvg() {
  const { text, muted, accent, kraft, sky } = THEME;
  const lineH = 18;
  const rows = [];
  let y = 0;

  const line = (parts, dy = lineH) => {
    const spans = parts
      .map(([fill, s]) => `<tspan fill="${fill}">${escapeXml(s)}</tspan>`)
      .join("");
    rows.push(
      `<text x="0" y="${y}" font-family="${FONT_MONO}" font-size="12" xml:space="preserve">${spans}</text>`
    );
    y += dy;
  };

  line([
    [accent, "prisdvl@dev:~$ "],
    [text, "column -t ~/projects.tsv"],
  ]);
  line([
    [muted, pad("repo", 28)],
    [muted, pad("stack", 14)],
    [muted, "about"],
  ]);

  for (const p of PROJECTS) {
    line([
      [kraft, pad(p.name, 28)],
      [sky, pad(p.stack, 14)],
      [text, p.about],
    ]);
  }

  line([[muted, ""]], 10);
  line([
    [accent, "prisdvl@dev:~$ "],
    [text, "echo $STATUS"],
  ]);
  line([
    [THEME.olive, "online"],
    [muted, "  ·  open to collab on agents / RAG  ·  "],
    [sky, "github.com/Prisdvl"],
  ]);

  const width = 1000;
  const height = 36 + 14 + y + 20;

  return terminalFrame({
    width,
    height,
    title: "prisdvl@projects: ~",
    ariaLabel: "Selected projects for Prisdvl",
    desc: "Terminal-styled project list for Prisdvl.",
    body: rows.join("\n    "),
  });
}

const args = parseArgs(process.argv.slice(2));
const outPath = path.resolve(root, args.out);
await writeSvgAtomic(outPath, buildSvg());
console.log("Wrote", outPath);
