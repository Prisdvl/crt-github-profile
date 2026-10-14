#!/usr/bin/env node
/**
 * Generate a Claude-styled terminal contribution heatmap SVG.
 * Data: public HTML at https://github.com/users/<user>/contributions
 *
 * Usage:
 *   node scripts/generate-contribution.mjs [--user Prisdvl] [--out assets/contribution.svg] [--placeholder]
 */
import path from "path";
import { fileURLToPath } from "url";
import { escapeXml, writeSvgAtomic, fetchText } from "./lib/svg-util.mjs";
import {
  THEME,
  HEATMAP_LEVELS,
  FONT_MONO,
  terminalFrame,
} from "./lib/theme.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function parseArgs(argv) {
  const out = { user: "Prisdvl", out: "assets/contribution.svg", placeholder: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--user") out.user = argv[++i];
    else if (a === "--out") out.out = argv[++i];
    else if (a === "--placeholder") out.placeholder = true;
    else throw new Error(`Unknown arg: ${a}`);
  }
  return out;
}

/** Parse day cells from GitHub contributions HTML fragment. */
export function parseContributionHtml(html) {
  const days = [];
  const re = /<(?:td|rect)\b([^>]*)>/gi;
  let m;
  while ((m = re.exec(html))) {
    const attrs = m[1];
    const date = /data-date="(\d{4}-\d{2}-\d{2})"/.exec(attrs)?.[1];
    const levelRaw = /data-level="(\d)"/.exec(attrs)?.[1];
    if (!date || levelRaw === undefined) continue;
    const level = Math.max(0, Math.min(4, Number(levelRaw)));
    days.push({ date, level });
  }
  const tipMap = new Map();
  const tipRe =
    /<tool-tip[^>]*for="(contribution-day-component-[^"]+)"[^>]*>([\s\S]*?)<\/tool-tip>/gi;
  while ((m = tipRe.exec(html))) {
    const text = m[2].replace(/\s+/g, " ").trim();
    const cm = /^(\d+|No) contribution/.exec(text);
    if (!cm) continue;
    tipMap.set(m[1], cm[1] === "No" ? 0 : Number(cm[1]));
  }
  const idRe =
    /<(?:td|rect)\b([^>]*\bid="(contribution-day-component-[^"]+)"[^>]*)>/gi;
  while ((m = idRe.exec(html))) {
    const id = m[2];
    const date = /data-date="(\d{4}-\d{2}-\d{2})"/.exec(m[1])?.[1];
    if (date && tipMap.has(id)) {
      const day = days.find((d) => d.date === date);
      if (day) day.count = tipMap.get(id);
    }
  }
  days.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const byDate = new Map();
  for (const d of days) byDate.set(d.date, d);
  return [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
}

function weekIndex(dateStr, firstSunday) {
  const d = new Date(dateStr + "T12:00:00Z");
  const ms = d - firstSunday;
  return Math.floor(ms / (7 * 24 * 3600 * 1000));
}

function dow(dateStr) {
  return new Date(dateStr + "T12:00:00Z").getUTCDay();
}

function buildPlaceholderSvg(user) {
  const { text, muted, accent } = THEME;
  const body = [
    `<text x="0" y="0" font-family="${FONT_MONO}" font-size="13" fill="${accent}">prisdvl@dev:~$ contrib --user ${escapeXml(user)}</text>`,
    `<text x="0" y="28" font-family="${FONT_MONO}" font-size="12" fill="${muted}">[placeholder] live calendar unavailable</text>`,
    `<text x="0" y="52" font-family="${FONT_MONO}" font-size="12" fill="${text}">re-run: npm run generate:contribution</text>`,
  ].join("\n    ");
  return terminalFrame({
    width: 1000,
    height: 140,
    title: "prisdvl@activity: ~",
    ariaLabel: "Contribution placeholder",
    desc: "PLACEHOLDER: live contribution data was unavailable.",
    body,
  });
}

