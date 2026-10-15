#!/usr/bin/env node
/**
 * Validate profile.config.json without generating assets.
 *
 * Usage:
 *   node scripts/validate-config.mjs [--config profile.config.json]
 */
import path from "path";
import { fileURLToPath } from "url";
import { loadProfileConfig, resolveConfigPath } from "./lib/profile-config.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function parseArgs(argv) {
  let config;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--config") config = argv[++i];
    else throw new Error(`Unknown arg: ${argv[i]}`);
  }
  return { config };
}

try {
  const args = parseArgs(process.argv.slice(2));
  const config = await loadProfileConfig({ root, configPath: args.config });
  const resolved = resolveConfigPath(root, args.config);
  console.log(`OK: ${resolved}`);
  console.log(
    `${config.displayName} (@${config.username}) \u00b7 ${config.skills.length} skills \u00b7 ${config.projects.length} projects`
  );
} catch (err) {
  console.error("INVALID:", err.message || err);
  process.exit(1);
}
