/**
 * Full-width terminal section markup (no window chrome) for the unified profile.
 */
import { THEME, getHeatmapLevels, FONT_MONO } from "./theme.mjs";
import { escapeXml } from "./svg-util.mjs";

const FORTUNES = [
  "Build agents that earn their keep.",
  "Ship retrieval loops, not slide decks.",
  "Prefer boring infra for wild ideas.",
  "Measure RAG before you mythologize it.",
];

function pad(s, n) {
  const t = String(s);
  return t.length >= n ? t.slice(0, n) : t + " ".repeat(n - t.length);
}

function weekIndex(dateStr, firstSunday) {
  const d = new Date(dateStr + "T12:00:00Z");
  return Math.floor((d - firstSunday) / (7 * 24 * 3600 * 1000));
}

function dow(dateStr) {
  return new Date(dateStr + "T12:00:00Z").getUTCDay();
}

function sectionLabel(label) {
  const core = `\u2500\u2500 ${label} `;
  return core + "\u2500".repeat(Math.max(4, 48 - core.length));
}

/**
 * @param {{
 *   user: string,
 *   projects: Array<{name:string,stack:string,description:string,url?:string}>,
 *   theme?: object,
 *   availability?: string
 * }} options
 * @returns {{ markup: string, height: number }}
 */
export function buildProjectsSection(options = {}) {
  const user = options.user || "developer";
  const projects = options.projects || [];
  const theme = options.theme || THEME;
  const availability = options.availability || "online";
  const { text, muted, accent, kraft, sky, olive } = theme;
  const rows = [];
  let y = 0;

  const line = (parts, dy = 16) => {
    const spans = parts
      .map(([fill, s]) => `<tspan fill="${fill}">${escapeXml(s)}</tspan>`)
      .join("");
    rows.push(
      `<text class="tt" x="0" y="${y}" font-family="${FONT_MONO}" font-size="10" xml:space="preserve">${spans}</text>`
    );
    y += dy;
  };

  line([[muted, sectionLabel("projects")]], 14);
  line([
    [accent, `${user}@dev:~$ `],
    [text, "column -t ~/projects.tsv"],
  ]);
  line([
    [muted, pad("repo", 28)],
    [muted, pad("stack", 14)],
    [muted, "about"],
  ]);
  for (const project of projects) {
    line([
      [kraft, pad(project.name, 28)],
      [sky, pad(project.stack, 14)],
      [text, project.description],
    ]);
  }
  line([[muted, ""]], 8);
  line([
    [accent, `${user}@dev:~$ `],
    [text, "echo $STATUS"],
  ]);
  line([
    [olive || accent, availability],
    [muted, "  \u00b7  "],
    [sky, `github.com/${user}`],
  ]);

  return { markup: rows.join("\n"), height: y + 8 };
}

/**
 * @param {string} user
 * @param {Array<{date:string,level:number,count?:number}>} days
 * @param {{ latestCommit?: string|null, theme?: object }} [opts]
 * @returns {{ markup: string, height: number }}
 */
