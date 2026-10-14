/**
 * Multi-tone blue/cyan shading for ASCII portrait lines.
 * Density + top-left lighting → [[fg:...]] markup runs.
 */

/** Dark → light blue ramp (theme names accepted by svg-terminal). */
export const TONES = ["blue", "cyan", "bright_blue", "bright_cyan", "bright_white"];

/** Theme hex used when emitting SVG tspans (matches terminal.yml). */
export const TONE_HEX = {
  blue: "#4ea1ff",
  cyan: "#4dd0e1",
  bright_blue: "#9ed0ff",
  bright_cyan: "#bff6ff",
  bright_white: "#ffffff",
  text: "#C9D1D9",
};

/** Visual weight high → low (dense chars are darker / deeper blue). */
const DENSITY =
  "$@B%8&WM#*oahkbdpqwmZO0QLCJUYXzcvunxrjft/\\|()1{}[]?-_+~<>i!lI;:,\"^`'.";

function densityLevel(ch) {
  const idx = DENSITY.indexOf(ch);
  if (idx === -1) return 2;
  return Math.min(
    TONES.length - 1,
    Math.floor((idx / DENSITY.length) * TONES.length)
  );
}

/**
 * Shade a line with density + lighting bias (top-left brighter).
 * Returns markup with [[fg:...]] runs; empty/whitespace-only → "".
 */
export function colorizeLine(line, row, rowCount) {
  if (!line.trim()) return "";

  const cols = [...line];
  const mid = cols.reduce((m, ch, i) => (ch !== " " ? Math.max(m, i) : m), 0);
  const width = Math.max(mid + 1, 1);

  const colored = cols.map((ch, col) => {
    if (ch === " ") return " ";
    let level = densityLevel(ch);
    const nx = col / width;
    const ny = row / Math.max(rowCount - 1, 1);
    const light = 1 - (nx * 0.55 + ny * 0.45);
    if (light > 0.72) level = Math.min(TONES.length - 1, level + 2);
    else if (light > 0.45) level = Math.min(TONES.length - 1, level + 1);
    else if (light < 0.28) level = Math.max(0, level - 1);
    return { ch, tone: TONES[level] };
  });

  let out = "";
  let i = 0;
  while (i < colored.length) {
    const cell = colored[i];
    if (cell === " ") {
      out += " ";
      i++;
      continue;
    }
    let j = i + 1;
    while (
      j < colored.length &&
      colored[j] !== " " &&
      colored[j].tone === cell.tone
    ) {
      j++;
    }
    const text = colored
      .slice(i, j)
      .map((c) => c.ch)
      .join("");
    out += `[[fg:${cell.tone}]]${text}[[/fg]]`;
    i = j;
  }
  return out;
}

export function colorizeArt(lines) {
  return lines.map((line, row) => colorizeLine(line, row, lines.length));
}

/** Trim shared leading whitespace so the portrait can sit flush in a right panel. */
export function trimArtLeading(lines) {
  const indents = lines
    .filter((l) => l.trim().length > 0)
    .map((l) => l.match(/^ */)?.[0].length ?? 0);
  const pad = indents.length ? Math.min(...indents) : 0;
  return lines.map((l) => (l.trim().length ? l.slice(pad) : ""));
}

export function escapeXml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Convert [[fg:tone]] / [[bold]] markup into <tspan> fragments.
 * Spaces outside tags become default-text tspans so layout stays monospace-stable.
 */
export function markupToTspans(markup, { defaultFill = TONE_HEX.text } = {}) {
  if (!markup) return `<tspan fill="${defaultFill}"> </tspan>`;

  const re = /\[\[(\/?)(fg|bold)(?::([^\]]+))?\]\]/g;
  let html = "";
  let i = 0;
  let fill = defaultFill;
  let bold = false;
  let m;
  while ((m = re.exec(markup))) {
    if (m.index > i) {
      const chunk = markup.slice(i, m.index);
      const weight = bold ? ' font-weight="bold"' : "";
      html += `<tspan fill="${fill}"${weight}>${escapeXml(chunk)}</tspan>`;
    }
    const closing = m[1] === "/";
    const kind = m[2];
    if (kind === "fg") {
      if (closing) fill = defaultFill;
      else {
        const tone = (m[3] || "").trim();
        fill = TONE_HEX[tone] || tone || defaultFill;
      }
    } else if (kind === "bold") {
      bold = !closing;
    }
    i = m.index + m[0].length;
  }
  if (i < markup.length) {
    const chunk = markup.slice(i);
    const weight = bold ? ' font-weight="bold"' : "";
    html += `<tspan fill="${fill}"${weight}>${escapeXml(chunk)}</tspan>`;
  }
  return html || `<tspan fill="${defaultFill}"> </tspan>`;
}
