import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ConfigError,
  loadProfileConfig,
  validateProfileConfig,
} from "../scripts/lib/profile-config.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("default profile.config.json loads and preserves the current defaults", async () => {
  const raw = JSON.parse(
    await fs.readFile(path.join(root, "profile.config.json"), "utf8")
  );
  const config = await loadProfileConfig({ root });
  assert.equal(config.username, raw.username);
  assert.equal(config.displayName, raw.displayName ?? raw.username);
  assert.equal(config.projects.length, raw.projects.length);
  assert.equal(config.skills.length, raw.skills.length);
  assert.equal(config.theme.accent, raw.theme?.accent ?? "#10A37F");
});

test("missing configuration files fail instead of looking successful", async () => {
  await assert.rejects(
    loadProfileConfig({ root, configPath: "does-not-exist.json" }),
    (error) =>
      error instanceof ConfigError &&
      error.message.includes("Configuration file not found")
  );
});

test("invalid username, colors, skills, URLs, timezones, and empty projects are rejected", () => {
  const base = {
    username: "octocat",
    projects: [
      {
        name: "demo",
        stack: "Node",
        description: "demo",
        url: "https://github.com/octocat/demo",
      },
    ],
  };

  assert.throws(
    () => validateProfileConfig({ ...base, username: "-bad" }),
    /username: must be a valid GitHub username/
  );
  assert.throws(
    () => validateProfileConfig({ ...base, theme: { accent: "teal" } }),
    /theme\.accent: must be a hex color/
  );
  assert.throws(
    () =>
      validateProfileConfig({
        ...base,
        skills: [{ name: "Node", level: 101 }],
      }),
    /skills\[0\]\.level: must be between 0 and 100/
  );
  assert.throws(
    () =>
      validateProfileConfig({
        ...base,
        projects: [
          {
            name: "bad",
            stack: "Node",
            description: "bad",
            url: "ftp://example.com/bad",
          },
        ],
      }),
    /projects\[0\]\.url: must use the http or https protocol/
  );
  assert.throws(
    () => validateProfileConfig({ ...base, timezone: "Mars/OlympusMons" }),
    /timezone: must be a valid IANA timezone/
  );
  assert.throws(
    () => validateProfileConfig({ ...base, projects: [] }),
    /projects: must contain at least one project/
  );
  assert.throws(
    () =>
      validateProfileConfig({
        ...base,
        options: { readmeStyle: "minimal" },
      }),
    /options\.readmeStyle: must be either "full" or "svg-only"/
  );
});
