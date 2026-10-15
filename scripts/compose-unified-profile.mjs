#!/usr/bin/env node
/**
 * Append projects + contribution sections under the split identity panel,
 * producing one continuous terminal window (single chrome, complete bottom).
 *
 * Usage:
 *   node scripts/compose-unified-profile.mjs <terminal.svg> [--config profile.config.json]
 */
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import { assertParseableSvg, writeSvgAtomic, fetchText } from "./lib/svg-util.mjs";
import { applyRoundedWindowClip } from "./lib/theme.mjs";
import {
  buildProjectsSection,
  buildActivitySection,
} from "./lib/profile-sections.mjs";
import { parseContributionHtml } from "./generate-contribution.mjs";
import { loadProfileConfig } from "./lib/profile-config.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const markupPath = path.join(root, "assets", "ascii-art.markup.json");

const TITLE_BAR = 40;
const CONTENT_ORIGIN_Y = 48; // scrollContainer translate y
const LINE_PX = 10 * 1.08;
const RIGHT_X = 480;

function findById(doc, tag, id) {
  const list = doc.getElementsByTagName(tag);
  for (let i = 0; i < list.length; i++) {
    if (list[i].getAttribute("id") === id) return list[i];
  }
  return null;
}

/** Approximate content height of #leftColumn from nested translate/y. */
function measureLeftColumnHeight(doc) {
  const left = findById(doc, "g", "leftColumn");
  if (!left) return 0;
  let max = 0;
  const walk = (node, accY) => {
    if (!node || node.nodeType !== 1) return;
    const t = node.getAttribute("transform") || "";
    const m = /translate\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)/.exec(t);
    let y = accY;
    if (m) y = accY + Number(m[2]);
    const attrY = node.getAttribute("y");
    if (attrY != null && attrY !== "") max = Math.max(max, y + Number(attrY));
    else max = Math.max(max, y);
    for (let c = node.firstChild; c; c = c.nextSibling) walk(c, y);
  };
  walk(left, 0);
  return max + 20;
}

function setSvgHeight(doc, newH) {
  const svg = doc.documentElement;
  const w = svg.getAttribute("width") || "1000";
  svg.setAttribute("height", String(newH));
  svg.setAttribute("viewBox", `0 0 ${w} ${newH}`);
  const bodyH = newH - TITLE_BAR;

  const rects = doc.getElementsByTagName("rect");
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i];
    const y = r.getAttribute("y");
    const height = r.getAttribute("height");
    const x = r.getAttribute("x");
    const width = r.getAttribute("width");
    if (x === "0" && y === "0" && width === w && height && Number(height) > TITLE_BAR) {
      r.setAttribute("height", String(newH));
    }
    if (y === String(TITLE_BAR) && x === "0" && width === w) {
      r.setAttribute("height", String(bodyH));
    }
  }

  const clip = findById(doc, "clipPath", "terminalViewport");
  if (clip) {
    const cr = clip.getElementsByTagName("rect")[0];
    if (cr) cr.setAttribute("height", String(bodyH));
  }
}

function parseFragment(xml) {
  const wrapped = `<svg xmlns="http://www.w3.org/2000/svg">${xml}</svg>`;
  const doc = new DOMParser().parseFromString(wrapped, "application/xml");
  const pe = doc.getElementsByTagName("parsererror");
  if (pe && pe.length > 0) throw new Error("Unified tail fragment parse failed");
  // May have multiple root children — wrap in a group
  const svg = doc.documentElement;
  const g = doc.createElement("g");
  while (svg.firstChild) g.appendChild(svg.firstChild);
  return g;
}

async function loadContributionDays(user) {
  const cachePath = path.join(root, "assets", "contribution-days.json");
  try {
    const url = `https://github.com/users/${encodeURIComponent(user)}/contributions`;
    const html = await fetchText(url, {
      headers: { Accept: "text/html", "Accept-Language": "en-US,en;q=0.9" },
    });
    const days = parseContributionHtml(html);
    if (days.length) {
      await fs.writeFile(
        cachePath,
        JSON.stringify(
          { user, updatedAt: new Date().toISOString(), days },
          null,
          2
        ) + "\n",
        "utf8"
      );
      return days;
    }
  } catch (err) {
    console.error("contrib fetch failed:", err.message || err);
  }
  try {
    const cached = JSON.parse(await fs.readFile(cachePath, "utf8"));
    if (
      cached.user?.toLowerCase() === user.toLowerCase() &&
      Array.isArray(cached.days) &&
      cached.days.length
    ) {
      console.log(`Using cached contribution days (${cached.days.length})`);
      return cached.days;
    }
  } catch {
    /* no cache */
  }
  return [];
}

async function loadLatestCommit(user) {
  const cachePath = path.join(root, "assets", "latest-commit.json");
  try {
    const url = `https://api.github.com/users/${encodeURIComponent(user)}/events/public?per_page=30`;
    const raw = await fetchText(url, {
      headers: { Accept: "application/vnd.github+json" },
    });
    const events = JSON.parse(raw);
    for (const ev of events) {
      if (ev?.type !== "PushEvent") continue;
      const repo = ev.repo?.name?.split("/")?.[1] || ev.repo?.name || "repo";
      const commit = ev.payload?.commits?.at?.(-1) || ev.payload?.commits?.[0];
      const sha = (commit?.sha || "").slice(0, 7);
      const msg = (commit?.message || "update").split("\n")[0].slice(0, 56);
      if (!sha) continue;
      const line = `${sha} ${repo}: ${msg}`;
      await fs.writeFile(
        cachePath,
        JSON.stringify({ user, updatedAt: new Date().toISOString(), line }, null, 2) +
          "\n",
        "utf8"
      );
      return line;
    }
  } catch (err) {
    console.error("latest commit fetch failed:", err.message || err);
  }
  try {
    const cached = JSON.parse(await fs.readFile(cachePath, "utf8"));
    if (cached.user?.toLowerCase() === user.toLowerCase() && cached.line) {
      console.log("Using cached latest commit");
      return cached.line;
    }
  } catch {
    /* no cache */
  }
  return null;
}

