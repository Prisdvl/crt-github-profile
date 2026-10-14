#!/usr/bin/env node
/**
 * Compose a left/right terminal layout:
 *   - Left: svg-terminal typing commands (already in the SVG)
 *   - Right: ASCII portrait from assets/ascii-art.markup.json
 *
 * Usage:
 *   node scripts/compose-split-terminal.mjs <terminal.svg> [--static]
 */
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import { markupToTspans } from "./lib/ascii-colorize.mjs";
import { assertParseableSvg, writeSvgAtomic } from "./lib/svg-util.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const markupPath = path.join(root, "assets", "ascii-art.markup.json");

// Keep in sync with terminal.yml (left column); portrait uses same metrics.
const FONT_SIZE = 10;
const LINE_HEIGHT = 1.08;
const LINE_PX = FONT_SIZE * LINE_HEIGHT; // 10.8
const TITLE_BAR = 40;
const PAD_TOP = 6;
const CONTENT_ORIGIN_Y = TITLE_BAR + PAD_TOP; // scrollContainer y
const RIGHT_X = 480; // leave more width for denser left column
const PORTRAIT_FADE_START_MS = 350;
const PORTRAIT_LINE_STAGGER_MS = 45;

function usage(msg) {
  if (msg) console.error(msg);
  console.error(
    "Usage: node scripts/compose-split-terminal.mjs <terminal.svg> [--static]"
  );
  process.exit(2);
}

function findById(doc, tag, id) {
  const list = doc.getElementsByTagName(tag);
  for (let i = 0; i < list.length; i++) {
    if (list[i].getAttribute("id") === id) return list[i];
  }
  return null;
}

function setSvgHeight(doc, newH) {
  const svg = doc.documentElement;
  const w = svg.getAttribute("width") || "1000";
  svg.setAttribute("height", String(newH));
  svg.setAttribute("viewBox", `0 0 ${w} ${newH}`);

  const bodyH = newH - TITLE_BAR;

  // Background / chrome rects that span the body
  const rects = doc.getElementsByTagName("rect");
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i];
    const y = r.getAttribute("y");
    const height = r.getAttribute("height");
    const x = r.getAttribute("x");
    const width = r.getAttribute("width");
    // Outer shell
    if (x === "0" && y === "0" && width === w && height && Number(height) > TITLE_BAR) {
      r.setAttribute("height", String(newH));
    }
    // Body fill / overlays starting at title bar
    if (y === String(TITLE_BAR) && x === "0" && width === w) {
      r.setAttribute("height", String(bodyH));
    }
  }

  const clip = findById(doc, "clipPath", "terminalViewport");
  if (clip) {
    const cr = clip.getElementsByTagName("rect")[0];
    if (cr) {
      cr.setAttribute("height", String(bodyH));
    }
  }
}

function buildPortraitFragment(lines, { isStatic }) {
  const parts = [
    `<g id="portraitPanel" transform="translate(${RIGHT_X}, 0)">`,
  ];
  for (let i = 0; i < lines.length; i++) {
    const y = Number((i * LINE_PX).toFixed(1));
    const delay = PORTRAIT_FADE_START_MS + i * PORTRAIT_LINE_STAGGER_MS;
    const fadeClass = isStatic ? "" : ` class="fade-in" style="animation-delay: ${delay}ms"`;
    const tspans = markupToTspans(lines[i] || "");
    parts.push(
      `    <g transform="translate(0, ${y})"${fadeClass}>`,
      `      <text class="tt">${tspans}</text>`,
      `    </g>`
    );
  }
  // Wordmark + spark under the blue/white portrait
  const captionY = Number((lines.length * LINE_PX + 18).toFixed(1));
  const fadeCap = isStatic
    ? ""
    : ` class="fade-in" style="animation-delay: ${PORTRAIT_FADE_START_MS + lines.length * PORTRAIT_LINE_STAGGER_MS}ms"`;
  parts.push(
    `    <g transform="translate(36, ${captionY})"${fadeCap}>`,
    `      <text class="tt" font-size="16" font-weight="bold"><tspan fill="#9ed0ff">P</tspan><tspan fill="#4dd0e1">r</tspan><tspan fill="#4ea1ff">i</tspan><tspan fill="#9ed0ff">s</tspan><tspan fill="#bff6ff">d</tspan></text>`,
    `      <text class="tt" y="14" fill="#8e8e8e">· welcome ·</text>`,
    `      <text class="tt" y="28" fill="#4ea1ff">✦ ··· ✦ ··· ✦</text>`,
    `    </g>`
  );
  parts.push(`  </g>`);
  return parts.join("\n");
}

