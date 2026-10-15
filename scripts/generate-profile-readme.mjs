#!/usr/bin/env node
/**
 * Render dist/PROFILE-README.md from profile.config.json.
 *
 * This file is intentionally separate from the repository README: the root
 * README promotes the template project, while this output belongs in a user's
 * GitHub profile repository.
 *
 * Usage:
 *   node scripts/generate-profile-readme.mjs [--config profile.config.json] [--out dist/PROFILE-README.md]
 */
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { loadProfileConfig } from "./lib/profile-config.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const templatePath = path.join(root, "templates", "profile-readme.md.template");

function parseArgs(argv) {
  const result = {
    config: undefined,
    out: "dist/PROFILE-README.md",
  };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--config") result.config = argv[++i];
    else if (argv[i] === "--out") result.out = argv[++i];
    else throw new Error(`Unknown arg: ${argv[i]}`);
  }
  return result;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeMarkdownInline(value) {
  const special = new Set("\\`*_{}[]()#+!|>~".split(""));
  return [...String(value)]
    .map((character) => (special.has(character) ? `\\${character}` : character))
    .join("");
}

function buildTerminalBlock(config) {
  const alt = escapeHtml(
    `${config.displayName} terminal profile${config.headline ? `: ${config.headline}` : ""}`
  );
  if (!config.options.animatedTerminal) {
    return `<p align="center">
  <img src="assets/terminal-static-enhanced.svg" alt="${alt}" width="1000">
</p>`;
  }
  return `<p align="center">
  <picture>
    <source media="(prefers-reduced-motion: reduce)" srcset="assets/terminal-static-enhanced.svg">
    <img src="assets/terminal-enhanced.svg" alt="${alt}" width="1000">
  </picture>
</p>`;
}

function buildSvgOnlyBlock(config) {
  const asset = config.options.animatedTerminal
    ? "assets/terminal-enhanced.svg"
    : "assets/terminal-static-enhanced.svg";
  const alt = escapeHtml(
    `${config.displayName} terminal profile${config.headline ? `: ${config.headline}` : ""}`
  );
  return `<p align="center">
  <img src="${asset}" alt="${alt}" width="1000">
</p>`;
}

function buildSkillsBlock(config) {
  if (!config.skills.length) return "";
  const rows = config.skills.map(
    (skill) => `- **${escapeMarkdownInline(skill.name)}** - ${Math.round(skill.level)}%`
  );
  return `## Skills\n\n${rows.join("\n")}`;
}

function buildProjectsBlock(config) {
  return config.projects
    .map((project) => {
      const name = escapeMarkdownInline(project.name);
      const description = escapeMarkdownInline(project.description);
      const stack = escapeMarkdownInline(project.stack);
      return `- **[${name}](${project.url})** - \`${stack}\` \u00b7 ${description}`;
    })
    .join("\n");
}

function buildContributionBlock(config, placeholder) {
  if (!config.options.contributionHeatmap) return "";
  const alt = escapeHtml(`GitHub contribution heatmap for ${config.displayName}`);
  const image = `<p align="center">
  <img src="assets/contribution.svg" alt="${alt}" width="1000">
</p>`;
  if (!placeholder) return image;
  return `${image}\n\n> Live contribution data is currently unavailable; the image is a marked placeholder.`;
}

function renderTemplate(template, config, { contributionPlaceholder = false } = {}) {
  if (config.options.readmeStyle === "svg-only") {
    return `${buildSvgOnlyBlock(config)}\n`;
  }
  const headlineLine = config.headline
    ? `**${escapeMarkdownInline(config.headline)}**`
    : "";
  const availabilityLine = config.availability
    ? `\n\n> ${escapeMarkdownInline(config.availability)}`
    : "";
  const generatedNote =
    "Generated from `profile.config.json` with the CRT GitHub Profile template. " +
    "Run `npm run generate` after changing the configuration.";
  const values = {
    displayName: escapeMarkdownInline(config.displayName),
    githubProfileLine: `[${escapeMarkdownInline(config.username)}](https://github.com/${config.username})`,
    bio: escapeMarkdownInline(config.bio),
    headlineLine,
    availabilityLine,
    terminalBlock: buildTerminalBlock(config),
    skillsBlock: buildSkillsBlock(config),
    projectsBlock: buildProjectsBlock(config),
    contributionBlock: buildContributionBlock(config, contributionPlaceholder),
    generatedNote,
  };

  let rendered = template;
  for (const [key, value] of Object.entries(values)) {
    rendered = rendered.replaceAll(`{{${key}}}`, value);
  }
  const unresolved = rendered.match(/\{\{[^}]+\}\}/);
  if (unresolved) throw new Error(`Unresolved README placeholder: ${unresolved[0]}`);
  return rendered.replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const [config, template] = await Promise.all([
    loadProfileConfig({ root, configPath: args.config }),
    fs.readFile(templatePath, "utf8"),
  ]);
  let contributionPlaceholder = false;
  if (
    config.options.contributionHeatmap &&
    config.options.readmeStyle !== "svg-only"
  ) {
    try {
      const contributionSvg = await fs.readFile(
        path.resolve(root, "assets", "contribution.svg"),
        "utf8"
      );
      contributionPlaceholder = contributionSvg.includes("[placeholder]");
    } catch {
      contributionPlaceholder = true;
    }
  }
  const outPath = path.isAbsolute(args.out) ? args.out : path.resolve(root, args.out);
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(
    outPath,
    renderTemplate(template, config, { contributionPlaceholder }),
    "utf8"
  );
  console.log(`Wrote ${path.relative(root, outPath)}`);
  console.log(
    "Copy this file to the root of your GitHub profile repository, then keep the referenced assets/ files next to it."
  );
}

main().catch((err) => {
  console.error("ERROR:", err.message || err);
  process.exit(1);
});