function injectCursorBlinkCss(doc) {
  const styles = doc.getElementsByTagName("style");
  if (!styles.length) return;
  const style = styles[0];
  const css = style.textContent || "";
  if (css.includes("cursor-blink")) return;
  style.textContent =
    css +
    `
    @keyframes cursorBlink { 0%, 49% { opacity: 1; } 50%, 100% { opacity: 0; } }
    .cursor-blink { animation: cursorBlink 1.1s step-end infinite; }
    @media (prefers-reduced-motion: reduce) {
      .cursor-blink { animation: none !important; opacity: 1; }
    }
`;
}

(async function main() {
  const argv = process.argv.slice(2);
  if (!argv[0]) {
    console.error(
      "Usage: node scripts/compose-unified-profile.mjs <terminal.svg> [--config profile.config.json] [--user <github-user>] [--no-activity]"
    );
    process.exit(2);
  }
  const svgPath = path.resolve(argv[0]);
  let configPath;
  const ui = argv.indexOf("--user");
  const ci = argv.indexOf("--config");
  if (ci >= 0) configPath = argv[ci + 1];
  const noActivity = argv.includes("--no-activity");
  const config = await loadProfileConfig({ root, configPath });
  const user = ui >= 0 ? argv[ui + 1] || config.username : config.username;

  const markupRaw = await fs.readFile(markupPath, "utf8");
  const { lines } = JSON.parse(markupRaw);
  // Portrait art plus the wordmark caption underneath.
  const portraitH = (lines?.length || 29) * LINE_PX + 56;

  const includeActivity = config.options.contributionHeatmap && !noActivity;
  const days = includeActivity ? await loadContributionDays(user) : [];
  const latestCommit = includeActivity ? await loadLatestCommit(user) : null;
  const projects = buildProjectsSection({
    user,
    projects: config.projects,
    theme: config.theme,
    availability: config.availability,
  });
  const activity = includeActivity
    ? buildActivitySection(user, days, { latestCommit, theme: config.theme })
    : null;

  const raw = await fs.readFile(svgPath, "utf8");
  const doc = assertParseableSvg(raw);

  // Tail starts below whichever column is taller (skills can exceed portrait)
  const leftH = measureLeftColumnHeight(doc);
  const splitBottom =
    CONTENT_ORIGIN_Y + Math.max(portraitH, leftH) + 12;

  const gap = 10;
  // Extra bottom pad so content clears the rounded corners
  const tailInnerH =
    projects.height + (activity ? gap + activity.height : 0) + 28;
  const neededH = Math.ceil(splitBottom + tailInnerH);

  const existing = findById(doc, "g", "unifiedTail");
  if (existing?.parentNode) existing.parentNode.removeChild(existing);

  setSvgHeight(doc, Math.max(neededH, Number(doc.documentElement.getAttribute("height") || 0)));

  // Place tail inside #scrollContainer so it inherits the same textGlow as identity
  const scroll = findById(doc, "g", "scrollContainer");
  let originY = CONTENT_ORIGIN_Y;
  let originX = 8;
  if (scroll) {
    const tm = /translate\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)/.exec(
      scroll.getAttribute("transform") || ""
    );
    if (tm) {
      originX = Number(tm[1]);
      originY = Number(tm[2]);
    }
  }
  const localX = 16 - originX;
  const localY = Math.ceil(splitBottom - originY);

  const activityXml = activity
    ? `<g id="activitySection" transform="translate(0, ${projects.height + gap})">${activity.markup}</g>`
    : "";
  const tailXml = `
    <g id="unifiedTail" transform="translate(${localX}, ${localY})">
      <g id="projectsSection">${projects.markup}</g>
      ${activityXml}
    </g>
  `;

  const frag = parseFragment(tailXml);
  const imported = doc.importNode(frag, true);

  if (scroll) {
    scroll.appendChild(imported);
  } else {
    const clipHost = (() => {
      const clips = doc.getElementsByTagName("g");
      for (let i = 0; i < clips.length; i++) {
        const cp = clips[i].getAttribute("clip-path") || "";
        if (cp.includes("terminalViewport")) return clips[i];
      }
      return null;
    })();
    if (clipHost) clipHost.appendChild(imported);
    else doc.documentElement.appendChild(imported);
  }

  const svg = doc.documentElement;
  svg.setAttribute(
    "aria-label",
    `${config.displayName} terminal profile: identity, projects, and contribution activity`
  );
  const titles = doc.getElementsByTagName("title");
  if (titles[0]) titles[0].textContent = `${config.username}@terminal: ~`;

  injectCursorBlinkCss(doc);
  // Square body/vignette rects otherwise paint over bottom rx of the shell.
  applyRoundedWindowClip(doc, { theme: config.theme });

  let xml = new XMLSerializer().serializeToString(doc);
  if (!xml.startsWith("<?xml")) xml = '<?xml version="1.0" encoding="utf-8"?>\n' + xml;
  await writeSvgAtomic(svgPath, xml);
  console.log(
    `Unified profile \u2192 ${path.relative(root, svgPath)} (h=${doc.documentElement.getAttribute("height")}, days=${days.length}, activity=${includeActivity})`
  );
})().catch((err) => {
  console.error("ERROR:", err.message || err);
  process.exit(1);
});