export function buildActivitySection(user, days, opts = {}) {
  const theme = opts.theme || THEME;
  const heatmapLevels = getHeatmapLevels(theme);
  const { text, muted, accent, cloud, kraft } = theme;
  const rows = [];
  let y = 0;

  const line = (parts, dy = 16) => {
    const spans = parts
      .map(([fill, s]) => `<tspan fill="${fill}">${escapeXml(s)}</tspan>`)
      .join("");
    rows.push(
      `<text class="tt" x="0" y="${y}" font-family="${FONT_MONO}" font-size="10" xml:space="preserve">${spans}</text>`
    );
    y += dy;
  };

  line([[muted, sectionLabel("activity")]], 14);
  line([
    [accent, `${user}@dev:~$ `],
    [text, `contrib --user ${user}`],
  ]);

  if (!days.length) {
    line([[muted, "[placeholder] contribution calendar unavailable"]]);
    return { markup: rows.join("\n"), height: y + 20 };
  }

  const first = days[0].date;
  const firstDate = new Date(first + "T12:00:00Z");
  const firstSunday = new Date(firstDate);
  firstSunday.setUTCDate(firstDate.getUTCDate() - firstDate.getUTCDay());
  firstSunday.setUTCHours(12, 0, 0, 0);
  const last = days[days.length - 1].date;
  const weeks = weekIndex(last, firstSunday) + 1;

  const cell = 11;
  const gap = 2;
  const left = 28;
  const top = y + 8;
  const gridH = 7 * (cell + gap);

  const activeDays = days.filter((d) => d.level > 0).length;
  const withCount = days.filter((d) => typeof d.count === "number");
  const totalKnown = withCount.reduce((s, d) => s + d.count, 0);
  const countNote =
    withCount.length === days.length
      ? `${totalKnown} contributions \u00b7 last year`
      : `${activeDays} active days \u00b7 last year`;

  rows.push(
    `<text class="tt" x="0" y="${y}" font-family="${FONT_MONO}" font-size="10" fill="${cloud}">${escapeXml(countNote)}</text>`
  );

  const bodyInner = 1000 - 32;
  const contentW = left + weeks * (cell + gap);
  const gridOffsetX = Math.max(0, Math.floor((bodyInner - contentW) / 2));

  const dowLabels = ["", "Mon", "", "Wed", "", "Fri", ""];
  for (let i = 0; i < dowLabels.length; i++) {
    if (!dowLabels[i]) continue;
    const ly = top + i * (cell + gap) + cell - 2;
    rows.push(
      `<text class="tt" x="${gridOffsetX}" y="${ly}" font-family="${FONT_MONO}" font-size="10" fill="${muted}">${dowLabels[i]}</text>`
    );
  }

  for (const d of days) {
    const w = weekIndex(d.date, firstSunday);
    const r = dow(d.date);
    const x = gridOffsetX + left + w * (cell + gap);
    const cy = top + r * (cell + gap);
    const fill = heatmapLevels[d.level] || heatmapLevels[0];
    const title =
      typeof d.count === "number"
        ? `${d.count} on ${d.date}`
        : `level ${d.level} on ${d.date}`;
    rows.push(
      `<rect x="${x}" y="${cy}" width="${cell}" height="${cell}" rx="2" fill="${fill}"><title>${escapeXml(title)}</title></rect>`
    );
  }

  const legendY = top + gridH + 14;
  rows.push(
    `<text class="tt" x="${gridOffsetX + left - 28}" y="${legendY + 9}" font-family="${FONT_MONO}" font-size="10" fill="${muted}">less</text>`
  );
  heatmapLevels.forEach((fill, i) => {
    const x = gridOffsetX + left + i * (cell + gap + 2);
    rows.push(
      `<rect x="${x}" y="${legendY}" width="${cell}" height="${cell}" rx="2" fill="${fill}"/>`
    );
  });
  rows.push(
    `<text class="tt" x="${gridOffsetX + left + 5 * (cell + gap + 2) + 8}" y="${legendY + 9}" font-family="${FONT_MONO}" font-size="10" fill="${muted}">more</text>`
  );

  y = legendY + cell + 14;

  line([[muted, sectionLabel("session")]], 14);
  if (opts.latestCommit) {
    line([
      [accent, `${user}@dev:~$ `],
      [text, "git log -1 --oneline"],
    ]);
    line([[cloud, opts.latestCommit]]);
  }

  const fortune = FORTUNES[Math.floor(Date.now() / 86400000) % FORTUNES.length];
  line([
    [accent, `${user}@dev:~$ `],
    [text, "fortune"],
  ]);
  line([[kraft, `"${fortune}"`]]);

  rows.push(
    `<text class="tt" x="0" y="${y}" font-family="${FONT_MONO}" font-size="10" xml:space="preserve"><tspan fill="${accent}">${escapeXml(user)}@dev:~$ </tspan><tspan class="cursor-blink" fill="${text}">\u2588</tspan></text>`
  );
  y += 18;

  return { markup: rows.join("\n"), height: y + 8 };
}
