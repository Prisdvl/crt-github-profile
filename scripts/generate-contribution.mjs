#!/usr/bin/env node
/**
 * Generate a terminal-style GitHub contribution heatmap SVG.
 * Data source: public HTML at https://github.com/users/<user>/contributions
 * (no token required). Optional GITHUB_TOKEN / GH_TOKEN only for higher rate limits.
 *
 * Usage:
 *   node scripts/generate-contribution.mjs [--user Prisdvl] [--out assets/contribution.svg] [--placeholder]
 */
import path from "path";
import { fileURLToPath } from "url";
import { COLORS, escapeXml, writeSvgAtomic, fetchText } from "./lib/svg-util.mjs";

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
  // Prefer exact counts from tooltips when present
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
  // Deduplicate by date (keep last)
  const byDate = new Map();
  for (const d of days) byDate.set(d.date, d);
  return [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
}

const LEVEL_FILL = [
  COLORS.surface, // 0
  "#0e4429",
  "#1a6b3c",
  "#2ea043",
  COLORS.accent, // 4
];

const ASCII_CHARS = ["·", "░", "▒", "▓", "█"];

function weekIndex(dateStr, firstSunday) {
  const d = new Date(dateStr + "T12:00:00Z");
  const ms = d - firstSunday;
  return Math.floor(ms / (7 * 24 * 3600 * 1000));
}

function dow(dateStr) {
  // 0 = Sunday
  return new Date(dateStr + "T12:00:00Z").getUTCDay();
}

function buildPlaceholderSvg(user) {
  const width = 720;
  const height = 160;
  return `<?xml version="1.0" encoding="utf-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Contribution placeholder">
  <title>Contribution activity (placeholder)</title>
  <desc>PLACEHOLDER: live contribution data was unavailable. Not real activity counts.</desc>
  <rect width="100%" height="100%" fill="${COLORS.bg}"/>
  <rect x="1" y="1" width="${width - 2}" height="${height - 2}" fill="none" stroke="${COLORS.border}" stroke-width="1"/>
  <text x="20" y="36" font-family="JetBrains Mono, Fira Code, ui-monospace, monospace" font-size="13" fill="${COLORS.accent}">$ contrib --user ${escapeXml(user)}</text>
  <text x="20" y="64" font-family="JetBrains Mono, Fira Code, ui-monospace, monospace" font-size="12" fill="${COLORS.muted}">[PLACEHOLDER] live calendar unavailable</text>
  <text x="20" y="92" font-family="JetBrains Mono, Fira Code, ui-monospace, monospace" font-size="12" fill="${COLORS.text}">re-run: npm run generate:contribution</text>
  <text x="20" y="120" font-family="JetBrains Mono, Fira Code, ui-monospace, monospace" font-size="12" fill="${COLORS.muted}">source: github.com/users/…/contributions</text>
</svg>
`;
}

function buildHeatmapSvg(user, days) {
  if (!days.length) return buildPlaceholderSvg(user);

  const first = days[0].date;
  const firstDate = new Date(first + "T12:00:00Z");
  const firstSunday = new Date(firstDate);
  firstSunday.setUTCDate(firstDate.getUTCDate() - firstDate.getUTCDay());
  firstSunday.setUTCHours(12, 0, 0, 0);

  const last = days[days.length - 1].date;
  const weeks = weekIndex(last, firstSunday) + 1;

  const cell = 11;
  const gap = 3;
  const left = 36;
  const top = 48;
  const legendH = 28;
  const width = left + weeks * (cell + gap) + 16;
  const height = top + 7 * (cell + gap) + legendH + 16;

  const activeDays = days.filter((d) => d.level > 0).length;
  const withCount = days.filter((d) => typeof d.count === "number");
  const totalKnown = withCount.reduce((s, d) => s + d.count, 0);
  const countNote =
    withCount.length === days.length
      ? `${totalKnown} contributions (last year)`
      : `${activeDays} active days (level-based; exact totals partial)`;

  const dowLabels = ["", "Mon", "", "Wed", "", "Fri", ""];
  const labelEls = dowLabels
    .map((lab, i) => {
      if (!lab) return "";
      const y = top + i * (cell + gap) + cell - 1;
      return `<text x="8" y="${y}" font-family="JetBrains Mono, Fira Code, ui-monospace, monospace" font-size="9" fill="${COLORS.muted}">${lab}</text>`;
    })
    .join("");

  const cells = days
    .map((d) => {
      const w = weekIndex(d.date, firstSunday);
      const r = dow(d.date);
      const x = left + w * (cell + gap);
      const y = top + r * (cell + gap);
      const fill = LEVEL_FILL[d.level] || LEVEL_FILL[0];
      const title =
        typeof d.count === "number"
          ? `${d.count} on ${d.date}`
          : `level ${d.level} on ${d.date}`;
      return `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="2" fill="${fill}"><title>${escapeXml(title)}</title></rect>`;
    })
    .join("\n  ");

  // Compact ASCII strip under legend (one char per week max intensity)
  const weekMax = Array.from({ length: weeks }, () => 0);
  for (const d of days) {
    const w = weekIndex(d.date, firstSunday);
    weekMax[w] = Math.max(weekMax[w], d.level);
  }
  const ascii = weekMax.map((lv) => ASCII_CHARS[lv] || "·").join("");
  const asciiLine = ascii.length > 90 ? ascii.slice(-90) : ascii;

  const legend = LEVEL_FILL.map((fill, i) => {
    const x = left + i * (cell + gap + 2);
    return `<rect x="${x}" y="${height - 22}" width="${cell}" height="${cell}" rx="2" fill="${fill}"/>`;
  }).join("");

  return `<?xml version="1.0" encoding="utf-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="GitHub contribution activity for ${escapeXml(user)}">
  <title>${escapeXml(user)} contribution activity</title>
  <desc>Terminal-styled contribution heatmap from public GitHub calendar data. ${escapeXml(countNote)}</desc>
  <rect width="100%" height="100%" fill="${COLORS.bg}"/>
  <rect x="1" y="1" width="${width - 2}" height="${height - 2}" fill="none" stroke="${COLORS.border}" stroke-width="1"/>
  <text x="16" y="24" font-family="JetBrains Mono, Fira Code, ui-monospace, monospace" font-size="13" fill="${COLORS.accent}">$ contrib --user ${escapeXml(user)}</text>
  <text x="16" y="40" font-family="JetBrains Mono, Fira Code, ui-monospace, monospace" font-size="11" fill="${COLORS.muted}">${escapeXml(countNote)}</text>
  ${labelEls}
  ${cells}
  <text x="16" y="${height - 28}" font-family="JetBrains Mono, Fira Code, ui-monospace, monospace" font-size="10" fill="${COLORS.muted}">less</text>
  ${legend}
  <text x="${left + 5 * (cell + gap + 2) + 8}" y="${height - 12}" font-family="JetBrains Mono, Fira Code, ui-monospace, monospace" font-size="10" fill="${COLORS.muted}">more</text>
  <text x="16" y="${height - 4}" font-family="JetBrains Mono, Fira Code, ui-monospace, monospace" font-size="9" fill="${COLORS.border}" xml:space="preserve">${escapeXml(asciiLine)}</text>
</svg>
`;
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
      console.error("Writing marked PLACEHOLDER SVG (previous file kept only if write fails).");
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
