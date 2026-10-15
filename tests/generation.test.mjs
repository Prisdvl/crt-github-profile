import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { DOMParser } from "@xmldom/xmldom";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const svgTerminalCli = path.join(
  root,
  "node_modules",
  "svg-terminal",
  "dist",
  "cli.js"
);

function runNode(script, args = []) {
  const result = spawnSync(process.execPath, [path.join(root, "scripts", script), ...args], {
    cwd: root,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(
      `${script} failed (${result.status})\n${result.stdout || ""}\n${result.stderr || ""}`
    );
  }
  return result.stdout;
}

function runSvgTerminal(args) {
  const result = spawnSync(process.execPath, [svgTerminalCli, ...args], {
    cwd: root,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(
      `svg-terminal failed (${result.status})\n${result.stdout || ""}\n${result.stderr || ""}`
    );
  }
}

function assertSvg(file) {
  return fs.readFile(file, "utf8").then((raw) => {
    const doc = new DOMParser().parseFromString(raw, "application/xml");
    assert.equal(doc.getElementsByTagName("parsererror").length, 0, file);
    assert.equal(doc.documentElement.nodeName.toLowerCase(), "svg", file);
    return raw;
  });
}

async function makeFixture() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "crt-profile-test-"));
  const configPath = path.join(dir, "profile.config.json");
  const config = {
    username: "octocat",
    displayName: "Octo Cat",
    headline: "Backend Builder",
    timezone: "UTC",
    bio: "Shipping small systems.",
    availability: "Open to collaboration",
    theme: {
      background: "#101820",
      surface: "#1b2733",
      text: "#f4f4f4",
      muted: "#91a0ae",
      accent: "#ff5500",
    },
    skills: [
      { name: "Node.js", level: 88 },
      { name: "SQL", level: 44 },
    ],
    projects: [
      {
        name: "octo-api",
        stack: "Node / SQL",
        description: "A small API.",
        url: "https://github.com/octocat/octo-api",
      },
      {
        name: "octo-tools",
        stack: "TypeScript",
        description: "Developer tooling.",
        url: "https://github.com/octocat/octo-tools",
      },
    ],
    options: {
      animatedTerminal: true,
      contributionHeatmap: false,
    },
  };
  await fs.writeFile(configPath, JSON.stringify(config, null, 2) + "\n", "utf8");
  return { dir, configPath, config };
}

async function buildTerminalFixture(fixture) {
  const generatedConfig = path.join(fixture.dir, "terminal.generated.yml");
  const dynamic = path.join(fixture.dir, "terminal.svg");
  const staticFile = path.join(fixture.dir, "terminal-static.svg");
  runNode("prepare-terminal-config.mjs", [
    "--config",
    fixture.configPath,
    "--out",
    generatedConfig,
  ]);
  runSvgTerminal(["generate", "--config", generatedConfig, "--output", dynamic]);
  runSvgTerminal([
    "generate",
    "--config",
    generatedConfig,
    "--output",
    staticFile,
    "--static",
  ]);
  return { generatedConfig, dynamic, staticFile };
}

