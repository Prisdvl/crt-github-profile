#!/usr/bin/env node
/**
 * One-command generation pipeline.
 *
 * Usage:
 *   node scripts/generate.mjs [--config profile.config.json]
 *
 * The pipeline validates profile.config.json first, then runs the existing
 * renderers in dependency order. Each renderer keeps its own atomic SVG write
 * behavior, so a failed step cannot leave a half-written asset behind.
 */
import fs from "fs/promises";
import path from "path";
import { spawnSync } from "child_process";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import {
  loadProfileConfig,
  resolveConfigPath,
} from "./lib/profile-config.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const require = createRequire(import.meta.url);

function parseArgs(argv) {
  const result = { config: undefined };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--config") result.config = argv[++i];
    else throw new Error(`Unknown arg: ${argv[i]}`);
  }
  return result;
}

function run(command, args, label) {
  console.log(`\n[generate] ${label}`);
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    shell: false,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status}`);
  }
}

function runNode(script, args, label) {
  run(process.execPath, [path.join(root, "scripts", script), ...args], label);
}

function resolveSvgTerminalCli() {
  const candidates = [];
  try {
    const packagePath = require.resolve("svg-terminal/package.json");
    candidates.push(path.join(path.dirname(packagePath), "dist", "cli.js"));
  } catch {
    /* package may not be installed yet; fall through to a clear error */
  }
  candidates.push(path.join(root, "node_modules", "svg-terminal", "dist", "cli.js"));
  return candidates.find((candidate) => {
    try {
      return require("fs").existsSync(candidate);
    } catch {
      return false;
    }
  });
}

function runSvgTerminal(args, label) {
  const cli = resolveSvgTerminalCli();
  if (!cli) {
    throw new Error(
      "svg-terminal is not installed. Run `npm install` first, then retry `npm run generate`."
    );
  }
  run(process.execPath, [cli, ...args], label);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = await loadProfileConfig({ root, configPath: args.config });
  const resolvedConfigPath = resolveConfigPath(root, args.config);
  const configArgs = args.config ? ["--config", args.config] : [];
  const generatedConfig = ".tmp/terminal.generated.yml";

  console.log(
    `[generate] Loaded ${resolvedConfigPath} for ${config.displayName} (@${config.username})`
  );

  runNode("inject-ascii-into-terminal.mjs", [], "sync ASCII portrait markup");
  runNode(
    "prepare-terminal-config.mjs",
    [...configArgs, "--out", generatedConfig],
    "resolve terminal.yml from profile.config.json"
  );

  if (config.options.animatedTerminal) {
    runSvgTerminal(
      ["generate", "--config", generatedConfig, "--output", "assets/terminal.svg"],
      "generate animated terminal SVG"
    );
  }
  runSvgTerminal(
    [
      "generate",
      "--config",
      generatedConfig,
      "--output",
      "assets/terminal-static.svg",
      "--static",
    ],
    "generate static terminal SVG"
  );

  if (config.options.animatedTerminal) {
    runNode(
      "compose-split-terminal.mjs",
      ["assets/terminal.svg", ...configArgs],
      "compose animated split terminal"
    );
    runNode(
      "enhance-crt.mjs",
      [
        "assets/terminal.svg",
        "assets/terminal-enhanced.svg",
        "--linespace",
        "4",
        "--line-opacity",
        "0.03",
        "--glow",
        "1.05",
        "--vignette",
        "0.22",
      ],
      "apply animated CRT post-processing"
    );
  }

  runNode(
    "compose-split-terminal.mjs",
    ["assets/terminal-static.svg", "--static", ...configArgs],
    "compose static split terminal"
  );
  runNode(
    "enhance-crt.mjs",
    [
      "assets/terminal-static.svg",
      "assets/terminal-static-enhanced.svg",
      "--linespace",
      "4",
      "--line-opacity",
      "0.03",
      "--glow",
      "1.05",
      "--vignette",
      "0.22",
      "--static",
    ],
    "apply static CRT post-processing"
  );

  if (config.options.animatedTerminal) {
    runNode(
      "compose-unified-profile.mjs",
      ["assets/terminal-enhanced.svg", ...configArgs],
      "compose unified animated profile"
    );
  }
  runNode(
    "compose-unified-profile.mjs",
    ["assets/terminal-static-enhanced.svg", ...configArgs],
    "compose unified static profile"
  );

  runNode("generate-ascii.mjs", ["--out", "assets/ascii-portrait.svg", ...configArgs], "generate ASCII portrait");
  runNode("generate-projects.mjs", ["--out", "assets/projects.svg", ...configArgs], "generate projects SVG");
  if (config.options.contributionHeatmap) {
    runNode(
      "generate-contribution.mjs",
      ["--out", "assets/contribution.svg", ...configArgs],
      "generate contribution heatmap"
    );
  } else {
    console.log("[generate] contribution heatmap disabled; skipping");
  }
  runNode(
    "generate-profile-readme.mjs",
    ["--out", "dist/PROFILE-README.md", ...configArgs],
    "generate Profile README"
  );

  console.log(
    `\n[generate] Complete. Profile README: ${path.join(root, "dist", "PROFILE-README.md")}`
  );
  console.log(
    "[generate] Copy dist/PROFILE-README.md and the referenced assets/ files into your <username>/<username> repository."
  );
}

main().catch((err) => {
  console.error("\n[generate] ERROR:", err.message || err);
  process.exit(1);
});