function buildHeatmapSvg(user, days) {
  if (!days.length) return buildPlaceholderSvg(user);

  const { muted, accent, cloud } = THEME;

  const first = days[0].date;
  const firstDate = new Date(first + "T12:00:00Z");
  const firstSunday = new Date(firstDate);
  firstSunday.setUTCDate(firstDate.getUTCDate() - firstDate.getUTCDay());
  firstSunday.setUTCHours(12, 0, 0, 0);

  const last = days[days.length - 1].date;
  const weeks = weekIndex(last, firstSunday) + 1;

  const cell = 12;
  const gap = 3;
  const left = 28;
  const top = 44;
  const gridH = 7 * (cell + gap);
  const legendY = top + gridH + 18;
  const contentW = left + weeks * (cell + gap);
  const width = 1000;
  const height = 36 + 14 + legendY + 28;

  const activeDays = days.filter((d) => d.level > 0).length;
  const withCount = days.filter((d) => typeof d.count === "number");
  const totalKnown = withCount.reduce((s, d) => s + d.count, 0);
  const countNote =
    withCount.length === days.length
      ? `${totalKnown} contributions · last year`
      : `${activeDays} active days · last year`;

  // Center grid horizontally inside 1000 frame body (width - 32 padding)
  const bodyInner = width - 32;
  const gridOffsetX = Math.max(0, Math.floor((bodyInner - contentW) / 2));

  const dowLabels = ["", "Mon", "", "Wed", "", "Fri", ""];
  const labelEls = dowLabels
    .map((lab, i) => {
      if (!lab) return "";
      const y = top + i * (cell + gap) + cell - 2;
      return `<text x="${gridOffsetX}" y="${y}" font-family="${FONT_MONO}" font-size="9" fill="${muted}">${lab}</text>`;
    })
    .join("");

  const cells = days
    .map((d) => {
      const w = weekIndex(d.date, firstSunday);
      const r = dow(d.date);
      const x = gridOffsetX + left + w * (cell + gap);
      const y = top + r * (cell + gap);
      const fill = HEATMAP_LEVELS[d.level] || HEATMAP_LEVELS[0];
      const title =
        typeof d.count === "number"
          ? `${d.count} on ${d.date}`
          : `level ${d.level} on ${d.date}`;
      return `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="2" fill="${fill}"><title>${escapeXml(title)}</title></rect>`;
    })
    .join("\n    ");

  const legend = HEATMAP_LEVELS.map((fill, i) => {
    const x = gridOffsetX + left + i * (cell + gap + 2);
    return `<rect x="${x}" y="${legendY}" width="${cell}" height="${cell}" rx="2" fill="${fill}"/>`;
  }).join("");

  const body = `
    <text x="0" y="0" font-family="${FONT_MONO}" font-size="13" fill="${accent}">prisdvl@dev:~$ contrib --user ${escapeXml(user)}</text>
    <text x="0" y="22" font-family="${FONT_MONO}" font-size="11" fill="${cloud}">${escapeXml(countNote)}</text>
    ${labelEls}
    ${cells}
    <text x="${gridOffsetX + left - 28}" y="${legendY + 10}" font-family="${FONT_MONO}" font-size="10" fill="${muted}">less</text>
    ${legend}
    <text x="${gridOffsetX + left + 5 * (cell + gap + 2) + 8}" y="${legendY + 10}" font-family="${FONT_MONO}" font-size="10" fill="${muted}">more</text>
  `;

  return terminalFrame({
    width,
    height,
    title: "prisdvl@activity: ~",
    ariaLabel: `GitHub contribution activity for ${escapeXml(user)}`,
    desc: `Contribution heatmap for ${escapeXml(user)}. ${escapeXml(countNote)}`,
    body,
  });
}

async function fetchDays(user) {
  const url = `https://github.com/users/${encodeURIComponent(user)}/contributions`;
  const html = await fetchText(url, {
    headers: {
      Accept: "text/html",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });
  const days = parseContributionHtml(html);
  if (!days.length) throw new Error("No contribution days parsed from HTML");
  return days;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const outPath = path.resolve(root, args.out);

  let svg;
  let mode = "live";
  if (args.placeholder) {
    svg = buildPlaceholderSvg(args.user);
    mode = "placeholder-forced";
  } else {
    try {
      const days = await fetchDays(args.user);
      svg = buildHeatmapSvg(args.user, days);
      console.log(`Parsed ${days.length} days for ${args.user}`);
    } catch (err) {
      console.error("Contribution fetch/parse failed:", err.message || err);
      console.error("Writing marked PLACEHOLDER SVG.");
      svg = buildPlaceholderSvg(args.user);
      mode = "placeholder-fallback";
    }
  }

  await writeSvgAtomic(outPath, svg);
  console.log("Wrote", outPath, `(${mode})`);
}

const isDirect =
  process.argv[1] &&
  path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1]);

if (isDirect) {
  await main();
}