test("custom config drives terminal, projects, ASCII, and README output", async (t) => {
  runNode("inject-ascii-into-terminal.mjs");
  const fixture = await makeFixture();
  t.after(() => fs.rm(fixture.dir, { recursive: true, force: true }));

  const { dynamic, staticFile } = await buildTerminalFixture(fixture);
  const dynamicEnhanced = path.join(fixture.dir, "terminal-enhanced.svg");
  const staticEnhanced = path.join(fixture.dir, "terminal-static-enhanced.svg");
  const projectsSvg = path.join(fixture.dir, "projects.svg");
  const asciiSvg = path.join(fixture.dir, "ascii.svg");
  const profileReadme = path.join(fixture.dir, "PROFILE-README.md");
  const rootReadmeBefore = await fs.readFile(path.join(root, "README.md"), "utf8");

  runNode("compose-split-terminal.mjs", [
    dynamic,
    "--config",
    fixture.configPath,
  ]);
  runNode("compose-split-terminal.mjs", [
    staticFile,
    "--static",
    "--config",
    fixture.configPath,
  ]);
  runNode("enhance-crt.mjs", [
    dynamic,
    dynamicEnhanced,
    "--linespace",
    "4",
    "--line-opacity",
    "0.03",
    "--glow",
    "1.05",
    "--vignette",
    "0.22",
  ]);
  runNode("enhance-crt.mjs", [
    staticFile,
    staticEnhanced,
    "--linespace",
    "4",
    "--line-opacity",
    "0.03",
    "--glow",
    "1.05",
    "--vignette",
    "0.22",
    "--static",
  ]);
  runNode("compose-unified-profile.mjs", [
    dynamicEnhanced,
    "--config",
    fixture.configPath,
    "--no-activity",
  ]);
  runNode("compose-unified-profile.mjs", [
    staticEnhanced,
    "--config",
    fixture.configPath,
    "--no-activity",
  ]);
  runNode("generate-ascii.mjs", [
    "--config",
    fixture.configPath,
    "--out",
    asciiSvg,
  ]);
  runNode("generate-projects.mjs", [
    "--config",
    fixture.configPath,
    "--out",
    projectsSvg,
  ]);
  runNode("generate-profile-readme.mjs", [
    "--config",
    fixture.configPath,
    "--out",
    profileReadme,
  ]);

  const dynamicRaw = await assertSvg(dynamicEnhanced);
  const staticRaw = await assertSvg(staticEnhanced);
  const projectsRaw = await assertSvg(projectsSvg);
  const asciiRaw = await assertSvg(asciiSvg);
  const readmeRaw = await fs.readFile(profileReadme, "utf8");

  assert.match(dynamicRaw, /unifiedTail/);
  assert.match(dynamicRaw, /#ff5500/);
  assert.match(dynamicRaw, /octo-api/);
  assert.doesNotMatch(staticRaw, /scanline-overlay/);
  assert.match(projectsRaw, /octo-api/);
  assert.match(projectsRaw, /#ff5500/);
  assert.match(asciiRaw, /Octo Cat/);
  assert.match(readmeRaw, /assets\/terminal-enhanced\.svg/);
  assert.match(readmeRaw, /assets\/terminal-static-enhanced\.svg/);
  assert.match(readmeRaw, /https:\/\/github\.com\/octocat\/octo-api/);
  assert.doesNotMatch(readmeRaw, /Prisdvl/);
  assert.equal(await fs.readFile(path.join(root, "README.md"), "utf8"), rootReadmeBefore);
});

test("running the local composition twice is idempotent", async (t) => {
  runNode("inject-ascii-into-terminal.mjs");
  const fixture = await makeFixture();
  t.after(() => fs.rm(fixture.dir, { recursive: true, force: true }));
  const { dynamic } = await buildTerminalFixture(fixture);

  const compose = async () => {
    const candidate = path.join(fixture.dir, `idempotent-${Date.now()}-${Math.random()}.svg`);
    await fs.copyFile(dynamic, candidate);
    runNode("compose-split-terminal.mjs", [
      candidate,
      "--config",
      fixture.configPath,
    ]);
    const enhanced = `${candidate}.enhanced.svg`;
    runNode("enhance-crt.mjs", [
      candidate,
      enhanced,
      "--linespace",
      "4",
      "--line-opacity",
      "0.03",
      "--glow",
      "1.05",
      "--vignette",
      "0.22",
    ]);
    runNode("compose-unified-profile.mjs", [
      enhanced,
      "--config",
      fixture.configPath,
      "--no-activity",
    ]);
    return fs.readFile(enhanced, "utf8");
  };

  const first = await compose();
  const second = await compose();
  assert.equal(first, second);
});

test("contribution generator emits a clearly marked placeholder when forced", async (t) => {
  const fixture = await makeFixture();
  t.after(() => fs.rm(fixture.dir, { recursive: true, force: true }));
  const out = path.join(fixture.dir, "contribution.svg");
  runNode("generate-contribution.mjs", [
    "--config",
    fixture.configPath,
    "--placeholder",
    "--out",
    out,
  ]);
  const raw = await assertSvg(out);
  assert.match(raw, /PLACEHOLDER: live contribution data was unavailable/);
  assert.match(raw, /octocat@activity/);
});

test("svg-only Profile README emits only the configured terminal image", async (t) => {
  const fixture = await makeFixture();
  t.after(() => fs.rm(fixture.dir, { recursive: true, force: true }));
  fixture.config.options = {
    animatedTerminal: true,
    contributionHeatmap: false,
    readmeStyle: "svg-only",
  };
  await fs.writeFile(
    fixture.configPath,
    JSON.stringify(fixture.config, null, 2) + "\n",
    "utf8"
  );
  const out = path.join(fixture.dir, "PROFILE-README.md");
  runNode("generate-profile-readme.mjs", [
    "--config",
    fixture.configPath,
    "--out",
    out,
  ]);
  const raw = await fs.readFile(out, "utf8");
  assert.match(raw, /assets\/terminal-enhanced\.svg/);
  assert.doesNotMatch(raw, /assets\/terminal-static-enhanced\.svg/);
  assert.doesNotMatch(raw, /## Skills|smoke-alpha|octo-api|Independent smoke test biography/);
  assert.equal((raw.match(/<img\b/g) || []).length, 1);
});
