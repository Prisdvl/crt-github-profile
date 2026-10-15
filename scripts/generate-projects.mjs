#!/usr/bin/env node
/**
 * Terminal-styled projects card driven by profile.config.json.
 *
 * Usage:
 *   node scripts/generate-projects.mjs [--out assets/projects.svg] [--config profile.config.json]
 */
import path from "path";
import { fileURLToPath } from "url";
import { escapeXml, writeSvgAtomic } from "./lib/svg-util.mjs";
import { FONT_MONO, terminalFrame } from "./lib/theme.mjs";
import { loadProfileConfig } from "./lib/profile-config.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function parseArgs(argv) {
  const out = { out: "assets/projects.svg", config: undefined };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--out") out.out = argv[++i];
    else if (argv[i] === "--config") out.config = argv[++i];
    else throw new Error(`Unknown arg: ${argv[i]}`);
  }
  return out;
}

function pad(s, n) {
  const t = String(s);
  return t.length >= n ? t.slice(0, n) : t + " ".repeat(n - t.length);
}

function buildSvg(config) {
  const { text, muted, accent, kraft, sky } = config.theme;
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
    [accent, `${config.username}@dev:~$ `],
    [text, "column -t ~/projects.tsv"],
  ]);
  line([
    [muted, pad("repo", 28)],
    [muted, pad("stack", 14)],
    [muted, "about"],
  ]);

  for (const project of config.projects) {
    line([
      [kraft, pad(project.name, 28)],
      [sky, pad(project.stack, 14)],
      [text, project.description],
    ]);
  }

  line([[muted, ""]], 10);
  line([
    [accent, `${config.username}@dev:~$ `],
    [text, "echo $STATUS"],
  ]);
  line([
    [config.theme.olive || accent, config.availability || "online"],
    [muted, "  \u00b7  "],
    [sky, `github.com/${config.username}`],
  ]);

  const width = 1000;
  const height = 36 + 14 + y + 20;

  return terminalFrame({
    width,
    height,
    title: `${config.username}@projects: ~`,
    ariaLabel: `Selected projects for ${config.displayName}`,
    desc: `Terminal-styled project list for ${config.displayName}.`,
    body: rows.join("\n    "),
    theme: config.theme,
  });
}

const args = parseArgs(process.argv.slice(2));
const config = await loadProfileConfig({ root, configPath: args.config });
const outPath = path.resolve(root, args.out);
await writeSvgAtomic(outPath, buildSvg(config));
console.log("Wrote", outPath);
