/**
 * Load and validate the single source of truth for profile generation.
 *
 * The validator intentionally keeps the configuration small and explicit:
 * every error names the field that needs attention so a new user can fix it
 * without reading the generator source.
 */
import fs from "fs/promises";
import path from "path";
import { DEFAULT_THEME, normalizeTheme } from "./theme.mjs";

export const DEFAULT_CONFIG_FILE = "profile.config.json";

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const GITHUB_USERNAME = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;

export class ConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = "ConfigError";
  }
}

function fail(field, message) {
  throw new ConfigError(`${field}: ${message}`);
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function requireObject(value, field) {
  if (!isPlainObject(value)) fail(field, "must be a JSON object");
  return value;
}

function requireString(value, field, { allowEmpty = false } = {}) {
  if (typeof value !== "string") fail(field, "must be a string");
  const trimmed = value.trim();
  if (!allowEmpty && trimmed.length === 0) fail(field, "must not be empty");
  return value;
}

function requireBoolean(value, field) {
  if (typeof value !== "boolean") fail(field, "must be true or false");
  return value;
}

function validateColor(value, field) {
  requireString(value, field);
  if (!HEX_COLOR.test(value)) {
    fail(field, `must be a hex color such as #212121 (received ${JSON.stringify(value)})`);
  }
  return value;
}

function validateStringArray(value, field, { allowEmpty = false } = {}) {
  if (!Array.isArray(value)) fail(field, "must be an array of strings");
  if (!allowEmpty && value.length === 0) fail(field, "must contain at least one entry");
  return value.map((entry, index) => requireString(entry, `${field}[${index}]`));
}

function validateTimezone(value, field) {
  requireString(value, field);
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
  } catch {
    fail(field, `must be a valid IANA timezone such as Asia/Shanghai (received ${JSON.stringify(value)})`);
  }
  return value;
}

function validateTheme(raw, field = "theme") {
  requireObject(raw, field);
  const theme = {};
  const mapping = {
    background: "background",
    surface: "surface",
    text: "text",
    muted: "muted",
    accent: "accent",
  };
  for (const [key, sourceKey] of Object.entries(mapping)) {
    if (raw[sourceKey] !== undefined) {
      theme[key] = validateColor(raw[sourceKey], `${field}.${sourceKey}`);
    }
  }
  if (raw.heatmap !== undefined) {
    if (!Array.isArray(raw.heatmap) || raw.heatmap.length !== 5) {
      fail(`${field}.heatmap`, "must be an array of exactly five colors (levels 0-4)");
    }
    theme.heatmap = raw.heatmap.map((color, index) =>
      validateColor(color, `${field}.heatmap[${index}]`)
    );
  }
  return normalizeTheme(theme);
}

function validateSkills(raw, field = "skills") {
  if (!Array.isArray(raw)) fail(field, "must be an array");
  return raw.map((entry, index) => {
    const itemField = `${field}[${index}]`;
    requireObject(entry, itemField);
    const name = requireString(entry.name, `${itemField}.name`);
    if (typeof entry.level !== "number" || !Number.isFinite(entry.level)) {
      fail(`${itemField}.level`, "must be a number between 0 and 100");
    }
    if (entry.level < 0 || entry.level > 100) {
      fail(`${itemField}.level`, `must be between 0 and 100 (received ${entry.level})`);
    }
    return { name, level: entry.level };
  });
}

function validateProjects(raw, field = "projects") {
  if (!Array.isArray(raw)) fail(field, "must be an array");
  if (raw.length === 0) {
    fail(field, "must contain at least one project so the profile has a real project section");
  }
  return raw.map((entry, index) => {
    const itemField = `${field}[${index}]`;
    requireObject(entry, itemField);
    const name = requireString(entry.name, `${itemField}.name`);
    const stack = requireString(entry.stack, `${itemField}.stack`);
    const description = requireString(
      entry.description ?? entry.about,
      `${itemField}.description`
    );
    const url = requireString(entry.url ?? entry.href, `${itemField}.url`);
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      fail(`${itemField}.url`, "must be a valid HTTP(S) URL");
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      fail(`${itemField}.url`, "must use the http or https protocol");
    }
    return { name, stack, description, url };
  });
}