function parseFragment(xml) {
  const wrapped = `<svg xmlns="http://www.w3.org/2000/svg">${xml}</svg>`;
  const doc = new DOMParser().parseFromString(wrapped, "application/xml");
  const pe = doc.getElementsByTagName("parsererror");
  if (pe && pe.length > 0) throw new Error("Portrait fragment parse failed");
  return doc.documentElement.firstChild;
}

(async function main() {
  const argv = process.argv.slice(2);
  if (argv.length < 1) usage("missing svg path");
  const svgPath = path.resolve(argv[0]);
  const isStatic = argv.includes("--static");

  const markupRaw = await fs.readFile(markupPath, "utf8");
  const { lines } = JSON.parse(markupRaw);
  if (!Array.isArray(lines) || lines.length === 0) {
    throw new Error(`No portrait lines in ${markupPath}`);
  }

  const raw = await fs.readFile(svgPath, "utf8");
  const doc = assertParseableSvg(raw);

  // Idempotent: remove prior portrait panel if re-running
  const existing = findById(doc, "g", "portraitPanel");
  if (existing?.parentNode) existing.parentNode.removeChild(existing);

  // Animated builds expose #scrollContainer; static builds use an anonymous
  // content group with the same translate(8, 48) origin.
  let scroll = findById(doc, "g", "scrollContainer");
  if (!scroll) {
    const groups = doc.getElementsByTagName("g");
    for (let i = 0; i < groups.length; i++) {
      const t = groups[i].getAttribute("transform") || "";
      // svg-terminal: translate(padding, titleBar + paddingTop)
      if (/translate\(\s*8\s*,\s*\d+(?:\.\d+)?\s*\)/.test(t)) {
        scroll = groups[i];
        scroll.setAttribute("id", "scrollContainer");
        break;
      }
    }
  }
  if (!scroll) throw new Error("scrollContainer / content group not found");

  // Extra space for Prisd wordmark caption under the art
  const portraitH = lines.length * LINE_PX + PAD_TOP + 56;
  const neededH = Math.ceil(CONTENT_ORIGIN_Y + portraitH);
  const curH = Number(doc.documentElement.getAttribute("height") || "0");
  if (neededH > curH) setSvgHeight(doc, neededH);

  // Clip left column so long typed lines never collide with the portrait
  let defs = doc.getElementsByTagName("defs")[0];
  if (!defs) {
    defs = doc.createElement("defs");
    doc.documentElement.insertBefore(defs, doc.documentElement.firstChild);
  }
  let leftClip = findById(doc, "clipPath", "leftColumnClip");
  if (!leftClip) {
    leftClip = doc.createElement("clipPath");
    leftClip.setAttribute("id", "leftColumnClip");
    const r = doc.createElement("rect");
    r.setAttribute("x", "0");
    r.setAttribute("y", "-20");
    r.setAttribute("width", String(RIGHT_X - 12));
    r.setAttribute("height", "2000");
    leftClip.appendChild(r);
    defs.appendChild(leftClip);
  }

  // Wrap existing left children in a clipped group (once)
  let leftCol = findById(doc, "g", "leftColumn");
  if (!leftCol) {
    leftCol = doc.createElement("g");
    leftCol.setAttribute("id", "leftColumn");
    leftCol.setAttribute("clip-path", "url(#leftColumnClip)");
    const children = [];
    for (let i = 0; i < scroll.childNodes.length; i++) {
      children.push(scroll.childNodes[i]);
    }
    for (const child of children) {
      scroll.removeChild(child);
      leftCol.appendChild(child);
    }
    scroll.appendChild(leftCol);
  }

  const frag = parseFragment(buildPortraitFragment(lines, { isStatic }));
  // Import node into target doc
  const imported = doc.importNode(frag, true);
  scroll.appendChild(imported);

  // Refresh aria-label / title / desc lightly
  const svg = doc.documentElement;
  const label =
    'Animated terminal: typing identity commands on the left, ASCII portrait on the right';
  svg.setAttribute("aria-label", label);
  const titles = doc.getElementsByTagName("title");
  if (titles[0]) titles[0].textContent = label;

  const serializer = new XMLSerializer();
  let xml = serializer.serializeToString(doc);
  if (!xml.startsWith("<?xml")) {
    xml = '<?xml version="1.0" encoding="utf-8"?>\n' + xml;
  }

  await writeSvgAtomic(svgPath, xml);
  console.log(
    `Composed split layout → ${path.relative(root, svgPath)} (portrait ${lines.length} lines @ x=${RIGHT_X}${isStatic ? ", static" : ""})`
  );
})().catch((err) => {
  console.error("ERROR:", err.message || err);
  process.exit(1);
});
