#!/usr/bin/env node
/**
 * Lightweight terminal pet SVG (Tamagotchi-inspired, not a CLI embed).
 * State is derived from verifiable public contribution activity levels.
 *
 * Rules (deterministic, testable):
 *   - unknown  → idle   (data unavailable; distinct from zero activity)
 *   - no activity in last 7 calendar days → sleeping
 *   - last active day was 3–6 days ago → hungry
 *   - activity in last 0–2 days → happy
 *   - otherwise → idle
 *
 * Usage:
 *   node scripts/generate-pet.mjs [--user Prisdvl] [--out assets/pet.svg]
 */
import path from "path";
import { fileURLToPath } from "url";
import { COLORS, escapeXml, writeSvgAtomic, fetchText } from "./lib/svg-util.mjs";
import { parseContributionHtml } from "./generate-contribution.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function parseArgs(argv) {
  const out = { user: "Prisdvl", out: "assets/pet.svg" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--user") out.user = argv[++i];
    else if (a === "--out") out.out = argv[++i];
    else throw new Error(`Unknown arg: ${a}`);
  }
  return out;
}

/** @returns {'idle'|'happy'|'sleeping'|'hungry'} */
export function computePetState(days, today = new Date()) {
  if (!days || !days.length) return "idle"; // unknown / empty → idle (not "zero")

  const todayUtc = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  );

  const active = days
    .filter((d) => d.level > 0)
    .map((d) => d.date)
    .sort();

  if (!active.length) return "sleeping"; // known calendar, all zeros

  const last = active[active.length - 1];
  const lastDate = new Date(last + "T12:00:00Z");
  const lastUtc = new Date(
    Date.UTC(lastDate.getUTCFullYear(), lastDate.getUTCMonth(), lastDate.getUTCDate())
  );
  const diffDays = Math.round((todayUtc - lastUtc) / (24 * 3600 * 1000));

  if (diffDays <= 2) return "happy";
  if (diffDays <= 6) return "hungry";
  return "sleeping";
}

const SPRITES = {
  idle: [
    "  /\\_/\\  ",
    " ( o.o ) ",
    "  > ^ <  ",
  ],
  happy: [
    "  /\\_/\\  ",
    " ( ^.^ ) ",
    "  > w <  ",
  ],
  sleeping: [
    "  /\\_/\\  ",
    " ( -.- )z",
    "  > ~ <  ",
  ],
  hungry: [
    "  /\\_/\\  ",
    " ( >.< ) ",
    "  > ^ <  ",
  ],
};

function buildPetSvg({ user, state, dataKnown, lastActive, asOf }) {
  const lines = SPRITES[state] || SPRITES.idle;
  const width = 360;
  const height = 168;
  const font = 'font-family="JetBrains Mono, Fira Code, ui-monospace, monospace"';
  const statusColor =
    state === "happy"
      ? COLORS.accent
      : state === "hungry"
        ? "#f3c969"
        : state === "sleeping"
          ? COLORS.muted
          : COLORS.text;

  const dataLine = dataKnown
    ? `data: public calendar · last_active=${lastActive || "none"}`
    : "data: UNKNOWN (showing idle; not zero)";

  const body = lines
    .map((line, i) => {
      const y = 64 + i * 16;
      return `<text x="24" y="${y}" ${font} font-size="14" fill="${COLORS.text}" xml:space="preserve">${escapeXml(line)}</text>`;
    })
    .join("\n  ");

  return `<?xml version="1.0" encoding="utf-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Terminal pet state ${escapeXml(state)}">
  <title>Terminal pet · ${escapeXml(state)}</title>
  <desc>ASCII pet for ${escapeXml(user)}. State=${escapeXml(state)}. Rules use public contribution levels only — no XP or fabricated CI.</desc>
  <rect width="100%" height="100%" fill="${COLORS.bg}"/>
  <rect x="1" y="1" width="${width - 2}" height="${height - 2}" fill="none" stroke="${COLORS.border}" stroke-width="1"/>
  <text x="16" y="28" ${font} font-size="12" fill="${COLORS.accent}">$ pet status --user ${escapeXml(user)}</text>
  <text x="16" y="46" ${font} font-size="11" fill="${statusColor}">state: ${escapeXml(state)}</text>
  ${body}
  <text x="16" y="${height - 28}" ${font} font-size="10" fill="${COLORS.muted}">${escapeXml(dataLine)}</text>
  <text x="16" y="${height - 12}" ${font} font-size="10" fill="${COLORS.border}">as_of ${escapeXml(asOf)} · no emoji · CRT palette</text>
</svg>
`;
}

async function fetchDays(user) {
  const url = `https://github.com/users/${encodeURIComponent(user)}/contributions`;
  const html = await fetchText(url, {
    headers: { Accept: "text/html", "Accept-Language": "en-US,en;q=0.9" },
  });
  return parseContributionHtml(html);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const outPath = path.resolve(root, args.out);
  const asOf = new Date().toISOString().slice(0, 10);

  let dataKnown = false;
  let days = [];
  let lastActive = null;

  try {
    days = await fetchDays(args.user);
    dataKnown = days.length > 0;
    const active = days.filter((d) => d.level > 0).map((d) => d.date).sort();
    lastActive = active.length ? active[active.length - 1] : null;
  } catch (err) {
    console.error("Pet data fetch failed:", err.message || err);
    dataKnown = false;
    days = [];
  }

  const state = dataKnown ? computePetState(days) : "idle";
  const svg = buildPetSvg({
    user: args.user,
    state,
    dataKnown,
    lastActive,
    asOf,
  });

  await writeSvgAtomic(outPath, svg);
  console.log("Wrote", outPath, `state=${state} dataKnown=${dataKnown} lastActive=${lastActive}`);
}

const isDirect =
  process.argv[1] &&
  path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1]);

if (isDirect) {
  await main();
}