function validateTerminal(raw, field = "terminal") {
  if (raw === undefined) return undefined;
  requireObject(raw, field);
  const result = {};
  if (raw.focus !== undefined) {
    result.focus = validateStringArray(raw.focus, `${field}.focus`);
  }
  for (const key of ["runtime", "async", "topics", "now", "status"]) {
    if (raw[key] !== undefined) {
      result[key] = requireString(raw[key], `${field}.${key}`);
    }
  }
  if (raw.interests !== undefined) {
    if (!Array.isArray(raw.interests)) fail(`${field}.interests`, "must be an array");
    result.interests = raw.interests.map((entry, index) => {
      const itemField = `${field}.interests[${index}]`;
      requireObject(entry, itemField);
      return {
        label: requireString(entry.label, `${itemField}.label`),
        detail: requireString(entry.detail, `${itemField}.detail`),
      };
    });
  }
  if (raw.highlights !== undefined) {
    result.highlights = validateStringArray(raw.highlights, `${field}.highlights`, {
      allowEmpty: true,
    });
  }
  return result;
}

function validateOptions(raw, field = "options") {
  if (raw === undefined) return { animatedTerminal: true, contributionHeatmap: true };
  requireObject(raw, field);
  const options = {
    animatedTerminal: true,
    contributionHeatmap: true,
  };
  if (raw.animatedTerminal !== undefined) {
    options.animatedTerminal = requireBoolean(
      raw.animatedTerminal,
      `${field}.animatedTerminal`
    );
  }
  if (raw.contributionHeatmap !== undefined) {
    options.contributionHeatmap = requireBoolean(
      raw.contributionHeatmap,
      `${field}.contributionHeatmap`
    );
  }
  return options;
}

/**
 * Normalize a raw object into the shape used by all generators.
 * The returned object is safe to pass around and contains only validated data.
 */
export function validateProfileConfig(raw) {
  requireObject(raw, "profile.config.json");
  const username = requireString(raw.username, "username");
  if (!GITHUB_USERNAME.test(username)) {
    fail(
      "username",
      "must be a valid GitHub username (letters, numbers, and single hyphens, 1-39 characters)"
    );
  }

  const displayName = raw.displayName === undefined
    ? username
    : requireString(raw.displayName, "displayName");
  const headline = raw.headline === undefined
    ? ""
    : requireString(raw.headline, "headline", { allowEmpty: true });
  const timezone = raw.timezone === undefined
    ? "UTC"
    : validateTimezone(raw.timezone, "timezone");
  const bio = raw.bio === undefined
    ? ""
    : requireString(raw.bio, "bio", { allowEmpty: true });
  const availability = raw.availability === undefined
    ? ""
    : requireString(raw.availability, "availability", { allowEmpty: true });

  const theme = raw.theme === undefined
    ? normalizeTheme({})
    : validateTheme(raw.theme);
  const skills = validateSkills(raw.skills ?? []);
  const projects = validateProjects(raw.projects);
  const terminal = validateTerminal(raw.terminal);
  const options = validateOptions(raw.options);

  return {
    username,
    displayName,
    headline,
    timezone,
    bio,
    availability,
    theme,
    skills,
    projects,
    terminal,
    options,
  };
}

export function resolveConfigPath(root, configPath) {
  const selected = configPath || process.env.PROFILE_CONFIG || DEFAULT_CONFIG_FILE;
  return path.isAbsolute(selected) ? selected : path.resolve(root, selected);
}

/**
 * Read, parse, and validate profile.config.json.
 * Missing files are deliberately errors: a missing config must not look like
 * a successful build with stale or fabricated data.
 */
export async function loadProfileConfig({
  root = process.cwd(),
  configPath,
  required = true,
} = {}) {
  const resolved = resolveConfigPath(root, configPath);
  let raw;
  try {
    raw = await fs.readFile(resolved, "utf8");
  } catch (err) {
    if (err.code === "ENOENT" && !required) return null;
    throw new ConfigError(
      `Configuration file not found: ${resolved}. Create it with the fields shown in README.md or copy profile.config.json from the template.`
    );
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new ConfigError(`Configuration file is not valid JSON: ${resolved}\n${err.message}`);
  }

  return validateProfileConfig(parsed);
}

/** Small helper used by the terminal config template renderer. */
export function yamlQuoted(value) {
  return JSON.stringify(String(value))
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export { DEFAULT_THEME };
