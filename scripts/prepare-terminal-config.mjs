#!/usr/bin/env node
/**
 * Render terminal.yml into a generated config for the current profile.
 *
 * terminal.yml remains the editable layout/template. Personal values and
 * skills come from profile.config.json so users do not edit JavaScript.
 *
 * Usage:
 *   node scripts/prepare-terminal-config.mjs [--config profile.config.json] [--out .tmp/terminal.generated.yml]
 */
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { loadProfileConfig, yamlQuoted } from "./lib/profile-config.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const templatePath = path.join(root, "terminal.yml");

// Neutral fallbacks only: a template user who omits the `terminal` block must
// never see another person's content. List-type fields render the existing
// "not configured" placeholders when empty.
const DEFAULT_TERMINAL = {
  focus: [],
  runtime: "not configured",
  async: "not configured",
  topics: "not configured",
  now: "not configured",
  status: "online",
  interests: [],
  highlights: [],
};

function parseArgs(argv) {
  const result = { out: ".tmp/terminal.generated.yml", config: undefined };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--out") result.out = argv[++i];
    else if (argv[i] === "--config") result.config = argv[++i];
    else throw new Error(`Unknown arg: ${argv[i]}`);
  }
  return result;
}

function padRight(value, length) {
  const text = String(value);
  return text.length >= length
    ? text.slice(0, length)
    : text + " ".repeat(length - text.length);
}

function scalar(value) {
  return yamlQuoted(value).slice(1, -1);
}

function buildSkillsBarLines(skills) {
  const barWidth = 10;
  const nameWidth = 14;
  if (!skills.length) {
    return `        - "[[fg:comment]]no skills configured[[/fg]]"`;
  }
  return skills
    .map((skill) => {
      const filled = Math.max(
        0,
        Math.min(barWidth, Math.round((skill.level / 100) * barWidth))
      );
      const empty = barWidth - filled;
      const line =
        `[[fg:blue]]${padRight(skill.name, nameWidth)}[[/fg]]` +
        `[[fg:cyan]]${"\u2588".repeat(filled)}[[/fg]]` +
        `[[fg:comment]]${"\u2591".repeat(empty)}[[/fg]]  ` +
        `[[fg:comment]]${Math.round(skill.level)}%[[/fg]]`;
      return `        - ${yamlQuoted(line)}`;
    })
    .join("\n");
}

function buildInterestLines(interests) {
  if (!interests.length) {
    return `        - "[[fg:comment]]define terminal.interests in profile.config.json[[/fg]]"`;
  }
  return interests
    .map((item) => {
      const line = `[[fg:magenta]]${padRight(item.label, 9)}[[/fg]]${item.detail}`;
      return `        - ${yamlQuoted(line)}`;
    })
    .join("\n");
}

function buildHighlightLines(highlights) {
  if (!highlights.length) {
    return `        - "[[fg:comment]]define terminal.highlights in profile.config.json[[/fg]]"`;
  }
  return highlights
    .map((highlight) => `        - ${yamlQuoted(`[[fg:blue]]\u25b8[[/fg]] ${highlight}`)}`)
    .join("\n");
}

function buildFocusLine(focus) {
  if (!focus.length) {
    return `[[fg:comment]]focus[[/fg]]    [[fg:comment]]not configured[[/fg]]`;
  }
  const items = focus
    .map((item) => `[[fg:yellow]]${item}[[/fg]]`)
    .join(" \u00b7 ");
  return `[[fg:comment]]focus[[/fg]]    ${items}`;
}

function renderTemplate(template, config) {
  const terminal = {
    ...DEFAULT_TERMINAL,
    ...(config.terminal || {}),
    focus: config.terminal?.focus?.length
      ? config.terminal.focus
      : DEFAULT_TERMINAL.focus,
    interests: config.terminal?.interests?.length
      ? config.terminal.interests
      : DEFAULT_TERMINAL.interests,
    highlights: config.terminal?.highlights?.length
      ? config.terminal.highlights
      : DEFAULT_TERMINAL.highlights,
  };

  const rendered = template
    .replace(
      /^[ \t]*\{\{skillsBars\}\}[ \t]*$/m,
      buildSkillsBarLines(config.skills)
    )
    .replace(
      /^[ \t]*\{\{interestLines\}\}[ \t]*$/m,
      buildInterestLines(terminal.interests)
    )
    .replace(
      /^[ \t]*\{\{highlightLines\}\}[ \t]*$/m,
      buildHighlightLines(terminal.highlights)
    )
    .replaceAll("{{username}}", scalar(config.username))
    .replaceAll("{{displayName}}", scalar(config.displayName))
    .replaceAll("{{headline}}", scalar(config.headline))
    .replaceAll("{{timezone}}", scalar(config.timezone))
    .replaceAll("{{bio}}", scalar(config.bio))
    .replaceAll("{{availability}}", scalar(config.availability))
    .replaceAll("{{terminalFocusLine}}", scalar(buildFocusLine(terminal.focus)))
    .replaceAll("{{terminalRuntime}}", scalar(terminal.runtime))
    .replaceAll("{{terminalAsync}}", scalar(terminal.async))
    .replaceAll("{{terminalTopics}}", scalar(terminal.topics))
    .replaceAll("{{terminalNow}}", scalar(terminal.now))
    .replaceAll(
      "{{terminalStatus}}",
      scalar(terminal.status || config.availability || "online")
    )
    .replaceAll("{{themeBackground}}", scalar(config.theme.bg))
    .replaceAll("{{themeSurface}}", scalar(config.theme.surface))
    .replaceAll("{{themeText}}", scalar(config.theme.text))
    .replaceAll("{{themeMuted}}", scalar(config.theme.muted))
    .replaceAll("{{themeAccent}}", scalar(config.theme.accent));

  const unresolved = rendered.match(/\{\{[^}]+\}\}/);
  if (unresolved) {
    throw new Error(`Unresolved terminal template placeholder: ${unresolved[0]}`);
  }
  return rendered;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const [config, template] = await Promise.all([
    loadProfileConfig({ root, configPath: args.config }),
    fs.readFile(templatePath, "utf8"),
  ]);
  const outputPath = path.isAbsolute(args.out)
    ? args.out
    : path.resolve(root, args.out);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, renderTemplate(template, config), "utf8");
  console.log(`Prepared terminal config \u2192 ${path.relative(root, outputPath)}`);
}

main().catch((err) => {
  console.error("ERROR:", err.message || err);
  process.exit(1);
});
